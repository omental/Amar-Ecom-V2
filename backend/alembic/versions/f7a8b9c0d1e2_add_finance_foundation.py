"""add finance foundation

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-05-12 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("account_type", sa.String(length=50), nullable=False),
        sa.Column("opening_balance", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("current_balance", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_account_type"), "accounts", ["account_type"], unique=False)
    op.create_index(op.f("ix_accounts_code"), "accounts", ["code"], unique=True)
    op.create_index(op.f("ix_accounts_name"), "accounts", ["name"], unique=False)

    op.create_table(
        "transactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("transaction_number", sa.String(length=100), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("related_account_id", sa.UUID(), nullable=True),
        sa.Column("transaction_type", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("reference_type", sa.String(length=100), nullable=True),
        sa.Column("reference_id", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("transaction_date", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["related_account_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_transactions_account_id"), "transactions", ["account_id"], unique=False)
    op.create_index(op.f("ix_transactions_category"), "transactions", ["category"], unique=False)
    op.create_index(op.f("ix_transactions_created_by_id"), "transactions", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_transactions_direction"), "transactions", ["direction"], unique=False)
    op.create_index(op.f("ix_transactions_reference_id"), "transactions", ["reference_id"], unique=False)
    op.create_index(op.f("ix_transactions_reference_type"), "transactions", ["reference_type"], unique=False)
    op.create_index(op.f("ix_transactions_related_account_id"), "transactions", ["related_account_id"], unique=False)
    op.create_index(op.f("ix_transactions_transaction_number"), "transactions", ["transaction_number"], unique=True)
    op.create_index(op.f("ix_transactions_transaction_type"), "transactions", ["transaction_type"], unique=False)

    op.create_table(
        "petty_cash_entries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entry_number", sa.String(length=100), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=True),
        sa.Column("entry_type", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("spent_by", sa.String(length=255), nullable=True),
        sa.Column("approved_by_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("entry_date", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_petty_cash_entries_account_id"), "petty_cash_entries", ["account_id"], unique=False)
    op.create_index(op.f("ix_petty_cash_entries_approved_by_id"), "petty_cash_entries", ["approved_by_id"], unique=False)
    op.create_index(op.f("ix_petty_cash_entries_entry_number"), "petty_cash_entries", ["entry_number"], unique=True)
    op.create_index(op.f("ix_petty_cash_entries_entry_type"), "petty_cash_entries", ["entry_type"], unique=False)

    op.create_table(
        "supplier_payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("supplier_id", sa.UUID(), nullable=True),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("payment_number", sa.String(length=100), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("payment_method", sa.String(length=100), nullable=True),
        sa.Column("reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("payment_date", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_supplier_payments_account_id"), "supplier_payments", ["account_id"], unique=False)
    op.create_index(op.f("ix_supplier_payments_payment_number"), "supplier_payments", ["payment_number"], unique=True)
    op.create_index(op.f("ix_supplier_payments_supplier_id"), "supplier_payments", ["supplier_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_supplier_payments_supplier_id"), table_name="supplier_payments")
    op.drop_index(op.f("ix_supplier_payments_payment_number"), table_name="supplier_payments")
    op.drop_index(op.f("ix_supplier_payments_account_id"), table_name="supplier_payments")
    op.drop_table("supplier_payments")

    op.drop_index(op.f("ix_petty_cash_entries_entry_type"), table_name="petty_cash_entries")
    op.drop_index(op.f("ix_petty_cash_entries_entry_number"), table_name="petty_cash_entries")
    op.drop_index(op.f("ix_petty_cash_entries_approved_by_id"), table_name="petty_cash_entries")
    op.drop_index(op.f("ix_petty_cash_entries_account_id"), table_name="petty_cash_entries")
    op.drop_table("petty_cash_entries")

    op.drop_index(op.f("ix_transactions_transaction_type"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_transaction_number"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_related_account_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_reference_type"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_reference_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_direction"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_created_by_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_category"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_account_id"), table_name="transactions")
    op.drop_table("transactions")

    op.drop_index(op.f("ix_accounts_name"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_code"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_account_type"), table_name="accounts")
    op.drop_table("accounts")
