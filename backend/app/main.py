from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.predict import router as predict_router
from app.services.prediction import load_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup; release on shutdown."""
    load_models()
    yield


app = FastAPI(
    title="Career Prediction Engine API",
    description="Academic risk classification and career readiness regression for students.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router)


@app.get("/api/health", tags=["Health"])
def health_check():
    """Liveness probe — confirms the API process is running."""
    return {"status": "ok", "message": "API is running"}


@app.get("/", tags=["Health"])
def root():
    """Root endpoint."""
    return {"message": "Career Prediction Engine API — visit /docs for the interactive UI"}
