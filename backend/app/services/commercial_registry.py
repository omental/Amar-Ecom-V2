from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal


FeatureValue = bool | int | float | str | None
FeatureValueType = Literal["boolean", "integer", "decimal", "string", "enum"]


@dataclass(frozen=True, slots=True)
class RegisteredFeature:
    key: str
    name: str
    category: str
    value_type: FeatureValueType
    default_value: FeatureValue
    enforcement_type: Literal["feature", "limit", "metered"] = "feature"
    description: str = ""
    choices: tuple[str, ...] = ()


FEATURE_REGISTRY: dict[str, RegisteredFeature] = {
    item.key: item for item in (
        RegisteredFeature("advanced_builder", "Advanced builder", "storefront", "boolean", False),
        RegisteredFeature("advanced_styles", "Advanced visual styles", "storefront", "boolean", False),
        RegisteredFeature("custom_fields", "Custom fields", "storefront", "boolean", False),
        RegisteredFeature("content_models", "Content models", "storefront", "boolean", False),
        RegisteredFeature("saved_sections", "Saved sections", "storefront", "boolean", False),
        RegisteredFeature("product_limit", "Products", "operations", "integer", 0, "limit"),
        RegisteredFeature("staff_limit", "Staff members", "operations", "integer", 0, "limit"),
        RegisteredFeature("warehouse_limit", "Warehouses", "operations", "integer", 0, "limit"),
        RegisteredFeature("store_limit", "Stores", "operations", "integer", 1, "limit"),
        RegisteredFeature("theme_count_limit", "Themes", "storefront", "integer", 1, "limit"),
        RegisteredFeature("media_storage_mb", "Media storage", "operations", "integer", 0, "metered"),
        RegisteredFeature("custom_domain", "Custom domains", "future", "boolean", False),
        RegisteredFeature("amar_dns", "Amar DNS", "future", "boolean", False),
        RegisteredFeature("unified_inbox", "Unified Inbox", "messaging", "boolean", False),
        RegisteredFeature("api_access", "API access", "future", "boolean", False),
        RegisteredFeature("automation", "Automation", "future", "boolean", False),
        RegisteredFeature("facebook_messaging", "Facebook messaging", "future", "boolean", False),
        RegisteredFeature("whatsapp_messaging", "WhatsApp messaging", "future", "boolean", False),
        RegisteredFeature("ai_commerce", "AI commerce", "future", "boolean", False),
        RegisteredFeature("ai_messages_monthly", "AI messages", "future", "integer", 0, "metered"),
    )
}


def validate_feature_value(feature_key: str, value: object) -> FeatureValue:
    definition = FEATURE_REGISTRY.get(feature_key)
    if definition is None:
        raise ValueError(f"Unknown feature: {feature_key}")
    # null is the one canonical unlimited marker, and is only valid for limits/meters.
    if value is None:
        if definition.enforcement_type not in {"limit", "metered"}:
            raise ValueError(f"{feature_key} cannot be unlimited")
        return None
    if definition.value_type == "boolean":
        if type(value) is not bool:
            raise ValueError(f"{feature_key} requires a boolean")
        return value
    if definition.value_type == "integer":
        if type(value) is not int or value < 0:
            raise ValueError(f"{feature_key} requires a non-negative integer or null")
        return value
    if definition.value_type == "decimal":
        if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
            raise ValueError(f"{feature_key} requires a decimal")
        return float(value)
    if definition.value_type in {"string", "enum"}:
        if not isinstance(value, str) or (definition.choices and value not in definition.choices):
            raise ValueError(f"{feature_key} requires a supported string value")
        return value
    raise ValueError(f"Unsupported feature value type: {definition.value_type}")


PLAN_DEFAULTS: dict[str, dict[str, object]] = {
    "legacy": {key: (None if value.enforcement_type in {"limit", "metered"} else True) for key, value in FEATURE_REGISTRY.items()},
    "starter": {
        "advanced_builder": True, "advanced_styles": True, "custom_fields": False, "content_models": False,
        "saved_sections": True, "product_limit": 500, "staff_limit": 2, "warehouse_limit": 1,
        "store_limit": 1, "theme_count_limit": 3, "media_storage_mb": 1024,
    },
    "growth": {
        "advanced_builder": True, "advanced_styles": True, "custom_fields": True, "content_models": True,
        "saved_sections": True, "product_limit": 5000, "staff_limit": 10, "warehouse_limit": 5,
        "store_limit": 3, "theme_count_limit": 10, "media_storage_mb": 10240, "custom_domain": True,
        "api_access": True,
        "unified_inbox": True,
    },
    "pro": {
        "advanced_builder": True, "advanced_styles": True, "custom_fields": True, "content_models": True,
        "saved_sections": True, "product_limit": None, "staff_limit": 50, "warehouse_limit": 20,
        "store_limit": 10, "theme_count_limit": None, "media_storage_mb": 102400,
        "custom_domain": True, "api_access": True, "automation": True, "unified_inbox": True,
    },
    "enterprise": {key: (None if value.enforcement_type in {"limit", "metered"} else True) for key, value in FEATURE_REGISTRY.items()},
}


PLAN_CATALOG = {
    "legacy": {"name": "Legacy Full Access", "description": "Compatibility access for stores created before commercial plans.", "trial_days": 0, "is_public": False, "sort_order": 0},
    "starter": {"name": "Starter", "description": "Core commerce tools for a new storefront.", "trial_days": 0, "is_public": True, "sort_order": 10, "monthly_price_display": "Contact us"},
    "growth": {"name": "Growth", "description": "Advanced storefront and operations for growing merchants.", "trial_days": 14, "is_public": True, "sort_order": 20, "monthly_price_display": "Contact us"},
    "pro": {"name": "Pro", "description": "Higher limits and advanced platform access.", "trial_days": 14, "is_public": True, "sort_order": 30, "monthly_price_display": "Contact us"},
    "enterprise": {"name": "Enterprise", "description": "Configurable access for complex organizations.", "trial_days": 0, "is_public": False, "sort_order": 40},
}


def complete_entitlements(values: dict[str, object]) -> dict[str, FeatureValue]:
    return {
        key: validate_feature_value(key, values.get(key, definition.default_value))
        for key, definition in FEATURE_REGISTRY.items()
    }
