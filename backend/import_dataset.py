"""
Import the DataCo Supply Chain dataset into MySQL.

The dataset is order-level retail data. Because it has no 'vendor' column,
each PRODUCT is treated as a supplier ("product-as-supplier proxy") so the
platform can score supplier reliability and risk from real delivery history.

Creates two tables:
  - dataset_orders     : one row per order item (raw history)
  - dataset_suppliers  : per-supplier aggregate metrics + reliability score

Usage:
  .\\venv\\Scripts\\python.exe import_dataset.py
"""
import os

import pandas as pd
from sqlalchemy import text

from database import engine

DATASET_PATH = r"C:\Users\USER\Downloads\DataCoSupplyChainDataset - DataCoSupplyChainDataset.csv"


def create_tables():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dataset_orders (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50),
                order_item_id VARCHAR(50),
                order_date DATETIME,
                shipping_date DATETIME,
                days_for_shipping_real INT,
                days_for_shipment_scheduled INT,
                delivery_status VARCHAR(50),
                late_delivery_risk TINYINT,
                order_status VARCHAR(50),
                sales FLOAT,
                order_item_total FLOAT,
                order_item_quantity INT,
                order_profit_per_order FLOAT,
                benefit_per_order FLOAT,
                order_item_discount_rate FLOAT,
                category_id VARCHAR(20),
                category_name VARCHAR(150),
                department_name VARCHAR(150),
                market VARCHAR(50),
                order_region VARCHAR(100),
                order_country VARCHAR(100),
                customer_segment VARCHAR(50),
                shipping_mode VARCHAR(50),
                product_card_id VARCHAR(20),
                product_name VARCHAR(255),
                product_price FLOAT,
                INDEX idx_orders_product (product_card_id),
                INDEX idx_orders_category (category_name),
                INDEX idx_orders_market (market),
                INDEX idx_orders_date (order_date)
            ) DEFAULT CHARSET=utf8mb4
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dataset_suppliers (
                product_card_id VARCHAR(20) PRIMARY KEY,
                product_name VARCHAR(255),
                category_name VARCHAR(150),
                order_count INT,
                total_sales FLOAT,
                on_time_rate FLOAT,
                late_rate FLOAT,
                cancel_rate FLOAT,
                complete_rate FLOAT,
                avg_overdue_days FLOAT,
                reliability_score FLOAT,
                risk_level VARCHAR(20),
                last_updated DATETIME
            ) DEFAULT CHARSET=utf8mb4
        """))
    print("Tables ensured.")


def import_orders():
    print("Reading CSV...")
    df = pd.read_csv(DATASET_PATH, encoding="utf-8", low_memory=False)

    df = df.rename(columns={
        "Order Id": "order_id",
        "Order Item Id": "order_item_id",
        "order date (DateOrders)": "order_date",
        "shipping date (DateOrders)": "shipping_date",
        "Days for shipping (real)": "days_for_shipping_real",
        "Days for shipment (scheduled)": "days_for_shipment_scheduled",
        "Delivery Status": "delivery_status",
        "Late_delivery_risk": "late_delivery_risk",
        "Order Status": "order_status",
        "Sales": "sales",
        "Order Item Total": "order_item_total",
        "Order Item Quantity": "order_item_quantity",
        "Order Profit Per Order": "order_profit_per_order",
        "Benefit per order": "benefit_per_order",
        "Order Item Discount Rate": "order_item_discount_rate",
        "Category Id": "category_id",
        "Category Name": "category_name",
        "Department Name": "department_name",
        "Market": "market",
        "Order Region": "order_region",
        "Order Country": "order_country",
        "Customer Segment": "customer_segment",
        "Shipping Mode": "shipping_mode",
        "Product Card Id": "product_card_id",
        "Product Name": "product_name",
        "Product Price": "product_price",
    })

    cols = [
        "order_id", "order_item_id", "order_date", "shipping_date",
        "days_for_shipping_real", "days_for_shipment_scheduled",
        "delivery_status", "late_delivery_risk", "order_status",
        "sales", "order_item_total", "order_item_quantity",
        "order_profit_per_order", "benefit_per_order",
        "order_item_discount_rate", "category_id", "category_name",
        "department_name", "market", "order_region", "order_country",
        "customer_segment", "shipping_mode", "product_card_id",
        "product_name", "product_price",
    ]

    df = df[cols].copy()

    # Coerce numeric columns
    numeric_cols = [
        "days_for_shipping_real", "days_for_shipment_scheduled",
        "late_delivery_risk", "sales", "order_item_total",
        "order_item_quantity", "order_profit_per_order",
        "benefit_per_order", "order_item_discount_rate", "product_price",
    ]
    for c in numeric_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Parse dates robustly
    df["order_date"] = pd.to_datetime(
        df["order_date"], errors="coerce", format="mixed"
    )
    df["shipping_date"] = pd.to_datetime(
        df["shipping_date"], errors="coerce", format="mixed"
    )

    # Drop rows missing the key identifiers
    df = df.dropna(subset=["product_card_id", "order_date", "order_id"])
    print(f"Rows to import: {len(df)}")

    # Clear existing data
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM dataset_orders"))
        conn.execute(text("DELETE FROM dataset_suppliers"))

    df.to_sql(
        "dataset_orders",
        con=engine,
        if_exists="append",
        index=False,
        chunksize=20000,
    )
    print(f"Imported {len(df)} order rows.")


def compute_suppliers():
    with engine.begin() as conn:
        # Aggregates per supplier, then a second pass adds derived columns.
        conn.execute(text("""
            INSERT INTO dataset_suppliers (
                product_card_id, product_name, category_name,
                order_count, total_sales, on_time_rate, late_rate,
                cancel_rate, complete_rate, avg_overdue_days,
                reliability_score, risk_level, last_updated
            )
            SELECT
                product_card_id,
                MAX(product_name),
                MAX(category_name),
                COUNT(*) AS order_count,
                COALESCE(SUM(sales), 0) AS total_sales,
                ROUND(
                    100 * SUM(CASE WHEN late_delivery_risk = 0 THEN 1 ELSE 0 END)
                        / COUNT(*), 2) AS on_time_rate,
                ROUND(
                    100 * SUM(CASE WHEN late_delivery_risk = 1 THEN 1 ELSE 0 END)
                        / COUNT(*), 2) AS late_rate,
                ROUND(
                    100 * SUM(CASE WHEN delivery_status = 'Shipping canceled'
                                    OR order_status = 'CANCELED'
                                    THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancel_rate,
                ROUND(
                    100 * SUM(CASE WHEN order_status IN
                        ('COMPLETE', 'CLOSED') THEN 1 ELSE 0 END)
                        / COUNT(*), 2) AS complete_rate,
                COALESCE(ROUND(AVG(
                    CASE WHEN days_for_shipping_real > days_for_shipment_scheduled
                         THEN days_for_shipping_real - days_for_shipment_scheduled
                         ELSE 0 END), 2), 0) AS avg_overdue_days,
                0.0, 'Pending', NOW()
            FROM dataset_orders
            GROUP BY product_card_id
        """))
        # Compute reliability score + risk level (rule-based, calibrated for a
# dataset whose global on-time rate is ~45%).
# Component scores are each 0-100:
#   delivery  = on_time_rate scaled 1.7x         (30-60% real -> 51-100)
#   quality   = complete_rate scaled 1.35x       (26-73% real -> 35-100)
#   cancel    = 100 - cancel_rate*3              (0-27% real -> 100-19)
#   history   = 35 + 10*sqrt(orders+1)/5         (low-volume suppliers penalized)
#   punct     = 100 - (avg_overdue_days-0.5)*40  (0.6-1.3d real -> ~96-68)
conn.execute(text("""
            UPDATE dataset_suppliers SET
                reliability_score = ROUND(
                    0.35 * LEAST(100, on_time_rate * 1.7)
                  + 0.20 * LEAST(100, complete_rate * 1.35)
                  + 0.15 * GREATEST(0, 100 - cancel_rate * 3)
                  + 0.15 * LEAST(100,
                      35 + (10 * SQRT(order_count + 1)) / 5)
                  + 0.15 * GREATEST(0,
                      100 - (avg_overdue_days - 0.5) * 40),
                  2)
        """))
        conn.execute(text("""
            UPDATE dataset_suppliers SET
                risk_level = CASE
                    WHEN reliability_score >= 78 THEN 'Low'
                    WHEN reliability_score >= 65 THEN 'Medium'
                    ELSE 'High'
                END
        """))
    n = pd.read_sql("SELECT COUNT(*) AS n FROM dataset_suppliers", engine)
    print(f"Computed metrics for {n['n'].iloc[0]} suppliers.")


if __name__ == "__main__":
    create_tables()
    import_orders()
    compute_suppliers()
    print("Dataset import complete.")