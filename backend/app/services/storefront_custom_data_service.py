from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select

from app.models.storefront import StorefrontContentEntry, StorefrontContentFieldDefinition, StorefrontContentModel


def validate_custom_value(value: Any, value_type: str, validation: dict, required: bool = False) -> Any:
    if value is None or value == "":
        if required:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="A value is required")
        return None
    try:
        if value_type in {"single_line_text", "multiline_text", "url", "color", "image"}:
            result = str(value)
            if value_type == "single_line_text" and any(char in result for char in "\r\n"):
                raise ValueError("must be one line")
            if value_type == "url" and not (result.startswith("/") or result.startswith("https://") or result.startswith("http://")):
                raise ValueError("must be a safe URL")
            if value_type == "color" and not (result.startswith("#") and len(result) in {4, 7, 9}):
                raise ValueError("must be a hex color")
            min_length, max_length = validation.get("min_length"), validation.get("max_length")
            if min_length is not None and len(result) < int(min_length): raise ValueError("is too short")
            if max_length is not None and len(result) > int(max_length): raise ValueError("is too long")
            return result
        if value_type == "integer": result = int(value)
        elif value_type in {"decimal", "money"}: result = str(Decimal(str(value)))
        elif value_type == "boolean":
            if not isinstance(value, bool): raise ValueError("must be boolean")
            return value
        elif value_type == "date": return date.fromisoformat(str(value)).isoformat()
        elif value_type == "reference":
            if not isinstance(value, dict) or not isinstance(value.get("model_key"), str) or not isinstance(value.get("entry_handle"), str):
                raise ValueError("must contain model_key and entry_handle")
            return {"model_key": value["model_key"], "entry_handle": value["entry_handle"]}
        else: raise ValueError("unsupported value type")
        minimum, maximum = validation.get("min"), validation.get("max")
        numeric = Decimal(str(result))
        if minimum is not None and numeric < Decimal(str(minimum)): raise ValueError("is below minimum")
        if maximum is not None and numeric > Decimal(str(maximum)): raise ValueError("is above maximum")
        return result
    except (ValueError, TypeError, InvalidOperation) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Invalid {value_type} value: {exc}") from exc


async def validate_entry_values(db, model_id, values: dict[str, Any]) -> dict[str, Any]:
    fields = (await db.execute(select(StorefrontContentFieldDefinition).where(StorefrontContentFieldDefinition.model_id == model_id))).scalars().all()
    allowed = {field.key: field for field in fields}
    unknown = set(values) - set(allowed)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown content fields: {', '.join(sorted(unknown))}")
    normalized = {key: validate_custom_value(values.get(key), field.value_type, field.validation, field.is_required) for key, field in allowed.items() if key in values or field.is_required}
    for field in fields:
        if field.value_type == "reference" and normalized.get(field.key):
            reference = normalized[field.key]
            expected = field.validation.get("reference_model_key")
            if expected and reference["model_key"] != expected: raise HTTPException(status_code=422, detail=f"{field.name} references an incompatible model")
            entry = (await db.execute(select(StorefrontContentEntry).join(StorefrontContentModel).where(StorefrontContentModel.key == reference["model_key"], StorefrontContentEntry.handle == reference["entry_handle"]))).scalar_one_or_none()
            if entry is None: raise HTTPException(status_code=422, detail=f"Referenced entry for {field.name} does not exist")
    return normalized
