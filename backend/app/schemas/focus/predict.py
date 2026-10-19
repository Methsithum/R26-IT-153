from pydantic import BaseModel


class PredictRequest(BaseModel):
    image: str


class PredictResponse(BaseModel):
    face_detected: bool
    state: str | None
    confidence: float
    probs: dict[str, float]
