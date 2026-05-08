from __future__ import annotations

from pathlib import Path
from typing import Dict

import cv2
import numpy as np


class FaceFeatureExtractor:
    def __init__(self) -> None:
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

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

        blurred = cv2.GaussianBlur(roi, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        lap_var = float(cv2.Laplacian(roi, cv2.CV_64F).var())

        half_h = roi.shape[0] // 2
        half_w = roi.shape[1] // 2
        center = roi[32:96, 32:96]

        return {
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
