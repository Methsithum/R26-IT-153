from fastapi import FastAPI
from app.routes.health import router as health_router
from app.routes.study_planner.priority_routes import router as priority_router
from app.routes.study_planner.explain_routes import router as explain_router
from app.routes.study_planner.schedule_routes import router as schedule_router
from app.routes.study_planner.todo_routes import router as todo_router
from app.routes.study_planner.cluster_routes import router as cluster_router

app = FastAPI(title="Smart Uni Guide API")

app.include_router(health_router)
app.include_router(priority_router)
app.include_router(explain_router)
app.include_router(schedule_router)
app.include_router(todo_router)
app.include_router(cluster_router)


@app.get("/")
def root():
    return {"message": "Smart Uni Guide backend is running"}