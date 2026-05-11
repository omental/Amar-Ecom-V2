import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BusinessSettings(Base):
    __tablename__ = "business_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Amar eCom", server_default="Amar eCom")
    business_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    business_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="BDT", server_default="BDT")
    timezone: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Asia/Dhaka",
        server_default="Asia/Dhaka",
    )
    invoice_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="INV", server_default="INV")
    order_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="ORD", server_default="ORD")
    low_stock_default_threshold: Mapped[int] = mapped_column(nullable=False, default=5, server_default="5")
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0, server_default="0")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
