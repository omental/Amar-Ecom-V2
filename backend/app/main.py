from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings


app = FastAPI(title=settings.APP_NAME)
uploads_root = Path(__file__).resolve().parents[1] / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
    }


app.include_router(api_router, prefix="/api/v1")
app.mount("/uploads", StaticFiles(directory=uploads_root), name="uploads")
