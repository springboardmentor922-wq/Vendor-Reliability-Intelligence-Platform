"""initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-01 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. users
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='Procurement Manager'),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('company', sa.String(length=150), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. password_resets
    op.create_table('password_resets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_password_resets_id'), 'password_resets', ['id'], unique=False)
    op.create_index(op.f('ix_password_resets_token'), 'password_resets', ['token'], unique=True)

    # 3. vendor_categories
    op.create_table('vendor_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_vendor_categories_id'), 'vendor_categories', ['id'], unique=False)

    # 4. vendors
    op.create_table('vendors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('company', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('product', sa.String(length=150), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False, server_default='Raw Material Suppliers'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('deliveryRate', sa.Float(), nullable=False, server_default='85.0'),
        sa.Column('quality_rating', sa.Float(), nullable=False, server_default='4.0'),
        sa.Column('response_time_hours', sa.Float(), nullable=False, server_default='24.0'),
        sa.Column('risk_level', sa.String(length=50), nullable=False, server_default='Low'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('reviewed_by_id', sa.Integer(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL', name='fk_vendors_user_id'),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ondelete='SET NULL', name='fk_vendors_reviewed_by_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendors_id'), 'vendors', ['id'], unique=False)
    op.create_index(op.f('ix_vendors_name'), 'vendors', ['name'], unique=False)

    # 5. vendor_contacts
    op.create_table('vendor_contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('contact_name', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=True),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE', name='fk_vendor_contacts_vendor_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendor_contacts_id'), 'vendor_contacts', ['id'], unique=False)

    # 6. procurement_requests
    op.create_table('procurement_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_number', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('requested_by_id', sa.Integer(), nullable=True),
        sa.Column('assigned_vendor_id', sa.Integer(), nullable=True),
        sa.Column('estimated_budget', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('priority', sa.String(length=50), nullable=False, server_default='Medium'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('approved_by_id', sa.Integer(), nullable=True),
        sa.Column('approval_date', sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('delivery_deadline', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['requested_by_id'], ['users.id'], ondelete='SET NULL', name='fk_pr_requested_by_id'),
        sa.ForeignKeyConstraint(['assigned_vendor_id'], ['vendors.id'], ondelete='SET NULL', name='fk_pr_assigned_vendor_id'),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], ondelete='SET NULL', name='fk_pr_approved_by_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_procurement_requests_id'), 'procurement_requests', ['id'], unique=False)
    op.create_index(op.f('ix_procurement_requests_request_number'), 'procurement_requests', ['request_number'], unique=True)

    # 7. purchase_orders
    op.create_table('purchase_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('po_number', sa.String(length=50), nullable=False),
        sa.Column('procurement_request_id', sa.Integer(), nullable=True),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='USD'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Draft'),
        sa.Column('approved_by_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('expected_delivery_date', sa.DateTime(), nullable=True),
        sa.Column('actual_delivery_date', sa.DateTime(), nullable=True),
        sa.Column('terms_and_conditions', sa.Text(), nullable=True),
        sa.Column('shipping_address', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['procurement_request_id'], ['procurement_requests.id'], ondelete='SET NULL', name='fk_po_pr_id'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE', name='fk_po_vendor_id'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL', name='fk_po_created_by_id'),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], ondelete='SET NULL', name='fk_po_approved_by_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_orders_id'), 'purchase_orders', ['id'], unique=False)
    op.create_index(op.f('ix_purchase_orders_po_number'), 'purchase_orders', ['po_number'], unique=True)

    # 8. purchase_order_items
    op.create_table('purchase_order_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_order_id', sa.Integer(), nullable=False),
        sa.Column('item_name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('unit_price', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_price', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('sku', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='CASCADE', name='fk_po_items_po_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_order_items_id'), 'purchase_order_items', ['id'], unique=False)

    # 9. contracts
    op.create_table('contracts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_number', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('expiry_date', sa.DateTime(), nullable=False),
        sa.Column('renewal_terms', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Active'),
        sa.Column('compliance_status', sa.String(length=50), nullable=False, server_default='Compliant'),
        sa.Column('document_url', sa.String(length=255), nullable=True),
        sa.Column('document_name', sa.String(length=255), nullable=True),
        sa.Column('contract_value', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE', name='fk_contracts_vendor_id'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL', name='fk_contracts_created_by_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_contracts_id'), 'contracts', ['id'], unique=False)
    op.create_index(op.f('ix_contracts_contract_number'), 'contracts', ['contract_number'], unique=True)

    # 10. invoices
    op.create_table('invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('purchase_order_id', sa.Integer(), nullable=True),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Submitted'),
        sa.Column('issue_date', sa.DateTime(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('paid_date', sa.DateTime(), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='SET NULL', name='fk_invoices_po_id'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE', name='fk_invoices_vendor_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoices_id'), 'invoices', ['id'], unique=False)
    op.create_index(op.f('ix_invoices_invoice_number'), 'invoices', ['invoice_number'], unique=True)

    # 11. communications
    op.create_table('communications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=True),
        sa.Column('recipient_id', sa.Integer(), nullable=True),
        sa.Column('vendor_id', sa.Integer(), nullable=True),
        sa.Column('procurement_request_id', sa.Integer(), nullable=True),
        sa.Column('purchase_order_id', sa.Integer(), nullable=True),
        sa.Column('subject', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('attachment_name', sa.String(length=255), nullable=True),
        sa.Column('attachment_url', sa.String(length=255), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='SET NULL', name='fk_comms_sender_id'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='SET NULL', name='fk_comms_recipient_id'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE', name='fk_comms_vendor_id'),
        sa.ForeignKeyConstraint(['procurement_request_id'], ['procurement_requests.id'], ondelete='SET NULL', name='fk_comms_pr_id'),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='SET NULL', name='fk_comms_po_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_communications_id'), 'communications', ['id'], unique=False)

    # 12. audit_logs
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL', name='fk_audit_user_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)

    # 13. notifications
    op.create_table('notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False, server_default='system'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='fk_notif_user_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)

def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('audit_logs')
    op.drop_table('communications')
    op.drop_table('invoices')
    op.drop_table('contracts')
    op.drop_table('purchase_order_items')
    op.drop_table('purchase_orders')
    op.drop_table('procurement_requests')
    op.drop_table('vendor_contacts')
    op.drop_table('vendors')
    op.drop_table('vendor_categories')
    op.drop_table('password_resets')
    op.drop_table('users')
