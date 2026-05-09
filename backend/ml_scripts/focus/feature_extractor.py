from __future__ import annotations

from pathlib import Path
from typing import Dict

import cv2
import numpy as np

try:
    import face_recognition
except ImportError:  # pragma: no cover - optional dependency fallback
    face_recognition = None


class FaceFeatureExtractor:
    def __init__(self) -> None:
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

    @staticmethod
    def _distance(point_a, point_b) -> float:
        return float(np.linalg.norm(np.array(point_a, dtype=np.float32) - np.array(point_b, dtype=np.float32)))

    @staticmethod
    def _eye_aspect_ratio(points) -> float:
        if len(points) < 6:
            return 0.0

        p1, p2, p3, p4, p5, p6 = points[:6]
        vertical = FaceFeatureExtractor._distance(p2, p6) + FaceFeatureExtractor._distance(p3, p5)
        horizontal = 2.0 * FaceFeatureExtractor._distance(p1, p4)
        return float(vertical / horizontal) if horizontal else 0.0

    @staticmethod
    def _mouth_aspect_ratio(top_lip, bottom_lip) -> float:
        if not top_lip or not bottom_lip:
            return 0.0

        top_center = np.mean(np.array(top_lip, dtype=np.float32), axis=0)
        bottom_center = np.mean(np.array(bottom_lip, dtype=np.float32), axis=0)
        mouth_left = min([*top_lip, *bottom_lip], key=lambda p: p[0])
        mouth_right = max([*top_lip, *bottom_lip], key=lambda p: p[0])

        vertical = FaceFeatureExtractor._distance(top_center, bottom_center)
        horizontal = FaceFeatureExtractor._distance(mouth_left, mouth_right)
        return float(vertical / horizontal) if horizontal else 0.0

    @staticmethod
    def _center(points) -> tuple[float, float]:
        array = np.array(points, dtype=np.float32)
        center = array.mean(axis=0)
        return float(center[0]), float(center[1])

    @staticmethod
    def _normalized_brow_distance(brow_points, eye_points, scale: float) -> float:
        if not brow_points or not eye_points or scale <= 0:
            return 0.0

        brow_y = FaceFeatureExtractor._center(brow_points)[1]
        eye_y = FaceFeatureExtractor._center(eye_points)[1]
        return float(abs(brow_y - eye_y) / scale)

    def _landmark_features(self, image: np.ndarray, face_box=None) -> Dict[str, float] | None:
        if face_recognition is None:
            return None

        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) if len(image.shape) == 3 else cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)

        face_locations = None
        if face_box is not None:
            x, y, fw, fh = face_box
            face_locations = [(y, x + fw, y + fh, x)]

        landmarks_list = face_recognition.face_landmarks(rgb, face_locations=face_locations)
        if not landmarks_list:
            return None

        face_landmarks = landmarks_list[0]
        left_eye = face_landmarks.get("left_eye", [])
        right_eye = face_landmarks.get("right_eye", [])
        left_eyebrow = face_landmarks.get("left_eyebrow", [])
        right_eyebrow = face_landmarks.get("right_eyebrow", [])
        top_lip = face_landmarks.get("top_lip", [])
        bottom_lip = face_landmarks.get("bottom_lip", [])

        left_ear = self._eye_aspect_ratio(left_eye)
        right_ear = self._eye_aspect_ratio(right_eye)
        avg_ear = float((left_ear + right_ear) / 2.0)
        mouth_ratio = self._mouth_aspect_ratio(top_lip, bottom_lip)

        left_center = self._center(left_eye) if left_eye else (0.0, 0.0)
        right_center = self._center(right_eye) if right_eye else (0.0, 0.0)
        eye_delta_y = abs(left_center[1] - right_center[1])
        eye_delta_x = abs(left_center[0] - right_center[0])
        head_tilt_angle = float(np.degrees(np.arctan2(eye_delta_y, eye_delta_x))) if eye_delta_x else 0.0

        face_height = float(max(1.0, image.shape[0]))
        brow_scale = float(max(1.0, abs(right_center[0] - left_center[0])))
        left_brow_dist = self._normalized_brow_distance(left_eyebrow, left_eye, face_height)
        right_brow_dist = self._normalized_brow_distance(right_eyebrow, right_eye, face_height)
        avg_brow_dist = float((left_brow_dist + right_brow_dist) / 2.0)

        gaze_variance = float(np.var([left_ear, right_ear, mouth_ratio, eye_delta_y / face_height, eye_delta_x / brow_scale]))
        blink_rate = float(np.clip((0.25 - avg_ear) / 0.25, 0.0, 1.0))

        return {
            "left_ear": float(left_ear),
            "right_ear": float(right_ear),
            "avg_ear": float(avg_ear),
            "left_brow_dist": float(left_brow_dist),
            "right_brow_dist": float(right_brow_dist),
            "avg_brow_dist": float(avg_brow_dist),
            "mouth_ratio": float(mouth_ratio),
            "eye_aspect_ratio": float(avg_ear),
            "mouth_aspect_ratio": float(mouth_ratio),
            "head_tilt_angle": float(head_tilt_angle),
            "gaze_variance": float(gaze_variance),
            "blink_rate": float(blink_rate),
        }

    def _largest_face(self, gray: np.ndarray):
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        if len(faces) == 0:
            return None
        return max(faces, key=lambda f: f[2] * f[3])

    def extract_all_features(self, image, is_eye_only: bool = False) -> Dict[str, float] | None:
        if image is None:
            return None

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
        h, w = gray.shape[:2]
        face = self._largest_face(gray)

        if face is not None:
            x, y, fw, fh = face
            roi = gray[y : y + fh, x : x + fw]
            face_area_ratio = (fw * fh) / float(w * h)
            aspect_ratio = fw / float(fh) if fh else 0.0
        else:
            roi = gray
            face_area_ratio = 0.0
            aspect_ratio = 1.0

        if is_eye_only and face is not None:
            # Use the upper half of the detected face as a lightweight eye-region proxy.
            roi = roi[: max(1, roi.shape[0] // 2), :]

        roi = cv2.resize(roi, (128, 128), interpolation=cv2.INTER_AREA)

        landmark_features = self._landmark_features(image, face_box=face)

        blurred = cv2.GaussianBlur(roi, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        lap_var = float(cv2.Laplacian(roi, cv2.CV_64F).var())

        half_h = roi.shape[0] // 2
        half_w = roi.shape[1] // 2
        center = roi[32:96, 32:96]

        features = {
            "mean_intensity": float(roi.mean()),
            "std_intensity": float(roi.std()),
            "min_intensity": float(roi.min()),
            "max_intensity": float(roi.max()),
            "laplacian_var": lap_var,
            "edge_density": float((edges > 0).mean()),
            "top_mean": float(roi[:half_h, :].mean()),
            "bottom_mean": float(roi[half_h:, :].mean()),
            "left_mean": float(roi[:, :half_w].mean()),
            "right_mean": float(roi[:, half_w:].mean()),
            "center_mean": float(center.mean()) if center.size else float(roi.mean()),
            "face_area_ratio": float(face_area_ratio),
            "face_aspect_ratio": float(aspect_ratio),
            "intensity_range": float(roi.max() - roi.min()),
            "roi_height": float(roi.shape[0]),
            "roi_width": float(roi.shape[1]),
        }

        if landmark_features:
            features.update(landmark_features)

        # Keep legacy keys available even when landmark extraction is unavailable.
        features.setdefault("left_ear", 0.0)
        features.setdefault("right_ear", 0.0)
        features.setdefault("avg_ear", 0.0)
        features.setdefault("left_brow_dist", 0.0)
        features.setdefault("right_brow_dist", 0.0)
        features.setdefault("avg_brow_dist", 0.0)
        features.setdefault("mouth_ratio", 0.0)
        features.setdefault("eye_aspect_ratio", features["avg_ear"])
        features.setdefault("mouth_aspect_ratio", features["mouth_ratio"])
        features.setdefault("head_tilt_angle", 0.0)
        features.setdefault("gaze_variance", 0.0)
        features.setdefault("blink_rate", 0.0)

        return features
