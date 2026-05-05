from fastapi import FastAPI
from .routes.health import router as health_router

app = FastAPI(title="Smart Uni Guide API")

app.include_router(health_router)


@app.get("/")
def root():
    return {"message": "Smart Uni Guide backend is running"}