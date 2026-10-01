"""Add renewed_from_contract_id to contracts for renewal history traceability

Revision ID: 0008_contract_renewal
Revises: 0007_certifications
Create Date: 2026-09-29 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = '0008_contract_renewal'
down_revision: str | None = '0007_certifications'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add nullable self-referential FK so renewed contracts point back to original
    op.add_column(
        'contracts',
        sa.Column('renewed_from_contract_id', UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'contracts_renewed_from_contract_id_fkey',
        'contracts',
        'contracts',
        ['renewed_from_contract_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('contracts_renewed_from_contract_id_fkey', 'contracts', type_='foreignkey')
    op.drop_column('contracts', 'renewed_from_contract_id')
