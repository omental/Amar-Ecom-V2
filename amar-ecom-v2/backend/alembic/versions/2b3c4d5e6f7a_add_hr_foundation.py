"""add hr foundation

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-05-12 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b3c4d5e6f7a"
down_revision: Union[str, Sequence[str], None] = "1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "designations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_designations_title"), "designations", ["title"], unique=False)

    op.create_table(
        "employees",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("employee_code", sa.String(length=100), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("designation_id", sa.UUID(), nullable=True),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("joining_date", sa.Date(), nullable=True),
        sa.Column("salary", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("employment_status", sa.String(length=50), server_default="active", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["designation_id"], ["designations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employees_designation_id"), "employees", ["designation_id"], unique=False)
    op.create_index(op.f("ix_employees_email"), "employees", ["email"], unique=False)
    op.create_index(op.f("ix_employees_employee_code"), "employees", ["employee_code"], unique=True)
    op.create_index(op.f("ix_employees_employment_status"), "employees", ["employment_status"], unique=False)
    op.create_index(op.f("ix_employees_full_name"), "employees", ["full_name"], unique=False)
    op.create_index(op.f("ix_employees_user_id"), "employees", ["user_id"], unique=False)

    op.create_table(
        "attendance_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="present", nullable=False),
        sa.Column("check_in", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "attendance_date", name="uq_attendance_employee_date"),
    )
    op.create_index(op.f("ix_attendance_records_attendance_date"), "attendance_records", ["attendance_date"], unique=False)
    op.create_index(op.f("ix_attendance_records_employee_id"), "attendance_records", ["employee_id"], unique=False)
    op.create_index(op.f("ix_attendance_records_status"), "attendance_records", ["status"], unique=False)

    op.create_table(
        "salary_advances",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_salary_advances_approved_by_id"), "salary_advances", ["approved_by_id"], unique=False)
    op.create_index(op.f("ix_salary_advances_employee_id"), "salary_advances", ["employee_id"], unique=False)
    op.create_index(op.f("ix_salary_advances_status"), "salary_advances", ["status"], unique=False)

    op.create_table(
        "salary_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("salary_month", sa.String(length=20), nullable=False),
        sa.Column("basic_salary", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("advance_deduction", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("bonus", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("other_deductions", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("net_salary", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="draft", nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_salary_records_employee_id"), "salary_records", ["employee_id"], unique=False)
    op.create_index(op.f("ix_salary_records_salary_month"), "salary_records", ["salary_month"], unique=False)
    op.create_index(op.f("ix_salary_records_status"), "salary_records", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_salary_records_status"), table_name="salary_records")
    op.drop_index(op.f("ix_salary_records_salary_month"), table_name="salary_records")
    op.drop_index(op.f("ix_salary_records_employee_id"), table_name="salary_records")
    op.drop_table("salary_records")

    op.drop_index(op.f("ix_salary_advances_status"), table_name="salary_advances")
    op.drop_index(op.f("ix_salary_advances_employee_id"), table_name="salary_advances")
    op.drop_index(op.f("ix_salary_advances_approved_by_id"), table_name="salary_advances")
    op.drop_table("salary_advances")

    op.drop_index(op.f("ix_attendance_records_status"), table_name="attendance_records")
    op.drop_index(op.f("ix_attendance_records_employee_id"), table_name="attendance_records")
    op.drop_index(op.f("ix_attendance_records_attendance_date"), table_name="attendance_records")
    op.drop_table("attendance_records")

    op.drop_index(op.f("ix_employees_user_id"), table_name="employees")
    op.drop_index(op.f("ix_employees_full_name"), table_name="employees")
    op.drop_index(op.f("ix_employees_employment_status"), table_name="employees")
    op.drop_index(op.f("ix_employees_employee_code"), table_name="employees")
    op.drop_index(op.f("ix_employees_email"), table_name="employees")
    op.drop_index(op.f("ix_employees_designation_id"), table_name="employees")
    op.drop_table("employees")

    op.drop_index(op.f("ix_designations_title"), table_name="designations")
    op.drop_table("designations")
