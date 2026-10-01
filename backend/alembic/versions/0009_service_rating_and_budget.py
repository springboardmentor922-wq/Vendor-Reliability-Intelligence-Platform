"""Add service_rating to vendor_performance and budget_amount to procurement_requests

Revision ID: 0009_service_rating_and_budget
Revises: 0008_contract_renewal
Create Date: 2026-09-29 16:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0009_service_rating_and_budget'
down_revision = '0008_contract_renewal'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add service_rating to vendor_performance table
    op.add_column(
        'vendor_performance',
        sa.Column('service_rating', sa.Float(), nullable=True, server_default='5.0')
    )

    # 2. Add budget_amount to procurement_requests table
    op.add_column(
        'procurement_requests',
        sa.Column('budget_amount', sa.Numeric(12, 2), nullable=True)
    )


def downgrade():
    op.drop_column('procurement_requests', 'budget_amount')
    op.drop_column('vendor_performance', 'service_rating')
