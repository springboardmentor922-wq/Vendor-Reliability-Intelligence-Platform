"""Vendor cascade delete migration: change purchase_orders.vendor_id foreign key to CASCADE

Revision ID: 0006_vendor_cascade_delete
Revises: 0005_communication
Create Date: 2026-09-25 18:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0006_vendor_cascade_delete'
down_revision: str | None = '0005_communication'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint('purchase_orders_vendor_id_fkey', 'purchase_orders', type_='foreignkey')
    op.create_foreign_key(
        'purchase_orders_vendor_id_fkey',
        'purchase_orders',
        'vendors',
        ['vendor_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('purchase_orders_vendor_id_fkey', 'purchase_orders', type_='foreignkey')
    op.create_foreign_key(
        'purchase_orders_vendor_id_fkey',
        'purchase_orders',
        'vendors',
        ['vendor_id'],
        ['id'],
        ondelete='RESTRICT'
    )
