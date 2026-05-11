from fastapi import FastAPI
from app.routes.health import router as health_router
import importlib.util
import sys

# Load module with hyphen in name
spec = importlib.util.spec_from_file_location("priority_routes", 
    r"c:\Users\Chethana Methsithum\Desktop\Smart-Uni-Guide\backend\app\routes\study-planner\priority_routes.py")
priority_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(priority_module)
priority_router = priority_module.router

app = FastAPI(title="Smart Uni Guide API")

app.include_router(health_router)
app.include_router(priority_router)


@app.get("/")
def root():
    return {"message": "Smart Uni Guide backend is running"}