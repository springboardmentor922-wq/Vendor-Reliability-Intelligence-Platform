"""Add entity linkage to vendor document metadata.

Revision ID: 0003_document_links
Revises: 0002_dataset
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_document_links"
down_revision = "0002_dataset"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("vendor_documents", sa.Column("entity_type", sa.String(50), nullable=False, server_default="vendor"))
    op.add_column("vendor_documents", sa.Column("entity_id", sa.Integer(), nullable=True))
    op.create_index("ix_vendor_documents_entity", "vendor_documents", ["entity_type", "entity_id"])


def downgrade():
    op.drop_index("ix_vendor_documents_entity", table_name="vendor_documents")
    op.drop_column("vendor_documents", "entity_id")
    op.drop_column("vendor_documents", "entity_type")
