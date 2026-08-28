from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- Health check ---
from app.routes.health import router as health_router
from app.routes.focus import router as focus_router

# --- User component (teammate's) ---
from app.routes.user.user import router as user_router
from app.models.user.user import UserModel

# --- Journal component (teammate's) ---
from app.routes.journal.daily import router as daily_router
from app.routes.journal.reflection import router as reflection_router
from app.routes.journal.learning_insights import router as learning_insights_router
from app.routes.journal.leaderboard import router as leaderboard_router
from app.routes.journal.gamification_summary import router as gamification_summary_router
from app.routes.journal.behavior import router as behavior_router

# --- Career Prediction Engine component ---
from app.routes.career_prediction.predict import router as career_router

# --- Study Planner component (yours) ---
from app.routes.study_planner.priority_routes import router as priority_router
from app.routes.study_planner.explain_routes import router as explain_router
from app.routes.study_planner.schedule_routes import router as schedule_router
from app.routes.study_planner.todo_routes import router as todo_router
from app.routes.study_planner.cluster_routes import router as cluster_router


app = FastAPI(title="Smart Uni Guide API")

# Allows the Vite dev server (and local network variants) to call the API
# directly from the browser during frontend development.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    UserModel.ensure_gpa_field()


# --- Register routers ---
app.include_router(health_router)
app.include_router(focus_router)

# User
app.include_router(user_router)

# Journal
app.include_router(daily_router)
app.include_router(reflection_router)
app.include_router(learning_insights_router)
app.include_router(leaderboard_router)
app.include_router(gamification_summary_router)
app.include_router(behavior_router)

# Career Prediction Engine
app.include_router(career_router)

# Study Planner
app.include_router(priority_router)
app.include_router(explain_router)
app.include_router(schedule_router)
app.include_router(todo_router)
app.include_router(cluster_router)


@app.get("/")
def root():
    return {"message": "Smart Uni Guide backend is running"}