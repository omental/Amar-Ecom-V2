"""add_order_warehouse

Revision ID: 36f3f4b72fa9
Revises: 4cdb8dc1a6f1
Create Date: 2026-05-11 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "36f3f4b72fa9"
down_revision: Union[str, Sequence[str], None] = "4cdb8dc1a6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("warehouse_id", sa.UUID(), nullable=True))
    op.create_index(op.f("ix_orders_warehouse_id"), "orders", ["warehouse_id"], unique=False)
    op.create_foreign_key(
        "fk_orders_warehouse_id_warehouses",
        "orders",
        "warehouses",
        ["warehouse_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_warehouse_id_warehouses", "orders", type_="foreignkey")
    op.drop_index(op.f("ix_orders_warehouse_id"), table_name="orders")
    op.drop_column("orders", "warehouse_id")
