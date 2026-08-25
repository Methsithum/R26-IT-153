import base64
import binascii

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException

from app.schemas.focus.predict import PredictRequest, PredictResponse
from app.services.focus import inference

router = APIRouter(prefix="/focus", tags=["focus"])


def _decode_image(data_url: str) -> np.ndarray:
    if "," in data_url and data_url.strip().startswith("data:"):
        data_url = data_url.split(",", 1)[1]
    try:
        raw = base64.b64decode(data_url)
    except binascii.Error:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    buf   = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return frame


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    frame = _decode_image(req.image)
    try:
        result = inference.predict_from_frame(frame)
    except inference.ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return result
