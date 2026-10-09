"""Import the DataCo Supply Chain dataset into VendorIQ PostgreSQL.

The DataCo source has no real vendor identity field, so these historical rows are
used only for product-level supplier-proxy intelligence in the dataset_* tables.
Operational VendorIQ vendors remain separate.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import text

# Load .env from the project root and backend folder when present.
HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
load_dotenv(HERE / ".env")

from database import engine  # noqa: E402


DEFAULT_DATASET = (
    HERE.parent
    / "frontend"
    / "data"
    / "DataCoSupplyChainDataset - DataCoSupplyChainDataset.csv"
)


COLUMN_MAP = {
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
}


REQUIRED_COLUMNS = list(COLUMN_MAP)
OUTPUT_COLUMNS = list(COLUMN_MAP.values())

NUMERIC_COLUMNS = [
    "days_for_shipping_real",
    "days_for_shipment_scheduled",
    "late_delivery_risk",
    "sales",
    "order_item_total",
    "order_item_quantity",
    "order_profit_per_order",
    "benefit_per_order",
    "order_item_discount_rate",
    "product_price",
]


def verify_tables() -> None:
    with engine.connect() as conn:
        orders = conn.execute(
            text("SELECT to_regclass('public.dataset_orders')")
        ).scalar()

        suppliers = conn.execute(
            text("SELECT to_regclass('public.dataset_suppliers')")
        ).scalar()

    if orders is None or suppliers is None:
        raise RuntimeError(
            "dataset_orders/dataset_suppliers do not exist. "
            "Run: python -m alembic upgrade head"
        )


def prepare_frame(
    df: pd.DataFrame,
) -> pd.DataFrame:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]

    if missing:
        raise RuntimeError("The CSV is missing required columns: " + ", ".join(missing))

    df = df.rename(columns=COLUMN_MAP)[OUTPUT_COLUMNS].copy()

    for column in NUMERIC_COLUMNS:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    df["order_date"] = pd.to_datetime(
        df["order_date"],
        errors="coerce",
        format="mixed",
    )

    df["shipping_date"] = pd.to_datetime(
        df["shipping_date"],
        errors="coerce",
        format="mixed",
    )

    df = df.dropna(
        subset=[
            "product_card_id",
            "order_date",
            "order_id",
        ]
    )

    df["product_card_id"] = df["product_card_id"].astype(str)

    df["order_id"] = df["order_id"].astype(str)

    df["order_item_id"] = df["order_item_id"].astype(str)

    return df


def clear_dataset_tables() -> None:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE dataset_orders RESTART IDENTITY"))

        conn.execute(text("TRUNCATE TABLE dataset_suppliers"))


def import_orders(
    dataset_path: Path,
    chunk_size: int = 2_000,
) -> int:

    if not dataset_path.exists():
        raise FileNotFoundError(f"DataCo CSV not found: {dataset_path}")

    print(f"Loading dataset: {dataset_path}")

    clear_dataset_tables()

    total = 0

    for chunk_no, chunk in enumerate(
        pd.read_csv(
            dataset_path,
            encoding="utf-8",
            low_memory=False,
            chunksize=chunk_size,
        ),
        start=1,
    ):
        prepared = prepare_frame(chunk)

        if prepared.empty:
            continue

        prepared.to_sql(
            "dataset_orders",
            con=engine,
            if_exists="append",
            index=False,
            chunksize=2_000,
            method="multi",
        )

        total += len(prepared)

        print(f"  imported chunk {chunk_no}: {total:,} rows")

    if total == 0:
        raise RuntimeError("No valid rows were imported from the DataCo CSV.")

    print(f"Imported {total:,} historical records.")

    return total


def compute_supplier_proxies() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO dataset_suppliers (
                    product_card_id,
                    product_name,
                    category_name,
                    order_count,
                    total_sales,
                    on_time_rate,
                    late_rate,
                    cancel_rate,
                    complete_rate,
                    avg_overdue_days,
                    reliability_score,
                    risk_level,
                    last_updated
                )
                SELECT
                    product_card_id,
                    MAX(product_name),
                    MAX(category_name),
                    COUNT(*),
                    COALESCE(SUM(sales), 0),

                    ROUND(
                        100.0 * SUM(
                            CASE
                                WHEN late_delivery_risk = 0
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        2
                    ),

                    ROUND(
                        100.0 * SUM(
                            CASE
                                WHEN late_delivery_risk = 1
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        2
                    ),

                    ROUND(
                        100.0 * SUM(
                            CASE
                                WHEN delivery_status =
                                    'Shipping canceled'
                                  OR order_status =
                                    'CANCELED'
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        2
                    ),

                    ROUND(
                        100.0 * SUM(
                            CASE
                                WHEN order_status IN (
                                    'COMPLETE',
                                    'CLOSED'
                                )
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        2
                    ),

                    COALESCE(
                        ROUND(
                            AVG(
                                CASE
                                    WHEN
                                        days_for_shipping_real >
                                        days_for_shipment_scheduled
                                    THEN
                                        days_for_shipping_real -
                                        days_for_shipment_scheduled
                                    ELSE 0
                                END
                            )::numeric,
                            2
                        ),
                        0
                    ),

                    0,
                    'Pending',
                    NOW()

                FROM dataset_orders

                GROUP BY product_card_id
                """
            )
        )

        conn.execute(
            text(
                """
                UPDATE dataset_suppliers

                SET reliability_score = ROUND(
                    (
                        0.35 *
                        LEAST(
                            100,
                            on_time_rate * 1.7
                        )

                        +

                        0.20 *
                        LEAST(
                            100,
                            complete_rate * 1.35
                        )

                        +

                        0.15 *
                        GREATEST(
                            0,
                            100 - cancel_rate * 3
                        )

                        +

                        0.15 *
                        LEAST(
                            100,
                            35 + 2 * SQRT(
                                order_count + 1
                            )
                        )

                        +

                        0.15 *
                        GREATEST(
                            0,
                            100 -
                            GREATEST(
                                0,
                                avg_overdue_days - 0.5
                            ) * 40
                        )

                    )::numeric,
                    2
                )
                """
            )
        )

        conn.execute(
            text(
                """
                UPDATE dataset_suppliers

                SET risk_level =
                    CASE
                        WHEN reliability_score >= 78
                            THEN 'Low'

                        WHEN reliability_score >= 65
                            THEN 'Medium'

                        ELSE 'High'
                    END
                """
            )
        )

    print("Supplier proxy metrics computed.")


def show_counts() -> None:
    with engine.connect() as conn:
        orders = conn.execute(text("SELECT COUNT(*) FROM dataset_orders")).scalar()

        suppliers = conn.execute(
            text("SELECT COUNT(*) FROM dataset_suppliers")
        ).scalar()

    print(f"dataset_orders:     {orders:,}")

    print(f"dataset_suppliers:  {suppliers:,}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=("Import DataCo historical supply-chain data into VendorIQ.")
    )

    parser.add_argument(
        "--csv",
        dest="csv_path",
        default=os.getenv(
            "DATACO_DATASET_PATH",
            str(DEFAULT_DATASET),
        ),
        help="Path to DataCoSupplyChainDataset CSV",
    )

    args = parser.parse_args()

    dataset_path = Path(args.csv_path).expanduser().resolve()

    verify_tables()

    import_orders(dataset_path)

    compute_supplier_proxies()

    show_counts()


if __name__ == "__main__":
    main()
