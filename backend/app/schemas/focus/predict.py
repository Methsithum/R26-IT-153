from pydantic import BaseModel


class PredictRequest(BaseModel):
    image: str  # base64 JPEG/PNG, with or without a data URL prefix


class PredictResponse(BaseModel):
    face_detected: bool
    state: str | None
    confidence: float
    probs: dict[str, float]
