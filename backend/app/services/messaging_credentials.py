import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret
from app.models.messaging import MessagingChannel, MessagingChannelSecret


class MessagingCredentialVault:
    """Encrypted-at-rest channel credentials; plaintext never enters API schemas."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def store(self, channel: MessagingChannel, credentials: dict[str, str]) -> MessagingChannelSecret:
        clean = {key: value for key, value in credentials.items() if isinstance(key, str) and isinstance(value, str) and value}
        secret = await self.db.scalar(select(MessagingChannelSecret).where(MessagingChannelSecret.channel_id == channel.id))
        encrypted = encrypt_secret(json.dumps(clean, separators=(",", ":"), sort_keys=True))
        if secret is None:
            secret = MessagingChannelSecret(store_id=channel.store_id, channel_id=channel.id, credentials_encrypted=encrypted)
            self.db.add(secret)
        else:
            secret.credentials_encrypted = encrypted
            secret.key_version += 1
            secret.rotated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return secret

    async def load_for_provider(self, channel: MessagingChannel) -> dict[str, str]:
        secret = await self.db.scalar(select(MessagingChannelSecret).where(MessagingChannelSecret.channel_id == channel.id))
        if secret is None:
            return {}
        value = json.loads(decrypt_secret(secret.credentials_encrypted))
        if not isinstance(value, dict) or not all(isinstance(key, str) and isinstance(item, str) for key, item in value.items()):
            raise ValueError("Stored messaging credentials are invalid")
        return value

    async def masked_status(self, channel: MessagingChannel) -> dict:
        secret = await self.db.scalar(select(MessagingChannelSecret).where(MessagingChannelSecret.channel_id == channel.id))
        if secret is None:
            return {"configured": False, "key_version": None, "rotated_at": None}
        return {"configured": True, "key_version": secret.key_version, "rotated_at": secret.rotated_at}
