import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False, default="info", server_default="info", index=True)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    module: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="notifications")
