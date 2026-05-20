import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


_PREFIX = "enc::"


def _derive_fernet_key(secret: str) -> str:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def _resolve_fernet_key() -> tuple[str, str]:
    if settings.FERNET_SECRET_KEY:
        return settings.FERNET_SECRET_KEY, "FERNET_SECRET_KEY"
    if settings.APP_SECRET_KEY:
        return _derive_fernet_key(settings.APP_SECRET_KEY), "APP_SECRET_KEY"
    return _derive_fernet_key(settings.SECRET_KEY), "SECRET_KEY"


def get_secret_key_source() -> str:
    return _resolve_fernet_key()[1]


def is_dedicated_secret_key_configured() -> bool:
    return bool(settings.FERNET_SECRET_KEY or settings.APP_SECRET_KEY)


def encrypt_secret(value: str) -> str:
    if not value:
        return value
    key, _ = _resolve_fernet_key()
    token = Fernet(key.encode("utf-8")).encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{_PREFIX}{token}"


def decrypt_secret(value: str) -> str:
    if not value:
        return value
    if not value.startswith(_PREFIX):
        return value

    encrypted_value = value[len(_PREFIX) :]
    key, _ = _resolve_fernet_key()
    try:
        return Fernet(key.encode("utf-8")).decrypt(encrypted_value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored secret could not be decrypted with the configured encryption key.") from exc


def mask_secret(value: str) -> str:
    if not value:
        return ""
    trimmed = value.strip()
    if len(trimmed) <= 6:
        return "*" * len(trimmed)
    return f"{trimmed[:4]}{'*' * max(len(trimmed) - 6, 4)}{trimmed[-2:]}"


def is_encrypted_secret(value: str | None) -> bool:
    return bool(value and value.startswith(_PREFIX))
