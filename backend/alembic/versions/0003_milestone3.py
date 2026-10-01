"""Milestone 3 Group A migration: vendor performance and reliability tables

Revision ID: 0003_milestone3
Revises: 0002_milestone2
Create Date: 2026-09-10 06:35:00.000000

"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0003_milestone3'
down_revision: str | None = '0002_milestone2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    # 1. vendor_performance table
    op.create_table(
        'vendor_performance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('on_time_deliveries', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('delayed_deliveries', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quality_rating', sa.Float(), nullable=False, server_default='5.0'),
        sa.Column('response_time_hours', sa.Float(), nullable=False, server_default='24.0'),
        sa.Column('issue_resolution_time_hours', sa.Float(), nullable=False, server_default='48.0'),
        sa.Column('order_completion_rate', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('recorded_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_vendor_performance_vendor_id'), 'vendor_performance', ['vendor_id'], unique=False)

    # 2. vendor_reliability table
    op.create_table(
        'vendor_reliability',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('delivery_score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('quality_score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('communication_score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('compliance_score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('overall_reliability_score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('risk_level', sa.String(length=50), nullable=False, server_default='Low'),
        sa.Column('computed_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_vendor_reliability_vendor_id'), 'vendor_reliability', ['vendor_id'], unique=False)

def downgrade() -> None:
    op.drop_table('vendor_reliability')
    op.drop_table('vendor_performance')
