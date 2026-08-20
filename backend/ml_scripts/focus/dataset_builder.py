"""
Build the focus training set as face crops, from image *and* video datasets.

Why this exists
---------------
The first model was trained on whatever each dataset shipped: 640x640 SBD
crops, 96x96 FER thumbnails, full 1920x1080 webcam frames. At inference time
the backend sends something else entirely -- a Haar face box padded 15% and
resized to 224x224 -- so the model was reading a kind of image it had never
been trained on. Boredom, the class with the least data, never survived that
gap; on a live webcam it never fired at all.

This builder closes the gap by putting every training image through the *same*
code the webcam frame goes through: `app/services/focus/face_crop.py`. Detect
the face, pad it, resize to 224x224, write it out. Nothing else reaches the
model, so background, framing and scale match between training and inference.

It also unlocks DAiSEE itself. The `Student Behavior Detection` dataset is a
pre-cropped slice of DAiSEE with only 855 Boredom images; the DAiSEE videos it
came from hold 1,446 clips that read as Boredom, at 640x480 and 30fps -- the
closest thing in the project to a real webcam. Sampling a few frames from each
gives thousands of *real* Boredom faces instead of SMOTE copies of 599.

Leakage
-------
Splits are decided on the **subject**, before a single frame is extracted. A
subject owns many clips and a clip owns many frames, so splitting on frames --
or even on clips -- would put the same face in train and test. DAiSEE clip ids
are 10 digits whose first 6 identify the person; SBD filenames carry the same
ids, so both sources share one `daisee:<person>` namespace and cannot leak into
each other either.

Usage
-----
    python dataset_builder.py                          # daisee + fatigue -> faces_224/
    python dataset_builder.py --frames-per-clip 6
    python dataset_builder.py --max-clips-per-class 900 --out ../../datasets/focus/faces_small
    python dataset_builder.py --sources daisee --dry-run    # plan only, writes nothing

Output
------
    <out>/<split>/<label>/<name>.jpg    224x224 face crops
    <out>/manifest.csv                  one row per crop
    <out>/build_report.json             settings, counts, per-source miss rates
"""
import argparse
import csv
import hashlib
import json
import random
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import cv2

BASE_DIR = Path(__file__).resolve().parents[2]          # -> backend/
sys.path.insert(0, str(BASE_DIR))
from app.services.focus import face_crop                # noqa: E402

DATASETS = BASE_DIR / "datasets" / "focus"
CLASSES  = ["Focused", "Fatigue", "Anxiety", "Boredom"]
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp")
VID_EXTS = (".avi", ".mp4", ".mov", ".mkv")
SPLIT_RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}


# ══════════════════════════════════════════════════════════════════════
# DAiSEE labels
# ══════════════════════════════════════════════════════════════════════
#
# DAiSEE scores four affects per clip, 0-3 each, and they overlap: a clip can
# be Boredom=2 *and* Engagement=2. Collapsing them onto one of our four states
# needs a rule that resolves the overlap rather than taking an argmax over axes
# that do not mean the same thing.
#
#   Boredom  : bored at all (>=2) and not strongly engaged, with no negative
#              affect competing for the label.
#   Anxiety  : confusion or frustration at >=2 -- both are negative-arousal in
#              DAiSEE terms, and the first model already merged them.
#   Focused  : engagement at its top level, with nothing else in the frame.
#
# A clip satisfying none of the three is dropped. A dropped clip costs one clip;
# a wrongly labelled one poisons every frame taken from it.
#
# DAiSEE has no drowsiness axis, so it supplies no Fatigue -- that stays with
# the `fatigue` dataset, which is what it was recorded for.

def daisee_label(boredom, engagement, confusion, frustration):
    """DAiSEE's four 0-3 intensities -> one class, or None if ambiguous."""
    negative = max(confusion, frustration)
    if boredom >= 2 and engagement <= 2 and negative <= 1:
        return "Boredom"
    if negative >= 2 and boredom <= 1:
        return "Anxiety"
    if engagement >= 3 and boredom <= 1 and negative == 0:
        return "Focused"
    return None


def daisee_subject(clip_id):
    """First 6 digits of a 10-digit DAiSEE clip id identify the person."""
    stem = Path(clip_id).stem
    return f"daisee:{stem[:6]}" if len(stem) >= 6 and stem.isdigit() else f"daisee:{stem}"


def scan_daisee(root):
    """-> video items. Labels come from the CSVs; the shipped Train/Test/
    Validation folders are ignored, since the split is rebuilt here."""
    labels_csv = root / "Labels" / "AllLabels.csv"
    if not labels_csv.is_file():
        print(f"   !! missing {labels_csv}")
        return []

    by_clip, ambiguous = {}, 0
    with open(labels_csv, newline="") as f:
        for row in csv.DictReader(f):
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            try:
                label = daisee_label(int(row["Boredom"]), int(row["Engagement"]),
                                     int(row["Confusion"]), int(row["Frustration"]))
            except (KeyError, ValueError):
                continue
            if label is None:
                ambiguous += 1
            else:
                by_clip[Path(row["ClipID"]).stem] = label

    items = []
    for p in sorted((root / "DataSet").rglob("*")):
        if p.suffix.lower() not in VID_EXTS:
            continue
        label = by_clip.get(p.stem)
        if label is None:
            continue
        items.append({"path": p, "label": label, "source": "daisee",
                      "group": daisee_subject(p.stem), "clip": p.stem, "kind": "video"})

    print(f"   daisee   {len(items)} clips labelled, {ambiguous} ambiguous clips dropped")
    return items


# ══════════════════════════════════════════════════════════════════════
# Image datasets
# ══════════════════════════════════════════════════════════════════════

SBD_ID_RE     = re.compile(r"_(\d+)_frame")
FATIGUE_ID_RE = re.compile(r"^(\d+)_frame")

SBD_MAP     = {"Engagement": "Focused", "Boredom": "Boredom",
               "Frustration": "Anxiety", "Confusion": "Anxiety"}
FATIGUE_MAP = {"alert": "Focused", "tired": "Fatigue", "non_vigilant": "Fatigue"}
FACIAL_MAP  = {"angry": "Anxiety", "fear": "Anxiety", "disgust": "Anxiety",
               "neutral": "Focused"}


def sbd_group(name):
    """SBD filenames embed the DAiSEE clip id, so SBD subjects land in the same
    namespace as the DAiSEE ones -- otherwise the same person could sit in
    train via one source and test via the other."""
    m = SBD_ID_RE.search(name)
    if not m or len(m.group(1)) < 4:
        return None
    cid = m.group(1)
    return f"daisee:{cid[:6]}" if len(cid) == 10 else f"daisee:{cid}"


def fatigue_group(name):
    m = FATIGUE_ID_RE.match(name)
    return f"fat:{m.group(1)}" if m else None


def scan_images(root, label_map, group_fn, source, splits, layout="split/label"):
    """-> image items, one per file, from a <split>/<label>/ or <label>/<split>/ tree."""
    items = []
    if not root.is_dir():
        print(f"   !! missing {root}")
        return items
    for split in splits:
        for src_label, target in label_map.items():
            d = root / (f"{split}/{src_label}" if layout == "split/label"
                        else f"{src_label}/{split}")
            if not d.is_dir():
                continue
            for p in sorted(d.rglob("*")):
                if p.suffix.lower() in IMG_EXTS:
                    items.append({"path": p, "label": target, "source": source,
                                  "group": group_fn(p.name), "clip": p.stem,
                                  "kind": "image"})
    print(f"   {source:<9}{len(items)} images")
    return items


# ══════════════════════════════════════════════════════════════════════
# Subject-disjoint split -- decided before any frame is extracted
# ══════════════════════════════════════════════════════════════════════

def build_splits(items, frames_per_clip, seed):
    """Assign every item to train/val/test, grouping on subject.

    Groups are placed greedily into whichever split is relatively emptiest,
    measured as a fraction of that split's quota rather than raw overflow, so
    the 70/15/15 shape survives groups of very different sizes. A video item
    counts as `frames_per_clip` rows, because that is what it will contribute.
    """
    def weight(it):
        return frames_per_clip if it["kind"] == "video" else 1

    grouped, ungrouped = defaultdict(list), defaultdict(list)
    for it in items:
        (grouped[it["group"]] if it["group"] else ungrouped[it["label"]]).append(it)

    totals = Counter()
    for it in items:
        totals[it["label"]] += weight(it)
    quota  = {s: {c: SPLIT_RATIOS[s] * totals[c] for c in CLASSES} for s in SPLIT_RATIOS}
    filled = {s: {c: 0.0 for c in CLASSES} for s in SPLIT_RATIOS}

    def cost(split, counts):
        return max((filled[split][c] + n) / max(quota[split][c], 1.0)
                   for c, n in counts.items())

    groups = list(grouped.values())
    random.Random(seed).shuffle(groups)
    groups.sort(key=len, reverse=True)          # largest groups constrain the most

    for recs in groups:
        counts = Counter()
        for it in recs:
            counts[it["label"]] += weight(it)
        pick = min(SPLIT_RATIOS, key=lambda s: cost(s, counts))
        for it in recs:
            it["split"] = pick
            filled[pick][it["label"]] += weight(it)

    # Files whose name carries no subject id cannot be grouped. They are split
    # per class at the plain ratios -- the best available, and reported below.
    for cls, loose in ungrouped.items():
        loose = loose[:]
        random.Random(seed).shuffle(loose)
        n_tr = int(len(loose) * SPLIT_RATIOS["train"])
        n_va = int(len(loose) * SPLIT_RATIOS["val"])
        for it in loose[:n_tr]:
            it["split"] = "train"
        for it in loose[n_tr:n_tr + n_va]:
            it["split"] = "val"
        for it in loose[n_tr + n_va:]:
            it["split"] = "test"

    n_loose = sum(len(v) for v in ungrouped.values())
    if n_loose:
        print(f"   {n_loose} items had no subject id and were split per class")
    return items


def check_leakage(items):
    """Subject and clip overlap between splits. Both must be zero."""
    out = {}
    for key in ("group", "clip"):
        sets = {s: {it[key] for it in items if it["split"] == s and it[key]}
                for s in SPLIT_RATIOS}
        out[key] = {"train_val":  len(sets["train"] & sets["val"]),
                    "train_test": len(sets["train"] & sets["test"]),
                    "val_test":   len(sets["val"]   & sets["test"])}
    return out


# ══════════════════════════════════════════════════════════════════════
# Frame extraction
# ══════════════════════════════════════════════════════════════════════

def representative_positions(n_frames, k, margin=0.10):
    """k evenly spaced frame indices across the middle of a clip.

    Evenly spaced rather than consecutive: DAiSEE clips are 10 seconds, and 4
    consecutive frames are 4 copies of one moment. The first and last 10% are
    skipped -- clips often open or close on the subject settling in.
    """
    lo, hi = int(n_frames * margin), int(n_frames * (1 - margin))
    if hi <= lo:
        lo, hi = 0, max(n_frames - 1, 0)
    if k == 1:
        return [(lo + hi) // 2]
    step = (hi - lo) / (k - 1)
    return [int(lo + i * step) for i in range(k)]


def crops_from_video(path, k, retries):
    """-> ([(frame_index, 224x224 crop)], reason) for one clip, at most k crops.

    When the detector misses at a chosen position the next few frames are tried
    before that slot is given up -- a blink or a turn costs a frame, not a
    sample.
    """
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return [], "unreadable"

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return [], "unreadable"

    out, misses = [], 0
    for pos in representative_positions(total, k):
        for attempt in range(retries + 1):
            idx = min(pos + attempt * 3, total - 1)
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok:
                continue
            face, _ = face_crop.detect_face(frame)
            if face is not None and face.size:
                out.append((idx, face_crop.resize_input(face)))
                break
        else:
            misses += 1
    cap.release()
    return out, ("no_face" if misses and not out else None)


def crop_from_image(path):
    """-> (224x224 crop, None), or (None, reason)."""
    img = cv2.imread(str(path))
    if img is None:
        return None, "unreadable"
    face, _ = face_crop.detect_face(img)
    if face is None or not face.size:
        return None, "no_face"
    return face_crop.resize_input(face), None


# ══════════════════════════════════════════════════════════════════════
# Build
# ══════════════════════════════════════════════════════════════════════

def build(items, out_dir, frames_per_clip, retries, dry_run):
    """Write crops + manifest. -> (rows, stats)"""
    rows  = []
    stats = defaultdict(Counter)
    seen  = set()                       # md5 of written crops -> drop repeats
    t0, done = time.time(), 0

    manifest = None if dry_run else open(out_dir / "manifest.csv", "w",
                                         newline="", encoding="utf-8")
    writer = None
    if manifest:
        writer = csv.writer(manifest)
        writer.writerow(["split", "label", "source", "group", "clip", "frame", "path"])

    def progress():
        rate = done / max(time.time() - t0, 1e-6)
        print(f"\r   {done}/{len(items)} items  {len(rows)} crops  "
              f"{rate:.1f} items/s  eta {(len(items)-done)/max(rate,1e-6)/60:.1f} min",
              end="", flush=True)

    for it in items:
        done += 1
        if it["kind"] == "video":
            crops, reason = crops_from_video(it["path"], frames_per_clip, retries)
        else:
            crop, reason = crop_from_image(it["path"])
            crops = [(0, crop)] if crop is not None else []

        if reason:
            stats[it["source"]][reason] += 1
        if not crops:
            stats[it["source"]]["items_dropped"] += 1
            if done % 200 == 0 or done == len(items):
                progress()
            continue
        stats[it["source"]]["items_kept"] += 1

        for frame_idx, crop in crops:
            digest = hashlib.md5(crop.tobytes()).hexdigest()
            if digest in seen:
                stats[it["source"]]["duplicate_crops"] += 1
                continue
            seen.add(digest)

            name = f"{it['source']}_{it['clip']}_{frame_idx:05d}.jpg"
            rel  = f"{it['split']}/{it['label']}/{name}"
            if not dry_run:
                dst = out_dir / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(dst), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
                writer.writerow([it["split"], it["label"], it["source"],
                                 it["group"] or "", it["clip"], frame_idx, rel])
            rows.append({"split": it["split"], "label": it["label"],
                         "source": it["source"], "path": rel})
            stats[it["source"]]["crops"] += 1

        if done % 200 == 0 or done == len(items):
            progress()

    print()
    if manifest:
        manifest.close()
    return rows, stats


def report(rows, stats, leakage):
    print(f"\n   {'Class':<10}{'Train':>8}{'Val':>7}{'Test':>7}{'Total':>8}")
    print("   " + "-" * 40)
    counts = {}
    for cls in CLASSES:
        c = {s: sum(1 for r in rows if r["label"] == cls and r["split"] == s)
             for s in SPLIT_RATIOS}
        counts[cls] = c
        print(f"   {cls:<10}{c['train']:>8}{c['val']:>7}{c['test']:>7}{sum(c.values()):>8}")
    print("   " + "-" * 40)
    tot = {s: sum(1 for r in rows if r["split"] == s) for s in SPLIT_RATIOS}
    print(f"   {'TOTAL':<10}{tot['train']:>8}{tot['val']:>7}{tot['test']:>7}{len(rows):>8}")

    print("\n   Per source")
    for src, c in sorted(stats.items()):
        kept, dropped = c["items_kept"], c["items_dropped"]
        pct = 100 * kept / max(kept + dropped, 1)
        print(f"   {src:<10}{c['crops']:>7} crops from {kept}/{kept+dropped} items "
              f"({pct:.1f}% had a detectable face)"
              + (f", {c['duplicate_crops']} duplicate crops dropped"
                 if c["duplicate_crops"] else ""))

    print("\n   Split overlap (must all be 0)")
    for key, o in leakage.items():
        print(f"   {key:<8} train/val {o['train_val']}  train/test {o['train_test']}  "
              f"val/test {o['val_test']}")
    return counts, tot


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("Usage")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(DATASETS / "faces_224"),
                    help="output root (default datasets/focus/faces_224)")
    ap.add_argument("--sources", default="daisee,fatigue",
                    help="comma list of daisee,fatigue,sbd,facial (default daisee,fatigue)")
    ap.add_argument("--frames-per-clip", type=int, default=4,
                    help="representative frames taken per video (default 4)")
    ap.add_argument("--seek-retries", type=int, default=2,
                    help="nearby frames to try when the detector misses (default 2)")
    ap.add_argument("--max-clips-per-class", type=int, default=None,
                    help="cap on video clips per class, applied before the split")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--dry-run", action="store_true",
                    help="scan, split and report; write nothing")
    args = ap.parse_args()

    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    out_dir = Path(args.out)
    print("=" * 62)
    print("  Focus dataset builder - face crops for training and webcam alike")
    print("=" * 62)
    print(f"\n  out    : {out_dir}")
    print(f"  crop   : Haar frontal face, +{face_crop.FACE_PAD:.0%} margin, "
          f"{face_crop.IMG_SIZE}x{face_crop.IMG_SIZE} (face_crop.py)")
    print(f"  frames : {args.frames_per_clip} per clip\n")

    print("  Scanning")
    items = []
    if "daisee" in sources:
        items += scan_daisee(DATASETS / "DAiSEE")
    if "fatigue" in sources:
        items += scan_images(DATASETS / "fatigue", FATIGUE_MAP, fatigue_group,
                             "fatigue", ("train", "val", "test"))
    if "sbd" in sources:
        items += scan_images(DATASETS / "Student Behavior Detection", SBD_MAP, sbd_group,
                             "sbd", ("train", "valid", "test"))
    if "facial" in sources:
        items += scan_images(DATASETS / "facial" / "processed_data", FACIAL_MAP,
                             lambda n: None, "facial", ("train", "val", "test"),
                             layout="label/split")
    if not items:
        raise SystemExit("No items found -- check --sources and the dataset paths.")

    if args.max_clips_per_class:
        # Capped by whole subject, not by clip: dropping half a person's clips
        # would leave the rest to be split anyway, which is exactly the leak
        # this cap is not allowed to reintroduce.
        vids = [it for it in items if it["kind"] == "video"]
        rest = [it for it in items if it["kind"] != "video"]
        by_subject = defaultdict(list)
        for it in vids:
            by_subject[it["group"]].append(it)
        subjects = list(by_subject.values())
        random.Random(args.seed).shuffle(subjects)

        kept, per_class, n_subjects = [], Counter(), 0
        for group in subjects:
            labels = Counter(it["label"] for it in group)
            if all(per_class[c] + n <= args.max_clips_per_class for c, n in labels.items()):
                kept += group
                per_class += labels
                n_subjects += 1
        items = kept + rest
        print(f"   capped to {args.max_clips_per_class} clips/class -> {len(kept)} clips "
              f"from {n_subjects} subjects")

    print(f"\n  {len(items)} items: "
          + "  ".join(f"{k}={v}" for k, v in Counter(it["label"] for it in items).items()))

    print("\n  Splitting on subject (before extraction)")
    items = build_splits(items, args.frames_per_clip, args.seed)
    leakage = check_leakage(items)

    if not args.dry_run:
        out_dir.mkdir(parents=True, exist_ok=True)
    print("\n  Extracting" + (" (dry run - nothing written)" if args.dry_run else ""))
    rows, stats = build(items, out_dir, args.frames_per_clip, args.seek_retries,
                        args.dry_run)

    counts, tot = report(rows, stats, leakage)

    if not args.dry_run:
        with open(out_dir / "build_report.json", "w") as f:
            json.dump({
                "sources": sources,
                "frames_per_clip": args.frames_per_clip,
                "seek_retries": args.seek_retries,
                "max_clips_per_class": args.max_clips_per_class,
                "img_size": face_crop.IMG_SIZE,
                "face_pad": face_crop.FACE_PAD,
                "crop_method": "app/services/focus/face_crop.py (same as inference)",
                "preprocessing": "MobileNetV2 preprocess_input, applied at feature time",
                "split": "subject-disjoint 70/15/15, decided before frame extraction",
                "seed": args.seed,
                "total_crops": len(rows),
                "split_counts": tot,
                "class_counts": counts,
                "per_source": {k: dict(v) for k, v in stats.items()},
                "leakage": leakage,
            }, f, indent=2)
        print(f"\n  Wrote {len(rows)} crops + manifest.csv + build_report.json to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
