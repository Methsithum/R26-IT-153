from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from scipy.spatial.transform import Rotation

BASE_DIR           = Path(__file__).resolve().parents[3]
LANDMARKER_MODEL_PATH = BASE_DIR / "ml_scripts" / "focus" / "models" / "face_landmarker.task"

IMG_SIZE     = 224
CROP_MARGIN  = 0.05

EYE_LEFT = [33, 160, 158, 133, 153, 144]
EYE_RIGHT = [263, 387, 385, 362, 380, 373]
MOUTH_CORNERS = (61, 291)
MOUTH_VERTICAL = (13, 14)
BROW_LEFT, EYE_TOP_LEFT = 105, 159
BROW_RIGHT, EYE_TOP_RIGHT = 334, 386
IRIS_LEFT, IRIS_RIGHT = 468, 473

_landmarker = None


def get_landmarker(): # load mediapipe face landmarker
    global _landmarker
    if _landmarker is None:
        base_options = mp_python.BaseOptions(model_asset_path=str(LANDMARKER_MODEL_PATH))
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            num_faces=1,
            running_mode=vision.RunningMode.IMAGE,
        )
        _landmarker = vision.FaceLandmarker.create_from_options(options)
    return _landmarker


def _detect(image_bgr): #identify face landmarks in image
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    return get_landmarker().detect(mp_image)


def detect_and_crop(frame_bgr, margin=CROP_MARGIN, out_size=IMG_SIZE): #crop face
    result = _detect(frame_bgr)
    if not result.face_landmarks:
        return None

    h, w = frame_bgr.shape[:2]
    xs = [p.x * w for p in result.face_landmarks[0]]
    ys = [p.y * h for p in result.face_landmarks[0]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    bw, bh = x1 - x0, y1 - y0
    x0, x1 = x0 - bw * margin, x1 + bw * margin
    y0, y1 = y0 - bh * margin, y1 + bh * margin
    x0, y0 = max(int(x0), 0), max(int(y0), 0)
    x1, y1 = min(int(x1), w), min(int(y1), h)
    if x1 <= x0 or y1 <= y0:
        return None

    crop = frame_bgr[y0:y1, x0:x1]
    return cv2.resize(crop, (out_size, out_size), interpolation=cv2.INTER_AREA)


def _dist(a, b):
    return float(np.hypot(a.x - b.x, a.y - b.y))


def _ear(lm, idx):
    p1, p2, p3, p4, p5, p6 = (lm[i] for i in idx)
    return (_dist(p2, p6) + _dist(p3, p5)) / (2 * _dist(p1, p4) + 1e-6)


def _mar(lm):
    top, bottom = lm[MOUTH_VERTICAL[0]], lm[MOUTH_VERTICAL[1]]
    left, right = lm[MOUTH_CORNERS[0]], lm[MOUTH_CORNERS[1]]
    return _dist(top, bottom) / (_dist(left, right) + 1e-6)


def _iris_offset(lm, iris_idx, eye_idx):
    iris = lm[iris_idx]
    corner1, corner2 = lm[eye_idx[0]], lm[eye_idx[3]]
    top, bottom = lm[eye_idx[1]], lm[eye_idx[4]]
    eye_w = _dist(corner1, corner2) + 1e-6
    eye_h = _dist(top, bottom) + 1e-6
    cx, cy = (corner1.x + corner2.x) / 2, (top.y + bottom.y) / 2
    return (iris.x - cx) / eye_w, (iris.y - cy) / eye_h


def _head_pose(matrix):
    rotation = np.array(matrix)[:3, :3]
    return Rotation.from_matrix(rotation).as_euler("xyz", degrees=True)


def extract_features(face_bgr): # get blendshape features
    result = _detect(face_bgr)
    if not result.face_landmarks:
        return None
    lm = result.face_landmarks[0]

    ear_l, ear_r = _ear(lm, EYE_LEFT), _ear(lm, EYE_RIGHT)
    gaze_lx, gaze_ly = _iris_offset(lm, IRIS_LEFT, EYE_LEFT)
    gaze_rx, gaze_ry = _iris_offset(lm, IRIS_RIGHT, EYE_RIGHT)

    features = {
        "ear_left": ear_l,
        "ear_right": ear_r,
        "ear_avg": (ear_l + ear_r) / 2,
        "mar": _mar(lm),
        "brow_eye_dist_left": lm[EYE_TOP_LEFT].y - lm[BROW_LEFT].y,
        "brow_eye_dist_right": lm[EYE_TOP_RIGHT].y - lm[BROW_RIGHT].y,
        "gaze_x_left": gaze_lx,
        "gaze_y_left": gaze_ly,
        "gaze_x_right": gaze_rx,
        "gaze_y_right": gaze_ry,
    }

    if result.facial_transformation_matrixes:
        pitch, yaw, roll = _head_pose(result.facial_transformation_matrixes[0])
    else:
        pitch, yaw, roll = 0.0, 0.0, 0.0
    features.update({"head_pitch": pitch, "head_yaw": yaw, "head_roll": roll})

    if result.face_blendshapes:
        for bs in result.face_blendshapes[0]:
            features[f"bs_{bs.category_name}"] = bs.score

    return features


EYE_PATCH_SIZE = 48


def _eye_patch(face_bgr, lm, indices, pad=0.45, out_size=EYE_PATCH_SIZE):
    h, w = face_bgr.shape[:2]
    xs = [lm[i].x * w for i in indices]
    ys = [lm[i].y * h for i in indices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    bw, bh = max(x1 - x0, 1.0), max(y1 - y0, 1.0)
    side = max(bw, bh)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x0, x1 = cx - side * (0.5 + pad), cx + side * (0.5 + pad)
    y0, y1 = cy - side * (0.5 + pad), cy + side * (0.5 + pad)
    x0, y0 = max(int(x0), 0), max(int(y0), 0)
    x1, y1 = min(int(x1), w), min(int(y1), h)
    if x1 <= x0 or y1 <= y0:
        return None
    crop = face_bgr[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    gray = cv2.resize(gray, (out_size, out_size), interpolation=cv2.INTER_AREA)
    return cv2.equalizeHist(gray)


def extract_eye_patches(face_bgr): #crop the eyes separately
    result = _detect(face_bgr)
    if not result.face_landmarks:
        return None, None
    lm = result.face_landmarks[0]
    return _eye_patch(face_bgr, lm, EYE_LEFT), _eye_patch(face_bgr, lm, EYE_RIGHT)


def eye_vector(patch, size=EYE_PATCH_SIZE): # convert eye patch to vector
    if patch is None:
        return None
    if patch.ndim == 3:
        patch = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    if patch.shape[0] != size or patch.shape[1] != size:
        patch = cv2.resize(patch, (size, size), interpolation=cv2.INTER_AREA)
        patch = cv2.equalizeHist(patch)
    return (patch.astype(np.float32) / 255.0).ravel()
