from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.user.user import router as user_router
from app.routes.journal.daily import router as daily_router
from app.routes.journal.reflection import router as reflection_router
from app.routes.journal.learning_insights import router as learning_insights_router
from app.routes.journal.leaderboard import router as leaderboard_router
from app.routes.journal.gamification_summary import router as gamification_summary_router
from app.routes.journal.behavior import router as behavior_router

app = FastAPI(title="Smart Uni Guide API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(user_router)
app.include_router(daily_router)
app.include_router(reflection_router)
app.include_router(learning_insights_router)
app.include_router(leaderboard_router)
app.include_router(gamification_summary_router)
app.include_router(behavior_router)

@app.get("/")
def root():
    return {"message": "Smart Uni Guide backend is running"}