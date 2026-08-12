from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import ORMBaseSchema


MENU_LOCATIONS = (
    "main_nav",
    "category_nav",
    "footer_services",
    "footer_join_us",
    "footer_social",
    "footer_quick_links",
)

PAGE_TYPES = ("home", "custom", "policy", "landing")
PAGE_STATUSES = ("draft", "published")
SECTION_TYPES = (
    "hero_slider",
    "product_grid",
    "category_grid",
    "banner_grid",
    "single_banner",
    "flash_sale",
    "best_selling",
    "new_arrivals",
    "featured_collection",
    "text_block",
    "image_text",
    "newsletter",
    "faq",
    "testimonials",
    "brand_strip",
    "flexible_grid",
    "announcement_bar",
    "header",
    "footer",
    "product_main",
    "collection_main",
    "page_main",
    "search_results",
    "cart_main",
    "not_found_main",
)
REVISION_TYPES = ("page", "template_apply", "publish", "theme_settings", "theme_publish")
THEME_STATUSES = ("draft", "published", "archived")
TEMPLATE_RESOURCE_TYPES = ("home", "product", "collection", "page", "search", "cart", "not_found")
MEDIA_TYPES = ("logo", "favicon", "banner", "category", "product", "section", "general")
TEMPLATE_KEYS = ("live_shopping_classic", "minimal_fashion", "electronics_deals")
TYPOGRAPHY_PRESETS = ("default_sans", "modern_commerce", "elegant_fashion", "bold_deal_store", "premium_editorial")
COLOR_PRESETS = ("live_red", "premium_black", "fashion_rose", "electronics_blue", "organic_green", "luxury_gold")
ANIMATION_PRESETS = ("none", "subtle_fade", "slide_up", "scale_in", "premium_smooth", "deal_pop")
PRODUCT_CARD_STYLES = ("compact_deal", "image_first", "premium_card", "minimal_grid")
BUTTON_STYLES = ("sharp", "rounded", "pill", "bold_block")
HEADER_LAYOUTS = ("search_heavy", "minimal", "centered_logo", "category_first")
FOOTER_LAYOUTS = ("simple", "multi_column", "brand_story")
SPACING_DENSITIES = ("compact", "balanced", "airy")
CORNER_RADII = ("sharp", "soft", "rounded")
SHADOW_STYLES = ("none", "soft", "premium")


def _validate_choice(value: str, field_name: str, allowed: tuple[str, ...]) -> str:
    if value not in allowed:
        raise ValueError(f"Invalid {field_name}. Allowed values: {', '.join(allowed)}")
    return value


class StorefrontSettingBase(BaseModel):
    brand_name: str | None = None
    logo_url: str | None = None
    favicon_url: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    active_template_key: str | None = None
    typography_preset: str | None = None
    color_preset: str | None = None
    animation_preset: str | None = None
    product_card_style: str | None = None
    button_style: str | None = None
    header_layout: str | None = None
    footer_layout: str | None = None
    spacing_density: str | None = None
    corner_radius: str | None = None
    shadow_style: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None
    secondary_color: str | None = None
    currency: str | None = None
    show_topbar: bool | None = None
    show_search: bool | None = None
    show_cart: bool | None = None
    show_track_order: bool | None = None
    inside_dhaka_delivery_charge: float | None = None
    outside_dhaka_delivery_charge: float | None = None
    free_delivery_minimum: float | None = None
    footer_description: str | None = None
    footer_copyright_text: str | None = None
    social_share_image_url: str | None = None
    social_links: dict[str, Any] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    is_active: bool | None = None

    @field_validator(
        "inside_dhaka_delivery_charge",
        "outside_dhaka_delivery_charge",
        "free_delivery_minimum",
    )
    @classmethod
    def validate_non_negative_amount(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("Amount cannot be negative")
        return value

    @field_validator("active_template_key")
    @classmethod
    def validate_template_key(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "template key", TEMPLATE_KEYS)

    @field_validator("typography_preset")
    @classmethod
    def validate_typography_preset(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "typography preset", TYPOGRAPHY_PRESETS)

    @field_validator("color_preset")
    @classmethod
    def validate_color_preset(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "color preset", COLOR_PRESETS)

    @field_validator("animation_preset")
    @classmethod
    def validate_animation_preset(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "animation preset", ANIMATION_PRESETS)

    @field_validator("product_card_style")
    @classmethod
    def validate_product_card_style(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "product card style", PRODUCT_CARD_STYLES)

    @field_validator("button_style")
    @classmethod
    def validate_button_style(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "button style", BUTTON_STYLES)

    @field_validator("header_layout")
    @classmethod
    def validate_header_layout(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "header layout", HEADER_LAYOUTS)

    @field_validator("footer_layout")
    @classmethod
    def validate_footer_layout(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "footer layout", FOOTER_LAYOUTS)

    @field_validator("spacing_density")
    @classmethod
    def validate_spacing_density(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "spacing density", SPACING_DENSITIES)

    @field_validator("corner_radius")
    @classmethod
    def validate_corner_radius(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "corner radius", CORNER_RADII)

    @field_validator("shadow_style")
    @classmethod
    def validate_shadow_style(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "shadow style", SHADOW_STYLES)


class StorefrontSettingUpdate(StorefrontSettingBase):
    pass


class StorefrontSettingRead(ORMBaseSchema):
    id: UUID
    brand_name: str
    logo_url: str | None = None
    favicon_url: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    active_template_key: Literal["live_shopping_classic", "minimal_fashion", "electronics_deals"]
    typography_preset: Literal["default_sans", "modern_commerce", "elegant_fashion", "bold_deal_store", "premium_editorial"]
    color_preset: Literal["live_red", "premium_black", "fashion_rose", "electronics_blue", "organic_green", "luxury_gold"]
    animation_preset: Literal["none", "subtle_fade", "slide_up", "scale_in", "premium_smooth", "deal_pop"]
    product_card_style: Literal["compact_deal", "image_first", "premium_card", "minimal_grid"]
    button_style: Literal["sharp", "rounded", "pill", "bold_block"]
    header_layout: Literal["search_heavy", "minimal", "centered_logo", "category_first"]
    footer_layout: Literal["simple", "multi_column", "brand_story"]
    spacing_density: Literal["compact", "balanced", "airy"]
    corner_radius: Literal["sharp", "soft", "rounded"]
    shadow_style: Literal["none", "soft", "premium"]
    primary_color: str
    accent_color: str | None = None
    secondary_color: str | None = None
    currency: str
    show_topbar: bool
    show_search: bool
    show_cart: bool
    show_track_order: bool
    inside_dhaka_delivery_charge: float
    outside_dhaka_delivery_charge: float
    free_delivery_minimum: float | None = None
    footer_description: str | None = None
    footer_copyright_text: str | None = None
    social_share_image_url: str | None = None
    social_links: dict[str, Any] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StorefrontMenuItemBase(BaseModel):
    label: str
    url: str
    target: str = "_self"
    sort_order: int = 0
    parent_id: UUID | None = None
    is_active: bool = True


class StorefrontMenuItemCreate(StorefrontMenuItemBase):
    pass


class StorefrontMenuItemUpdate(BaseModel):
    label: str | None = None
    url: str | None = None
    target: str | None = None
    sort_order: int | None = None
    parent_id: UUID | None = None
    is_active: bool | None = None


class StorefrontMenuBase(BaseModel):
    name: str
    location: str
    is_active: bool = True

    @field_validator("location")
    @classmethod
    def validate_location(cls, value: str) -> str:
        return _validate_choice(value, "menu location", MENU_LOCATIONS)


class StorefrontMenuCreate(StorefrontMenuBase):
    pass


class StorefrontMenuUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    is_active: bool | None = None

    @field_validator("location")
    @classmethod
    def validate_location(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "menu location", MENU_LOCATIONS)


class StorefrontMenuItemRead(ORMBaseSchema):
    id: UUID
    label: str
    url: str
    target: str
    sort_order: int
    parent_id: UUID | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    children: list["StorefrontMenuItemRead"] = []


class StorefrontMenuRead(ORMBaseSchema):
    id: UUID
    name: str
    location: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[StorefrontMenuItemRead] = []


class MenuItemsReorderInput(BaseModel):
    ordered_ids: list[UUID] = Field(default_factory=list)


class StorefrontPageBase(BaseModel):
    title: str
    slug: str
    page_type: str = "custom"
    content: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    status: str = "draft"
    is_system: bool = False
    template_id: UUID | None = None

    @field_validator("page_type")
    @classmethod
    def validate_page_type(cls, value: str) -> str:
        return _validate_choice(value, "page type", PAGE_TYPES)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _validate_choice(value, "page status", PAGE_STATUSES)


class StorefrontPageCreate(StorefrontPageBase):
    pass


class StorefrontPageUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    page_type: str | None = None
    content: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    status: str | None = None
    template_id: UUID | None = None

    @field_validator("page_type")
    @classmethod
    def validate_page_type(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "page type", PAGE_TYPES)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "page status", PAGE_STATUSES)


class StorefrontSectionBase(BaseModel):
    type: str
    title: str | None = None
    subtitle: str | None = None
    sort_order: int = 0
    is_enabled: bool = True
    settings: dict[str, Any] | None = None
    content: dict[str, Any] | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        return _validate_choice(value, "section type", SECTION_TYPES)


class StorefrontSectionCreate(StorefrontSectionBase):
    pass


class StorefrontSectionUpdate(BaseModel):
    type: str | None = None
    title: str | None = None
    subtitle: str | None = None
    sort_order: int | None = None
    is_enabled: bool | None = None
    settings: dict[str, Any] | None = None
    content: dict[str, Any] | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_choice(value, "section type", SECTION_TYPES)


class SectionsReorderInput(BaseModel):
    ordered_ids: list[UUID] = Field(default_factory=list)


class StorefrontSectionRead(ORMBaseSchema):
    id: UUID
    page_id: UUID | None = None
    template_id: UUID | None = None
    section_group_id: UUID | None = None
    type: str
    title: str | None = None
    subtitle: str | None = None
    sort_order: int
    is_enabled: bool
    settings: dict[str, Any] | None = None
    content: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class StorefrontThemeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*$")
    description: str | None = Field(default=None, max_length=2000)
    version: str = Field(default="1.0.0", min_length=1, max_length=50)
    preview_image_url: str | None = Field(default=None, max_length=500)
    settings: dict[str, Any] = Field(default_factory=dict)


class StorefrontThemeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    version: str | None = Field(default=None, min_length=1, max_length=50)
    preview_image_url: str | None = Field(default=None, max_length=500)
    settings: dict[str, Any] | None = None


class StorefrontTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*$")
    resource_type: Literal["home", "product", "collection", "page", "search", "cart", "not_found"]
    is_default: bool = False
    settings: dict[str, Any] = Field(default_factory=dict)
    base_template_id: UUID | None = None


class StorefrontTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    key: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*$")
    is_default: bool | None = None
    settings: dict[str, Any] | None = None


class StorefrontSectionGroupRead(ORMBaseSchema):
    id: UUID
    theme_id: UUID
    name: str
    group_type: str
    created_at: datetime
    updated_at: datetime
    sections: list[StorefrontSectionRead] = Field(default_factory=list)


class StorefrontTemplateRead(ORMBaseSchema):
    id: UUID
    theme_id: UUID
    name: str
    key: str
    resource_type: str
    is_default: bool
    settings: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    sections: list[StorefrontSectionRead] = Field(default_factory=list)


STYLE_PROPERTY_KEYS = {
    "display", "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight", "aspectRatio", "flexDirection", "flexWrap",
    "justifyContent", "alignItems", "alignContent", "gap", "rowGap", "columnGap", "flexGrow", "flexShrink", "flexBasis",
    "gridColumns", "gridTemplateColumns", "gridAutoRows", "gridAutoFlow", "placeItems", "position", "top", "right", "bottom",
    "left", "zIndex", "overflow", "overflowX", "overflowY", "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight",
    "letterSpacing", "textTransform", "textDecoration", "textAlign", "color", "whiteSpace", "backgroundColor", "backgroundGradient",
    "backgroundImageValue", "backgroundOverlay", "borderStyle", "borderColor", "borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
    "borderLeftWidth", "borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius",
    "shadow", "opacity", "visibility", "transformValue", "transitionValue", "filters", "objectFit", "objectPosition", "margin", "padding",
}


def _validate_style_dict(value: dict[str, Any]) -> dict[str, Any]:
    unknown = set(value) - STYLE_PROPERTY_KEYS
    if unknown:
        raise ValueError(f"Unsupported style properties: {', '.join(sorted(unknown))}")
    return value


def _validate_style_states(value: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    unknown = set(value) - {"base", "hover", "focus", "active"}
    if unknown:
        raise ValueError(f"Unsupported style states: {', '.join(sorted(unknown))}")
    return {state: _validate_style_dict(rules) for state, rules in value.items()}


def _validate_responsive_styles(value: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    unknown = set(value) - {"desktop", "tablet", "mobile"}
    if unknown:
        raise ValueError(f"Unsupported breakpoints: {', '.join(sorted(unknown))}")
    return {breakpoint: _validate_style_states(states) for breakpoint, states in value.items()}


class StorefrontStyleClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z][a-zA-Z0-9_-]*$")
    styles: dict[str, Any] = Field(default_factory=dict)
    responsive: dict[str, dict[str, Any]] = Field(default_factory=dict)
    states: dict[str, dict[str, Any]] = Field(default_factory=dict)

    @field_validator("styles")
    @classmethod
    def validate_styles(cls, value: dict[str, Any]) -> dict[str, Any]:
        return _validate_style_dict(value)

    @field_validator("states")
    @classmethod
    def validate_states(cls, value: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return _validate_style_states(value)

    @field_validator("responsive")
    @classmethod
    def validate_responsive(cls, value: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return _validate_responsive_styles(value)


class StorefrontStyleClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"^[a-zA-Z][a-zA-Z0-9_-]*$")
    styles: dict[str, Any] | None = None
    responsive: dict[str, dict[str, Any]] | None = None
    states: dict[str, dict[str, Any]] | None = None

    @field_validator("styles")
    @classmethod
    def validate_styles(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return _validate_style_dict(value) if value is not None else None

    @field_validator("states")
    @classmethod
    def validate_states(cls, value: dict[str, dict[str, Any]] | None) -> dict[str, dict[str, Any]] | None:
        return _validate_style_states(value) if value is not None else None

    @field_validator("responsive")
    @classmethod
    def validate_responsive(cls, value: dict[str, dict[str, Any]] | None) -> dict[str, dict[str, Any]] | None:
        return _validate_responsive_styles(value) if value is not None else None


class StorefrontStyleClassRead(ORMBaseSchema):
    id: UUID
    theme_id: UUID
    name: str
    styles: dict[str, Any] = Field(default_factory=dict)
    responsive: dict[str, dict[str, Any]] = Field(default_factory=dict)
    states: dict[str, dict[str, Any]] = Field(default_factory=dict)
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime


class StorefrontThemeRead(ORMBaseSchema):
    id: UUID
    name: str
    key: str
    status: str
    version: str
    description: str | None = None
    preview_image_url: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    created_by_id: UUID | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    templates: list[StorefrontTemplateRead] = Field(default_factory=list)
    section_groups: list[StorefrontSectionGroupRead] = Field(default_factory=list)
    style_classes: list[StorefrontStyleClassRead] = Field(default_factory=list)


class StorefrontThemePublishResponse(BaseModel):
    theme: StorefrontThemeRead
    revision_id: UUID
    message: str


class StorefrontResourceAssignment(BaseModel):
    template_id: UUID | None = None


class StorefrontResolvedTemplateRead(BaseModel):
    theme: StorefrontThemeRead
    template: StorefrontTemplateRead
    header_group: StorefrontSectionGroupRead | None = None
    footer_group: StorefrontSectionGroupRead | None = None
    resource_type: str
    resource_id: UUID | None = None
    resource_slug: str | None = None


class StorefrontSavedSectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    category: str = Field(default="custom", min_length=1, max_length=100)
    snapshot: dict = Field(default_factory=dict)


class StorefrontSavedSectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    snapshot: dict | None = None


class StorefrontSavedSectionRead(ORMBaseSchema):
    id: UUID
    name: str
    description: str | None = None
    category: str
    snapshot: dict
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class StorefrontPageRead(ORMBaseSchema):
    id: UUID
    title: str
    slug: str
    page_type: str
    content: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    status: str
    is_system: bool
    last_published_at: datetime | None = None
    template_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    sections: list[StorefrontSectionRead] = []


class StorefrontPagePublishResponse(BaseModel):
    id: UUID
    status: str
    last_published_at: datetime | None = None
    revision_id: UUID | None = None
    message: str | None = None


class StorefrontBannerBase(BaseModel):
    title: str
    subtitle: str | None = None
    image_url: str
    mobile_image_url: str | None = None
    button_text: str | None = None
    button_url: str | None = None
    location: str | None = None
    sort_order: int = 0
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class StorefrontBannerCreate(StorefrontBannerBase):
    pass


class StorefrontBannerUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    image_url: str | None = None
    mobile_image_url: str | None = None
    button_text: str | None = None
    button_url: str | None = None
    location: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class StorefrontBannerRead(ORMBaseSchema):
    id: UUID
    title: str
    subtitle: str | None = None
    image_url: str
    mobile_image_url: str | None = None
    button_text: str | None = None
    button_url: str | None = None
    location: str | None = None
    sort_order: int
    is_active: bool
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class StorefrontCouponBase(BaseModel):
    code: str
    type: Literal["fixed", "percentage"]
    value: float = Field(gt=0)
    min_order_amount: float = Field(default=0, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = Field(default=None, gt=0)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Coupon code is required")
        return normalized

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: float, info) -> float:
        coupon_type = info.data.get("type")
        if coupon_type == "percentage" and value > 100:
            raise ValueError("Percentage coupon value cannot exceed 100")
        return value


class StorefrontCouponCreate(StorefrontCouponBase):
    pass


class StorefrontCouponUpdate(BaseModel):
    code: str | None = None
    type: Literal["fixed", "percentage"] | None = None
    value: float | None = Field(default=None, gt=0)
    min_order_amount: float | None = Field(default=None, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = Field(default=None, gt=0)

    @field_validator("code")
    @classmethod
    def normalize_optional_code(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Coupon code is required")
        return normalized

    @field_validator("value")
    @classmethod
    def validate_optional_value(cls, value: float | None, info) -> float | None:
        if value is None:
            return value
        coupon_type = info.data.get("type")
        if coupon_type == "percentage" and value > 100:
            raise ValueError("Percentage coupon value cannot exceed 100")
        return value


class StorefrontCouponRead(ORMBaseSchema):
    id: UUID
    code: str
    type: Literal["fixed", "percentage"]
    value: float
    min_order_amount: float
    max_discount_amount: float | None = None
    active: bool
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = None
    usage_count: int
    created_at: datetime
    updated_at: datetime


class StorefrontMediaRead(ORMBaseSchema):
    id: UUID
    file_name: str
    original_name: str
    mime_type: str
    file_size: int
    url: str
    storage_path: str
    media_type: str
    alt_text: str | None = None
    uploaded_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class StorefrontMediaUploadResponse(StorefrontMediaRead):
    pass


class PublicStorefrontMenuItem(BaseModel):
    label: str
    url: str
    target: str = "_self"
    children: list["PublicStorefrontMenuItem"] = []


class PublicStorefrontSection(BaseModel):
    id: UUID
    type: str
    title: str | None = None
    subtitle: str | None = None
    sort_order: int
    settings: dict[str, Any] | None = None
    content: dict[str, Any] | None = None
    products: list["PublicStorefrontProductCard"] = []


class PublicStorefrontPage(BaseModel):
    title: str
    slug: str
    seo_title: str | None = None
    seo_description: str | None = None
    content: str | None = None
    custom_fields: dict[str, Any] = {}
    sections: list[PublicStorefrontSection] = []


class PublicStorefrontResponse(BaseModel):
    settings: "PublicStorefrontSetting"
    menus: dict[str, list[PublicStorefrontMenuItem]]
    page: PublicStorefrontPage
    theme: StorefrontThemeRead | None = None


class PublicStorefrontSetting(BaseModel):
    brand_name: str
    logo_url: str | None = None
    favicon_url: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    active_template_key: Literal["live_shopping_classic", "minimal_fashion", "electronics_deals"]
    typography_preset: Literal["default_sans", "modern_commerce", "elegant_fashion", "bold_deal_store", "premium_editorial"]
    color_preset: Literal["live_red", "premium_black", "fashion_rose", "electronics_blue", "organic_green", "luxury_gold"]
    animation_preset: Literal["none", "subtle_fade", "slide_up", "scale_in", "premium_smooth", "deal_pop"]
    product_card_style: Literal["compact_deal", "image_first", "premium_card", "minimal_grid"]
    button_style: Literal["sharp", "rounded", "pill", "bold_block"]
    header_layout: Literal["search_heavy", "minimal", "centered_logo", "category_first"]
    footer_layout: Literal["simple", "multi_column", "brand_story"]
    spacing_density: Literal["compact", "balanced", "airy"]
    corner_radius: Literal["sharp", "soft", "rounded"]
    shadow_style: Literal["none", "soft", "premium"]
    primary_color: str
    accent_color: str | None = None
    secondary_color: str | None = None
    currency: str
    show_topbar: bool
    show_search: bool
    show_cart: bool
    show_track_order: bool
    inside_dhaka_delivery_charge: float
    outside_dhaka_delivery_charge: float
    free_delivery_minimum: float | None = None
    footer_description: str | None = None
    footer_copyright_text: str | None = None
    social_share_image_url: str | None = None
    social_links: dict[str, Any] | None = None
    seo_title: str | None = None
    seo_description: str | None = None


class StorefrontOverviewRead(BaseModel):
    storefront_status: Literal["active", "inactive"]
    homepage_sections_count: int
    menus_count: int
    published_pages_count: int
    banners_count: int


class PublicStorefrontProductCard(BaseModel):
    id: str
    slug: str
    name: str
    image_url: str | None = None
    price: float
    old_price: float | None = None
    category: str | None = None
    badge: str | None = None
    stock_status: Literal["in_stock", "low_stock", "out_of_stock"]


class StorefrontProductPickerItem(BaseModel):
    id: str
    slug: str
    name: str
    image: str | None = None
    price: float
    compare_price: float | None = None
    category_name: str | None = None
    stock_status: Literal["in_stock", "low_stock", "out_of_stock"]


class StorefrontProductPickerResponse(BaseModel):
    items: list[StorefrontProductPickerItem]
    page: int
    limit: int
    total: int


class PublicStorefrontOrderItemInput(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1)
    selected_size: str | None = None
    selected_color: str | None = None


class PublicStorefrontOrderCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=5, max_length=50)
    alternative_phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    district: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=2000)
    delivery_note: str | None = Field(default=None, max_length=2000)
    delivery_zone: Literal["inside_dhaka", "outside_dhaka"] = "inside_dhaka"
    coupon_code: str | None = Field(default=None, max_length=100)
    payment_method: Literal["cash_on_delivery"] = "cash_on_delivery"
    items: list[PublicStorefrontOrderItemInput] = Field(min_length=1)


class PublicStorefrontOrderCreateResponse(BaseModel):
    public_order_code: str
    tracking_code: str
    status: str
    discount_total: float
    subtotal: float
    delivery_charge: float
    total: float
    delivery_zone: Literal["inside_dhaka", "outside_dhaka"]
    coupon_code: str | None = None
    created_at: datetime


class PublicStorefrontTrackedOrderItem(BaseModel):
    product_name: str
    quantity: int
    price: float
    total: float


class PublicStorefrontOrderTimelineItem(BaseModel):
    label: str
    status: str
    completed: bool
    timestamp: datetime | None = None


class PublicStorefrontTrackedOrder(BaseModel):
    tracking_code: str
    status: str
    created_at: datetime
    customer_name: str | None = None
    customer_phone_masked: str | None = None
    items: list[PublicStorefrontTrackedOrderItem]
    discount_total: float
    subtotal: float
    delivery_charge: float
    total: float
    delivery_zone: Literal["inside_dhaka", "outside_dhaka"] = "inside_dhaka"
    coupon_code: str | None = None
    timeline: list[PublicStorefrontOrderTimelineItem]


class PublicStorefrontCouponValidateItem(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1)


class PublicStorefrontCouponValidateInput(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    delivery_zone: Literal["inside_dhaka", "outside_dhaka"] = "inside_dhaka"
    items: list[PublicStorefrontCouponValidateItem] = Field(min_length=1)


class PublicStorefrontCouponValidateResponse(BaseModel):
    code: str
    discount_type: Literal["fixed", "percentage"]
    discount_total: float
    subtotal: float
    delivery_charge: float
    total: float
    message: str | None = None


class StorefrontTemplateSectionPreset(BaseModel):
    type: str
    title: str | None = None
    subtitle: str | None = None
    settings: dict[str, Any] | None = None
    content: dict[str, Any] | None = None


class StorefrontTemplatePresetRead(BaseModel):
    key: Literal["live_shopping_classic", "minimal_fashion", "electronics_deals"]
    name: str
    description: str
    best_for: str
    recommended_typography_preset: Literal["default_sans", "modern_commerce", "elegant_fashion", "bold_deal_store", "premium_editorial"]
    recommended_color_preset: Literal["live_red", "premium_black", "fashion_rose", "electronics_blue", "organic_green", "luxury_gold"]
    recommended_animation_preset: Literal["none", "subtle_fade", "slide_up", "scale_in", "premium_smooth", "deal_pop"]
    header_layout: Literal["search_heavy", "minimal", "centered_logo", "category_first"]
    footer_layout: Literal["simple", "multi_column", "brand_story"]
    product_card_style: Literal["compact_deal", "image_first", "premium_card", "minimal_grid"]
    button_style: Literal["sharp", "rounded", "pill", "bold_block"]
    spacing_density: Literal["compact", "balanced", "airy"]
    corner_radius: Literal["sharp", "soft", "rounded"]
    shadow_style: Literal["none", "soft", "premium"]
    default_homepage_sections: list[StorefrontTemplateSectionPreset]


class StorefrontTemplateApplyInput(BaseModel):
    replace_homepage: bool = False


class StorefrontRevisionRead(BaseModel):
    id: UUID
    page_id: UUID | None = None
    theme_id: UUID | None = None
    revision_type: Literal["page", "template_apply", "publish", "theme_settings", "theme_publish"]
    title: str
    snapshot: dict[str, Any]
    created_by_id: UUID | None = None
    created_by_name: str | None = None
    created_at: datetime


class StorefrontRevisionRestoreResponse(BaseModel):
    revision_id: UUID
    restored_page_id: UUID | None = None
    message: str


class StorefrontTemplateApplyResponse(BaseModel):
    applied_template_key: Literal["live_shopping_classic", "minimal_fashion", "electronics_deals"]
    revision_id: UUID
    message: str
    page: StorefrontPageRead


StorefrontMenuItemRead.model_rebuild()
PublicStorefrontMenuItem.model_rebuild()
PublicStorefrontSection.model_rebuild()
