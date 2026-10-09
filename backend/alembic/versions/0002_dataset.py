"""PostgreSQL DataCo intelligence tables.

Revision ID: 0002_dataset
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_dataset"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "dataset_orders",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("order_id", sa.String(50)),
        sa.Column("order_item_id", sa.String(50)),
        sa.Column("order_date", sa.DateTime()),
        sa.Column("shipping_date", sa.DateTime()),
        sa.Column("days_for_shipping_real", sa.Integer()),
        sa.Column("days_for_shipment_scheduled", sa.Integer()),
        sa.Column("delivery_status", sa.String(50)),
        sa.Column("late_delivery_risk", sa.Integer()),
        sa.Column("order_status", sa.String(50)),
        sa.Column("sales", sa.Float()),
        sa.Column("order_item_total", sa.Float()),
        sa.Column("order_item_quantity", sa.Integer()),
        sa.Column("order_profit_per_order", sa.Float()),
        sa.Column("benefit_per_order", sa.Float()),
        sa.Column("order_item_discount_rate", sa.Float()),
        sa.Column("category_id", sa.String(20)),
        sa.Column("category_name", sa.String(150)),
        sa.Column("department_name", sa.String(150)),
        sa.Column("market", sa.String(50)),
        sa.Column("order_region", sa.String(100)),
        sa.Column("order_country", sa.String(100)),
        sa.Column("customer_segment", sa.String(50)),
        sa.Column("shipping_mode", sa.String(50)),
        sa.Column("product_card_id", sa.String(20)),
        sa.Column("product_name", sa.String(255)),
        sa.Column("product_price", sa.Float()),
    )
    op.create_index("idx_orders_product", "dataset_orders", ["product_card_id"])
    op.create_index("idx_orders_category", "dataset_orders", ["category_name"])
    op.create_index("idx_orders_market", "dataset_orders", ["market"])
    op.create_index("idx_orders_date", "dataset_orders", ["order_date"])

    op.create_table(
        "dataset_suppliers",
        sa.Column("product_card_id", sa.String(20), primary_key=True),
        sa.Column("product_name", sa.String(255)),
        sa.Column("category_name", sa.String(150)),
        sa.Column("order_count", sa.Integer()),
        sa.Column("total_sales", sa.Float()),
        sa.Column("on_time_rate", sa.Float()),
        sa.Column("late_rate", sa.Float()),
        sa.Column("cancel_rate", sa.Float()),
        sa.Column("complete_rate", sa.Float()),
        sa.Column("avg_overdue_days", sa.Float()),
        sa.Column("reliability_score", sa.Float()),
        sa.Column("risk_level", sa.String(20)),
        sa.Column("last_updated", sa.DateTime()),
    )
    op.create_index("idx_dataset_suppliers_score", "dataset_suppliers", ["reliability_score"])
    op.create_index("idx_dataset_suppliers_risk", "dataset_suppliers", ["risk_level"])


def downgrade():
    op.drop_table("dataset_suppliers")
    op.drop_table("dataset_orders")
