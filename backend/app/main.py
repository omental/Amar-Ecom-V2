from pathlib import Path
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings
from app.services.media_storage import media_storage_root


app = FastAPI(title=settings.APP_NAME)
uploads_root = Path(__file__).resolve().parents[1] / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
local_media_root = media_storage_root()
local_media_root.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
    allow_origin_regex=(
        rf"^https://[a-z0-9](?:[a-z0-9-]{{0,61}}[a-z0-9])?\.{re.escape(settings.STOREFRONT_BASE_DOMAIN)}$"
        rf"|^http://[a-z0-9](?:[a-z0-9-]{{0,61}}[a-z0-9])?\.{re.escape(settings.STOREFRONT_DEV_BASE_DOMAIN)}(?::{settings.STOREFRONT_DEV_PORT})?$"
    ),
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
app.mount("/media", StaticFiles(directory=local_media_root), name="media-files")
