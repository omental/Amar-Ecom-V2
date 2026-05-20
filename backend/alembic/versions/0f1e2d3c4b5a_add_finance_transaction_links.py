"""add finance transaction links

Revision ID: 0f1e2d3c4b5a
Revises: f7a8b9c0d1e2
Create Date: 2026-05-12 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0f1e2d3c4b5a"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "petty_cash_entries",
        sa.Column("transaction_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "petty_cash_entries",
        sa.Column("transaction_created", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_index(op.f("ix_petty_cash_entries_transaction_id"), "petty_cash_entries", ["transaction_id"], unique=False)
    op.create_foreign_key(
        "fk_petty_cash_entries_transaction_id_transactions",
        "petty_cash_entries",
        "transactions",
        ["transaction_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "supplier_payments",
        sa.Column("transaction_id", sa.UUID(), nullable=True),
    )
    op.create_index(op.f("ix_supplier_payments_transaction_id"), "supplier_payments", ["transaction_id"], unique=False)
    op.create_foreign_key(
        "fk_supplier_payments_transaction_id_transactions",
        "supplier_payments",
        "transactions",
        ["transaction_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_supplier_payments_transaction_id_transactions", "supplier_payments", type_="foreignkey")
    op.drop_index(op.f("ix_supplier_payments_transaction_id"), table_name="supplier_payments")
    op.drop_column("supplier_payments", "transaction_id")

    op.drop_constraint("fk_petty_cash_entries_transaction_id_transactions", "petty_cash_entries", type_="foreignkey")
    op.drop_index(op.f("ix_petty_cash_entries_transaction_id"), table_name="petty_cash_entries")
    op.drop_column("petty_cash_entries", "transaction_created")
    op.drop_column("petty_cash_entries", "transaction_id")
