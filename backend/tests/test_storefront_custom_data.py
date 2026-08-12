import pytest
from fastapi import HTTPException

from app.services.storefront_custom_data_service import validate_custom_value
from app.api.routes.storefront_custom_data import _uses_dynamic_field


def test_custom_value_validation_covers_supported_scalar_types():
    assert validate_custom_value("Cotton", "single_line_text", {}) == "Cotton"
    assert validate_custom_value("12", "integer", {"min": 10, "max": 20}) == 12
    assert validate_custom_value("19.95", "money", {}) == "19.95"
    assert validate_custom_value(True, "boolean", {}) is True
    assert validate_custom_value("2026-08-11", "date", {}) == "2026-08-11"
    assert validate_custom_value("/products/shirt", "url", {}) == "/products/shirt"


def test_custom_value_validation_rejects_unsafe_and_invalid_values():
    with pytest.raises(HTTPException): validate_custom_value("javascript:alert(1)", "url", {})
    with pytest.raises(HTTPException): validate_custom_value("one\ntwo", "single_line_text", {})
    with pytest.raises(HTTPException): validate_custom_value(9, "integer", {"min": 10})
    with pytest.raises(HTTPException): validate_custom_value(None, "single_line_text", {}, required=True)


def test_reference_values_use_portable_model_and_entry_handles():
    value = {"model_key": "designer", "entry_handle": "jane_smith"}
    assert validate_custom_value(value, "reference", {}) == value
    with pytest.raises(HTTPException): validate_custom_value({"entry_id": "database-id"}, "reference", {})


def test_dynamic_binding_usage_detection_handles_nested_reference_paths():
    snapshot = {"blocks": [{"props": {"text": {"kind": "dynamic", "source": {"root": "product", "path": ["custom_fields", "custom.designer", "name"], "valueType": "string"}}}}]}
    assert _uses_dynamic_field(snapshot, "product", "custom.designer") is True
    assert _uses_dynamic_field(snapshot, "product", "custom.material") is False
