from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ORMBaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedSchema(ORMBaseSchema):
    created_at: datetime
    updated_at: datetime


class UUIDSchema(ORMBaseSchema):
    id: UUID


DecimalNumber = Decimal
