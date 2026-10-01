"""Add certifications table for vendor certification management

Revision ID: 0007_certifications
Revises: 0006_vendor_cascade_delete
Create Date: 2026-09-29 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = '0007_certifications'
down_revision: str | None = '0006_vendor_cascade_delete'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'certifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('certification_name', sa.String(255), nullable=False),
        sa.Column('issued_date', sa.DateTime(), nullable=True),
        sa.Column('expiry_date', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='Valid'),
        sa.Column('document_path', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_certifications_vendor_id', 'certifications', ['vendor_id'])
    op.create_index('ix_certifications_status', 'certifications', ['status'])


def downgrade() -> None:
    op.drop_index('ix_certifications_status', table_name='certifications')
    op.drop_index('ix_certifications_vendor_id', table_name='certifications')
    op.drop_table('certifications')
