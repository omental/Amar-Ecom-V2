"""add storefront theme engine

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-08-11
"""

from datetime import datetime, timezone
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storefront_themes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("version", sa.String(length=50), nullable=False, server_default="1.0.0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("preview_image_url", sa.String(length=500), nullable=True),
        sa.Column("settings", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_storefront_themes_key", "storefront_themes", ["key"], unique=True)
    op.create_index("ix_storefront_themes_status", "storefront_themes", ["status"], unique=False)
    op.create_index("ix_storefront_themes_created_by_id", "storefront_themes", ["created_by_id"], unique=False)
    op.create_index("uq_storefront_one_published_theme", "storefront_themes", ["status"], unique=True, postgresql_where=sa.text("status = 'published'"))

    op.create_table(
        "storefront_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("theme_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=30), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("settings", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["theme_id"], ["storefront_themes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("theme_id", "key", name="uq_storefront_template_theme_key"),
    )
    op.create_index("ix_storefront_templates_theme_id", "storefront_templates", ["theme_id"], unique=False)
    op.create_index("ix_storefront_templates_resource_type", "storefront_templates", ["resource_type"], unique=False)
    op.create_index("uq_storefront_template_default", "storefront_templates", ["theme_id", "resource_type"], unique=True, postgresql_where=sa.text("is_default = true"))

    op.create_table(
        "storefront_section_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("theme_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("group_type", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["theme_id"], ["storefront_themes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("theme_id", "group_type", name="uq_storefront_section_group_theme_type"),
    )
    op.create_index("ix_storefront_section_groups_theme_id", "storefront_section_groups", ["theme_id"], unique=False)

    op.add_column("storefront_sections", sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("storefront_sections", sa.Column("section_group_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.alter_column("storefront_sections", "page_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.create_foreign_key("fk_storefront_sections_template_id", "storefront_sections", "storefront_templates", ["template_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_storefront_sections_group_id", "storefront_sections", "storefront_section_groups", ["section_group_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_storefront_sections_template_id", "storefront_sections", ["template_id"], unique=False)
    op.create_index("ix_storefront_sections_section_group_id", "storefront_sections", ["section_group_id"], unique=False)
    op.create_check_constraint("ck_storefront_section_exactly_one_owner", "storefront_sections", "(CASE WHEN page_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN template_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN section_group_id IS NOT NULL THEN 1 ELSE 0 END) = 1")

    op.add_column("products", sa.Column("storefront_template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_products_storefront_template_id", "products", "storefront_templates", ["storefront_template_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_products_storefront_template_id", "products", ["storefront_template_id"], unique=False)
    op.add_column("categories", sa.Column("storefront_template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_categories_storefront_template_id", "categories", "storefront_templates", ["storefront_template_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_categories_storefront_template_id", "categories", ["storefront_template_id"], unique=False)
    op.add_column("storefront_pages", sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_storefront_pages_template_id", "storefront_pages", "storefront_templates", ["template_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_storefront_pages_template_id", "storefront_pages", ["template_id"], unique=False)
    op.add_column("storefront_revisions", sa.Column("theme_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_storefront_revisions_theme_id", "storefront_revisions", "storefront_themes", ["theme_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_storefront_revisions_theme_id", "storefront_revisions", ["theme_id"], unique=False)

    _bootstrap_existing_storefront()


def _bootstrap_existing_storefront() -> None:
    bind = op.get_bind()
    if bind.execute(sa.text("SELECT count(*) FROM storefront_themes")).scalar_one():
        return
    home = bind.execute(sa.text("SELECT id FROM storefront_pages WHERE slug = 'home' LIMIT 1")).mappings().first()
    settings = bind.execute(sa.text("SELECT * FROM storefront_settings LIMIT 1")).mappings().first()
    if home is None or settings is None:
        return
    theme_id = uuid.uuid4()
    presentation_fields = ("typography_preset", "color_preset", "animation_preset", "product_card_style", "button_style", "header_layout", "footer_layout", "spacing_density", "corner_radius", "shadow_style", "primary_color", "accent_color", "secondary_color", "show_topbar", "show_search", "show_cart", "show_track_order")
    theme_settings = {field: settings[field] for field in presentation_fields}
    bind.execute(sa.text("INSERT INTO storefront_themes (id,name,key,status,version,description,settings,published_at) VALUES (:id,'Amar Classic','amar-classic','published','1.0.0','Compatibility theme created from the existing Amar-eCom storefront.',CAST(:settings AS json),:published_at)"), {"id": theme_id, "settings": __import__("json").dumps(theme_settings), "published_at": datetime.now(timezone.utc)})
    definitions = (("Home", "home", "home"), ("Default product", "product-default", "product"), ("Default collection", "collection-default", "collection"), ("Default page", "page-default", "page"), ("Search", "search-default", "search"), ("Cart", "cart-default", "cart"), ("404", "not-found-default", "not_found"))
    system_types = {"product": "product_main", "collection": "collection_main", "page": "page_main", "search": "search_results", "cart": "cart_main", "not_found": "not_found_main"}
    for name, key, resource_type in definitions:
        template_id = uuid.uuid4()
        bind.execute(sa.text("INSERT INTO storefront_templates (id,theme_id,name,key,resource_type,is_default,settings) VALUES (:id,:theme_id,:name,:key,:resource_type,true,CAST('{}' AS json))"), {"id": template_id, "theme_id": theme_id, "name": name, "key": key, "resource_type": resource_type})
        if resource_type == "home":
            legacy_sections = bind.execute(sa.text("SELECT type,title,subtitle,sort_order,is_enabled,settings,content FROM storefront_sections WHERE page_id=:home_id ORDER BY sort_order,created_at"), {"home_id": home["id"]}).mappings().all()
            for section in legacy_sections:
                payload = dict(section)
                payload["settings"] = __import__("json").dumps(payload.get("settings") or {})
                payload["content"] = __import__("json").dumps(payload.get("content") or {})
                bind.execute(sa.text("INSERT INTO storefront_sections (id,page_id,template_id,section_group_id,type,title,subtitle,sort_order,is_enabled,settings,content) VALUES (:id,NULL,:template_id,NULL,:type,:title,:subtitle,:sort_order,:is_enabled,CAST(:settings AS json),CAST(:content AS json))"), {"id": uuid.uuid4(), "template_id": template_id, **payload})
        else:
            section_settings = {"not_found": {"heading": "Page not found", "message": "The page you are looking for does not exist.", "cta_label": "Return home", "cta_url": "/"}}.get(resource_type, {})
            bind.execute(sa.text("INSERT INTO storefront_sections (id,page_id,template_id,section_group_id,type,title,sort_order,is_enabled,settings,content) VALUES (:id,NULL,:template_id,NULL,:type,:title,0,true,CAST(:settings AS json),CAST('{}' AS json))"), {"id": uuid.uuid4(), "template_id": template_id, "type": system_types[resource_type], "title": system_types[resource_type].replace("_", " ").title(), "settings": __import__("json").dumps(section_settings)})
    header_id, footer_id = uuid.uuid4(), uuid.uuid4()
    bind.execute(sa.text("INSERT INTO storefront_section_groups (id,theme_id,name,group_type) VALUES (:header,:theme,'Header Group','header'),(:footer,:theme,'Footer Group','footer')"), {"header": header_id, "footer": footer_id, "theme": theme_id})
    for group_id, section_type, title, order in ((header_id, "announcement_bar", "Announcement Bar", 0), (header_id, "header", "Main Header", 1), (footer_id, "footer", "Main Footer", 0)):
        bind.execute(sa.text("INSERT INTO storefront_sections (id,page_id,template_id,section_group_id,type,title,sort_order,is_enabled,settings,content) VALUES (:id,NULL,NULL,:group_id,:type,:title,:sort_order,true,CAST('{}' AS json),CAST('{}' AS json))"), {"id": uuid.uuid4(), "group_id": group_id, "type": section_type, "title": title, "sort_order": order})


def downgrade() -> None:
    op.drop_index("ix_storefront_revisions_theme_id", table_name="storefront_revisions")
    op.drop_constraint("fk_storefront_revisions_theme_id", "storefront_revisions", type_="foreignkey")
    op.drop_column("storefront_revisions", "theme_id")
    op.drop_index("ix_storefront_pages_template_id", table_name="storefront_pages")
    op.drop_constraint("fk_storefront_pages_template_id", "storefront_pages", type_="foreignkey")
    op.drop_column("storefront_pages", "template_id")
    op.drop_index("ix_categories_storefront_template_id", table_name="categories")
    op.drop_constraint("fk_categories_storefront_template_id", "categories", type_="foreignkey")
    op.drop_column("categories", "storefront_template_id")
    op.drop_index("ix_products_storefront_template_id", table_name="products")
    op.drop_constraint("fk_products_storefront_template_id", "products", type_="foreignkey")
    op.drop_column("products", "storefront_template_id")
    op.drop_constraint("ck_storefront_section_exactly_one_owner", "storefront_sections", type_="check")
    op.drop_index("ix_storefront_sections_section_group_id", table_name="storefront_sections")
    op.drop_index("ix_storefront_sections_template_id", table_name="storefront_sections")
    op.drop_constraint("fk_storefront_sections_group_id", "storefront_sections", type_="foreignkey")
    op.drop_constraint("fk_storefront_sections_template_id", "storefront_sections", type_="foreignkey")
    op.drop_column("storefront_sections", "section_group_id")
    op.drop_column("storefront_sections", "template_id")
    op.alter_column("storefront_sections", "page_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_table("storefront_section_groups")
    op.drop_table("storefront_templates")
    op.drop_table("storefront_themes")
