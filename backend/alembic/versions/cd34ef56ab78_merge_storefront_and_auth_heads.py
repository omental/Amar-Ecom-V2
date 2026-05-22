"""merge storefront and auth heads

Revision ID: cd34ef56ab78
Revises: 9c0d1e2f3a4b, ab12cd34ef56
Create Date: 2026-05-22 12:20:00.000000
"""

from collections.abc import Sequence


revision: str = "cd34ef56ab78"
down_revision: str | Sequence[str] | None = ("9c0d1e2f3a4b", "ab12cd34ef56")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
