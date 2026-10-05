"""Initial VendorIQ operational schema.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "vendors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column("email", sa.String(150)),
        sa.Column("phone", sa.String(30)),
        sa.Column("website", sa.String(255)),
        sa.Column("tax_id", sa.String(80)),
        sa.Column("country", sa.String(80)),
        sa.Column("address", sa.Text()),
        sa.Column("status", sa.String(50), nullable=False, server_default="Pending"),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="Medium"),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("approved_by", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vendors_status", "vendors", ["status"])
    op.create_index("ix_vendors_category", "vendors", ["category"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="vendor"),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="SET NULL")),
        sa.Column("password_reset_token_hash", sa.String(128)),
        sa.Column("password_reset_expires", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_vendor_id", "users", ["vendor_id"])

    op.create_foreign_key("fk_vendors_approved_by", "vendors", "users", ["approved_by"], ["id"], ondelete="SET NULL")

    op.create_table(
        "vendor_contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(150)),
        sa.Column("phone", sa.String(30)),
        sa.Column("designation", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vendor_contacts_vendor", "vendor_contacts", ["vendor_id"])

    op.create_table(
        "procurement_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("department", sa.String(100), server_default="Information Technology"),
        sa.Column("priority", sa.String(30), server_default="Normal"),
        sa.Column("estimated_budget", sa.Float()),
        sa.Column("justification", sa.Text()),
        sa.Column("required_date", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(50), server_default="Pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pr_status", "procurement_requests", ["status"])
    op.create_index("ix_pr_created", "procurement_requests", ["created_at"])

    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("po_number", sa.String(50), unique=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("procurement_request_id", sa.Integer(), sa.ForeignKey("procurement_requests.id", ondelete="SET NULL")),
        sa.Column("order_date", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("requested_delivery", sa.DateTime(timezone=True)),
        sa.Column("expected_delivery", sa.DateTime(timezone=True)),
        sa.Column("actual_delivery", sa.DateTime(timezone=True)),
        sa.Column("department", sa.String(100), server_default="Information Technology"),
        sa.Column("payment_terms", sa.String(80), server_default="Net 30"),
        sa.Column("shipping_address", sa.Text()),
        sa.Column("billing_address", sa.Text()),
        sa.Column("remarks", sa.Text()),
        sa.Column("subtotal", sa.Float(), server_default="0"),
        sa.Column("tax_amount", sa.Float(), server_default="0"),
        sa.Column("total_amount", sa.Float(), server_default="0"),
        sa.Column("status", sa.String(50), server_default="Pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_po_vendor", "purchase_orders", ["vendor_id"])
    op.create_index("ix_po_status", "purchase_orders", ["status"])
    op.create_index("ix_po_expected_delivery", "purchase_orders", ["expected_delivery"])

    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("purchase_order_id", sa.Integer(), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_name", sa.String(150), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tax_percent", sa.Float(), server_default="18"),
        sa.Column("total_price", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("ix_po_items_po", "purchase_order_items", ["purchase_order_id"])

    op.create_table(
        "purchase_order_approvals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("purchase_order_id", sa.Integer(), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("decision", sa.String(30), nullable=False),
        sa.Column("comment", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_po_approvals_po", "purchase_order_approvals", ["purchase_order_id"])

    op.create_table(
        "vendor_performance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delivery_score", sa.Float(), server_default="0"),
        sa.Column("quality_score", sa.Float(), server_default="0"),
        sa.Column("cost_score", sa.Float(), server_default="0"),
        sa.Column("communication_score", sa.Float(), server_default="0"),
        sa.Column("service_score", sa.Float(), server_default="0"),
        sa.Column("issue_resolution_score", sa.Float(), server_default="0"),
        sa.Column("reliability_score", sa.Float(), server_default="0"),
        sa.Column("risk_level", sa.String(50), server_default="Medium"),
        sa.Column("notes", sa.Text()),
        sa.Column("measured_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vendor_performance_vendor", "vendor_performance", ["vendor_id"])

    op.create_table(
        "contracts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contract_name", sa.String(150), nullable=False),
        sa.Column("contract_reference", sa.String(80)),
        sa.Column("start_date", sa.DateTime(timezone=True)),
        sa.Column("end_date", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(50), server_default="Active"),
        sa.Column("compliance_status", sa.String(50), server_default="Pending"),
        sa.Column("auto_renew", sa.Boolean(), server_default=sa.false()),
        sa.Column("document_path", sa.String(255)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_contracts_vendor", "contracts", ["vendor_id"])
    op.create_index("ix_contracts_end_date", "contracts", ["end_date"])
    op.create_index("ix_contracts_compliance", "contracts", ["compliance_status"])

    op.create_table(
        "vendor_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("stored_name", sa.String(255), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vendor_documents_vendor", "vendor_documents", ["vendor_id"])
    op.create_index("ix_vendor_documents_type", "vendor_documents", ["document_type"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(50)),
        sa.Column("is_read", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "is_read"])

    op.create_table(
        "communications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("subject", sa.String(200), server_default="General Inquiry"),
        sa.Column("thread_id", sa.String(80)),
        sa.Column("attachment_path", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_communications_vendor_created", "communications", ["vendor_id", "created_at"])
    op.create_index("ix_communications_sender", "communications", ["sender_id"])
    op.create_index("ix_communications_thread_id", "communications", ["thread_id"])

    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_number", sa.String(50), nullable=False, unique=True),
        sa.Column("purchase_order_id", sa.Integer(), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Float(), server_default="0"),
        sa.Column("status", sa.String(50), server_default="Pending"),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("paid_date", sa.DateTime(timezone=True)),
        sa.Column("document_path", sa.String(255)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invoices_vendor", "invoices", ["vendor_id"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_due_date", "invoices", ["due_date"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer()),
        sa.Column("details", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_created", "audit_logs", ["created_at"])
    op.create_index("ix_audit_entity", "audit_logs", ["entity_type", "entity_id"])


def downgrade():
    for table in ["audit_logs", "invoices", "communications", "notifications", "vendor_documents", "contracts", "vendor_performance", "purchase_order_approvals", "purchase_order_items", "purchase_orders", "procurement_requests", "vendor_contacts"]:
        op.drop_table(table)
    op.drop_constraint("fk_vendors_approved_by", "vendors", type_="foreignkey")
    op.drop_table("users")
    op.drop_table("vendors")
