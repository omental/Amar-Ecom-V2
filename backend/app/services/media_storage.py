from __future__ import annotations

import io
import os
import uuid
import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


SUPPORTED_IMAGE_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}
SUPPORTED_DECLARED_MIME_TYPES = {item[0] for item in SUPPORTED_IMAGE_FORMATS.values()}


@dataclass(frozen=True)
class ValidatedImage:
    content: bytes
    mime_type: str
    extension: str
    width: int
    height: int


class MediaStorage(ABC):
    @abstractmethod
    def save(self, content: bytes, extension: str) -> tuple[str, str]:
        """Return the provider-neutral storage key and generated filename."""

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        """Delete an object if it exists."""


class LocalMediaStorage(MediaStorage):
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, storage_key: str) -> Path:
        normalized = PurePosixPath(storage_key)
        if normalized.is_absolute() or ".." in normalized.parts:
            raise ValueError("Invalid media storage key")
        target = (self.root / Path(*normalized.parts)).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError("Invalid media storage key")
        return target

    def save(self, content: bytes, extension: str) -> tuple[str, str]:
        now = datetime.now(timezone.utc)
        filename = f"{uuid.uuid4().hex}{extension}"
        storage_key = PurePosixPath(str(now.year), f"{now.month:02d}", filename).as_posix()
        target = self._safe_path(storage_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as media_file:
            media_file.write(content)
        return storage_key, filename

    def delete(self, storage_key: str) -> None:
        target = self._safe_path(storage_key)
        if target.is_file():
            target.unlink()
        parent = target.parent
        while parent != self.root and parent.exists():
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent


def media_storage_root() -> Path:
    configured = Path(settings.MEDIA_STORAGE_ROOT).expanduser()
    if configured.is_absolute():
        return configured.resolve()
    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / configured).resolve()


def get_media_storage() -> MediaStorage:
    if settings.MEDIA_STORAGE_DRIVER.lower() != "local":
        raise RuntimeError(f"Unsupported media storage driver: {settings.MEDIA_STORAGE_DRIVER}")
    return LocalMediaStorage(media_storage_root())


async def read_and_validate_image(file: UploadFile) -> ValidatedImage:
    if file.content_type not in SUPPORTED_DECLARED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Supported image types are JPEG, PNG, and WebP.",
        )

    max_bytes = settings.MEDIA_MAX_UPLOAD_MB * 1024 * 1024
    chunks: list[bytes] = []
    received = 0
    while chunk := await file.read(1024 * 1024):
        received += len(chunk)
        if received > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Image exceeds the {settings.MEDIA_MAX_UPLOAD_MB} MB upload limit.",
            )
        chunks.append(chunk)
    content = b"".join(chunks)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as probe:
                image_format = (probe.format or "").upper()
                dimensions = probe.size
                probe.verify()
            with Image.open(io.BytesIO(content)) as decoded:
                decoded.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid decodable image.",
        ) from exc

    if image_format not in SUPPORTED_IMAGE_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Supported image types are JPEG, PNG, and WebP.",
        )
    mime_type, extension = SUPPORTED_IMAGE_FORMATS[image_format]
    if mime_type != file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file content does not match its declared image type.",
        )
    width, height = dimensions
    if width < 1 or height < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image dimensions are invalid.")
    return ValidatedImage(content, mime_type, extension, width, height)


def safe_original_filename(filename: str | None) -> str:
    original = os.path.basename((filename or "image").replace("\\", "/"))
    return original[:255] or "image"


def build_media_public_url(storage_key: str, request_base_url: str) -> str:
    encoded_key = "/".join(quote(part, safe="") for part in PurePosixPath(storage_key).parts)
    if settings.MEDIA_PUBLIC_BASE_URL:
        base = settings.MEDIA_PUBLIC_BASE_URL.rstrip("/")
        if base.startswith("/"):
            return f"{request_base_url.rstrip('/')}{base}/{encoded_key}"
        return f"{base}/{encoded_key}"
    return f"{request_base_url.rstrip('/')}/media/{encoded_key}"
