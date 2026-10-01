"""Milestone 2 migration

Revision ID: 0002_milestone2
Revises: 0001_initial
Create Date: 2026-09-08 17:35:00.000000

"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0002_milestone2'
down_revision: str | None = '0001_initial'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    # 1. Vendor extensions
    op.add_column('vendors', sa.Column('review_notes', sa.Text(), nullable=True))

    # 2. PR Line Items
    op.create_table(
        'pr_line_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('pr_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('procurement_requests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_name', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False, server_default='1.00'),
        sa.Column('estimated_cost', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00')
    )
    op.create_index(op.f('ix_pr_line_items_pr_id'), 'pr_line_items', ['pr_id'], unique=False)

    # 3. Procurement Requests extensions
    op.add_column('procurement_requests', sa.Column('total_estimated_cost', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'))

    # 4. Purchase Order extensions
    op.add_column('purchase_orders', sa.Column('delivery_status', sa.String(length=50), nullable=False, server_default='in_progress'))
    op.add_column('purchase_orders', sa.Column('invoice_amount', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('purchase_orders', sa.Column('invoice_received_at', sa.DateTime(), nullable=True))

    # 5. PO Documents
    op.create_table(
        'po_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('po_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('purchase_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('doc_type', sa.String(length=50), nullable=False, server_default='invoice'),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_po_documents_po_id'), 'po_documents', ['po_id'], unique=False)

    # 6. Contract extensions
    op.add_column('contracts', sa.Column('renewal_notice_period_days', sa.Numeric(precision=5, scale=0), nullable=False, server_default='30'))
    op.add_column('contracts', sa.Column('terms', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('compliance_flags', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('document_path', sa.String(length=500), nullable=True))

    # 7. Notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('message', sa.String(length=500), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)

def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_column('contracts', 'document_path')
    op.drop_column('contracts', 'compliance_flags')
    op.drop_column('contracts', 'terms')
    op.drop_column('contracts', 'renewal_notice_period_days')
    op.drop_table('po_documents')
    op.drop_column('purchase_orders', 'invoice_received_at')
    op.drop_column('purchase_orders', 'invoice_amount')
    op.drop_column('purchase_orders', 'delivery_status')
    op.drop_column('procurement_requests', 'total_estimated_cost')
    op.drop_table('pr_line_items')
    op.drop_column('vendors', 'review_notes')
