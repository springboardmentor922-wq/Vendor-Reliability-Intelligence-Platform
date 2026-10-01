"""Milestone 4: Communication and Activity Logs tables

Revision ID: 0005_communication
Revises: 0004_milestone3b
Create Date: 2026-09-25 12:00:00.000000

"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0005_communication'
down_revision: str | None = '0004_milestone3b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. communications table
    op.create_table(
        'communications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('procurement_request_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('procurement_requests.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sender_role', sa.String(length=50), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('attachment_path', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_communications_vendor_id'), 'communications', ['vendor_id'], unique=False)
    op.create_index(op.f('ix_communications_procurement_request_id'), 'communications', ['procurement_request_id'], unique=False)
    op.create_index(op.f('ix_communications_created_at'), 'communications', ['created_at'], unique=False)

    # 2. activity_logs table
    op.create_table(
        'activity_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('details', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_activity_logs_entity_id'), 'activity_logs', ['entity_id'], unique=False)
    op.create_index(op.f('ix_activity_logs_user_id'), 'activity_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_activity_logs_created_at'), 'activity_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('activity_logs')
    op.drop_table('communications')
