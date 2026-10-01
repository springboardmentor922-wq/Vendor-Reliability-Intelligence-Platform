"""initial migration

Revision ID: 0001_initial
Revises: 
Create Date: 2026-09-07 19:50:00.000000

"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0001_initial'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    # 1. roles table
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(length=50), nullable=False, unique=True)
    )
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=True)

    # 2. users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_status'), 'users', ['status'], unique=False)

    # 3. user_roles association table
    op.create_table(
        'user_roles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
    )

    # 4. vendors table
    op.create_table(
        'vendors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('registration_no', sa.String(length=100), nullable=False, unique=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_vendors_company_name'), 'vendors', ['company_name'], unique=False)
    op.create_index(op.f('ix_vendors_registration_no'), 'vendors', ['registration_no'], unique=True)
    op.create_index(op.f('ix_vendors_category'), 'vendors', ['category'], unique=False)

    # 5. vendor_contacts table
    op.create_table(
        'vendor_contacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True)
    )

    # 6. procurement_requests table
    op.create_table(
        'procurement_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('requester_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PENDING_APPROVAL'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_procurement_requests_status'), 'procurement_requests', ['status'], unique=False)

    # 7. purchase_orders table
    op.create_table(
        'purchase_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('pr_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('procurement_requests.id', ondelete='SET NULL'), nullable=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('po_number', sa.String(length=100), nullable=False, unique=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='SENT_TO_VENDOR'),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.create_index(op.f('ix_purchase_orders_po_number'), 'purchase_orders', ['po_number'], unique=True)
    op.create_index(op.f('ix_purchase_orders_status'), 'purchase_orders', ['status'], unique=False)

    # 8. po_items table
    op.create_table(
        'po_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('po_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('purchase_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_name', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False, server_default='1.00'),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00')
    )

    # 9. contracts table
    op.create_table(
        'contracts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )

def downgrade() -> None:
    op.drop_table('contracts')
    op.drop_table('po_items')
    op.drop_table('purchase_orders')
    op.drop_table('procurement_requests')
    op.drop_table('vendor_contacts')
    op.drop_table('vendors')
    op.drop_table('user_roles')
    op.drop_table('users')
    op.drop_table('roles')
