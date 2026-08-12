"""enforce Store domain status values

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Idempotent guards support databases where the initial Phase 10 migration
    # was applied before these defense-in-depth constraints were added.
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_store_domains_type') THEN
            ALTER TABLE store_domains ADD CONSTRAINT ck_store_domains_type CHECK (domain_type IN ('platform_subdomain', 'custom'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_store_domains_status') THEN
            ALTER TABLE store_domains ADD CONSTRAINT ck_store_domains_status CHECK (status IN ('pending', 'active', 'disabled', 'error'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_store_domains_verification') THEN
            ALTER TABLE store_domains ADD CONSTRAINT ck_store_domains_verification CHECK (verification_status IN ('not_required', 'pending', 'verified', 'failed'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_store_domains_ssl') THEN
            ALTER TABLE store_domains ADD CONSTRAINT ck_store_domains_ssl CHECK (ssl_status IN ('pending', 'active', 'failed', 'not_applicable'));
          END IF;
        END $$;
    """)


def downgrade() -> None:
    for name in (
        "ck_store_domains_ssl", "ck_store_domains_verification",
        "ck_store_domains_status", "ck_store_domains_type",
    ):
        op.execute(f"ALTER TABLE store_domains DROP CONSTRAINT IF EXISTS {name}")
