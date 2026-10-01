"""Milestone 3B migration: add type column to notifications

Revision ID: 0004_milestone3b
Revises: 0003_milestone3
Create Date: 2026-09-10 07:15:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0004_milestone3b'
down_revision: str | None = '0003_milestone3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add type column to notifications table (additive only)
    op.add_column(
        'notifications',
        sa.Column('type', sa.String(length=50), nullable=False, server_default='general')
    )


def downgrade() -> None:
    op.drop_column('notifications', 'type')
