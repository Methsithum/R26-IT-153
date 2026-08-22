"""
Step 3 of the Student Focus Monitor ML pipeline: builds the "boredom" class
for focus_dataset_unified/ from DAiSEE.

DAiSEE is the ONLY source for boredom (see project spec -- an earlier,
separately-sourced boredom/ folder was manually inspected and rejected: it
showed eyes-closed/head-tilted-back drowsy poses, not boredom, so it is
never used anywhere in this pipeline).

For every clip where DAiSEE's crowd-annotated Boredom score is >= 2, we pull
3 evenly-spaced frames out of that clip's video file. DAiSEE's own
Train/Validation/Test split is BY PERSON, so routing
Train->train, Validation->val, Test->test keeps that person-level split
intact in the unified dataset, exactly like the UTA-RLDD fatigue class in
build_unified_dataset.py.

Folder layout on disk (verified by inspection -- note the differences from
the original assumption):
    DataSet/{Train,Validation,Test}/<person_id>/<video_id>/<video_id>.avi
    Labels/{TrainLabels.csv,ValidationLabels.csv,TestLabels.csv}
The on-disk split folder names are Train/Validation/Test (not
Training/Validation/Testing as originally assumed), and each video folder
holds exactly one clip file named after the video id -- we still search
recursively so this keeps working if that ever isn't 1:1.
"""
import shutil

import cv2
import pandas as pd

from dataset_utils import (
    DAISEE_ROOT, OUTPUT_ROOT, MAPPING_LOG_PATH,
    CAP_PER_SOURCE, evenly_spaced_sample, ensure_dir, write_mapping_log,
)

BOREDOM_THRESHOLD = 2
FRAMES_PER_CLIP = 3
# Total clip budget spent across ALL THREE splits combined (not per split).
# DAiSEE's Train/Validation/Test folders don't hold Boredom>=2 clips in a
# 70/15/15 ratio -- they come out closer to 55/27/17 naturally. Capping each
# split independently at the same flat number (e.g. 500/500/500) flattens
# that away and leaves boredom's split proportions looking nothing like the
# other three classes'. Instead we cap the TOTAL and then divide it across
# splits in proportion to each split's own natural clip count, so the
# person-level split shape DAiSEE actually has is preserved.
TOTAL_CLIP_BUDGET = (CAP_PER_SOURCE // FRAMES_PER_CLIP) * 3

# DAiSEE split folder name -> (matching label CSV, unified dataset split name)
DAISEE_SPLITS = {
    "Train": ("TrainLabels.csv", "train"),
    "Validation": ("ValidationLabels.csv", "val"),
    "Test": ("TestLabels.csv", "test"),
}


def load_bored_clip_ids(labels_csv_path):
    df = pd.read_csv(labels_csv_path)
    df.columns = df.columns.str.strip()           # headers have trailing whitespace on disk
    df["ClipID"] = df["ClipID"].astype(str).str.strip()
    bored = df[df["Boredom"] >= BOREDOM_THRESHOLD]
    return sorted(bored["ClipID"].tolist())


def index_clip_files(dataset_split_dir):
    """One-time recursive scan mapping clip filename -> full path, so we
    don't re-walk the person/video folder tree for every clip we look up."""
    return {path.name: path for path in dataset_split_dir.rglob("*.avi")}


def extract_evenly_spaced_frames(video_path, n_frames=FRAMES_PER_CLIP):
    """Grab n_frames indices spread evenly across the clip's full length
    (not just the first n_frames), so a short static intro doesn't dominate
    the sample."""
    cap = cv2.VideoCapture(str(video_path))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if frame_count >= n_frames:
        indices = [round(i * (frame_count - 1) / (n_frames - 1)) for i in range(n_frames)]
    else:
        indices = list(range(max(frame_count, 0)))  # short/corrupt clip: take whatever exists

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if ok:
            frames.append((idx, frame))
    cap.release()
    return frames


def proportional_caps(bored_clip_ids_by_split):
    """Split TOTAL_CLIP_BUDGET across splits in proportion to each split's
    own natural (uncapped) clip count, instead of capping every split to the
    same flat number. A split with fewer natural clips than its proportional
    share just keeps all of them (no padding)."""
    total_natural = sum(len(ids) for ids in bored_clip_ids_by_split.values())
    return {
        split: round(TOTAL_CLIP_BUDGET * len(ids) / total_natural)
        for split, ids in bored_clip_ids_by_split.items()
    }


def main():
    log_rows = []
    total_per_split = {"train": 0, "val": 0, "test": 0}

    # First pass: load every split's qualifying clip list so we can size the
    # per-split caps off of all three splits' natural proportions at once.
    bored_clip_ids_by_split = {
        daisee_split: load_bored_clip_ids(DAISEE_ROOT / "Labels" / labels_file)
        for daisee_split, (labels_file, _) in DAISEE_SPLITS.items()
    }
    caps = proportional_caps(bored_clip_ids_by_split)

    for daisee_split, (labels_file, unified_split) in DAISEE_SPLITS.items():
        dataset_dir = DAISEE_ROOT / "DataSet" / daisee_split

        bored_clip_ids = bored_clip_ids_by_split[daisee_split]
        capped_clip_ids = evenly_spaced_sample(bored_clip_ids, caps[daisee_split])
        print(f"\n{daisee_split}: {len(bored_clip_ids)} clips with Boredom >= {BOREDOM_THRESHOLD}, "
              f"{len(capped_clip_ids)} kept after proportional cap (budget {caps[daisee_split]})")

        clip_index = index_clip_files(dataset_dir)
        dest_dir = OUTPUT_ROOT / unified_split / "boredom"
        if dest_dir.exists():
            shutil.rmtree(dest_dir)  # clear any frames from a previous run so re-runs don't accumulate stale files
        ensure_dir(dest_dir)

        for clip_id in capped_clip_ids:
            video_path = clip_index.get(clip_id)
            if video_path is None:
                print(f"  WARNING: clip {clip_id} listed in {labels_file} but no matching "
                      f"video file found under {dataset_dir} -- skipping")
                continue

            clip_stem = video_path.stem
            for frame_idx, frame in extract_evenly_spaced_frames(video_path):
                new_name = f"DAiSEE_{clip_stem}_f{frame_idx}.jpg"
                dest_path = dest_dir / new_name
                cv2.imwrite(str(dest_path), frame)
                log_rows.append(["boredom", unified_split, f"DAiSEE_{daisee_split}", str(video_path), str(dest_path)])
                total_per_split[unified_split] += 1

            print(f"  {unified_split}: {total_per_split[unified_split]} frames extracted so far", end="\r")

        print()  # newline after the running counter

    write_mapping_log(log_rows, MAPPING_LOG_PATH, mode="a")
    print(f"\nWrote {len(log_rows)} rows to {MAPPING_LOG_PATH} (appended)")
    print("Final boredom frame counts:", total_per_split)


if __name__ == "__main__":
    main()
