import csv
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any


DATASET_PATH = (
    Path(__file__).resolve().parents[2]
    / "dataset"
    / "dataset.csv"
)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    try:
        return int(float(text))
    except (TypeError, ValueError):
        return None


def _parse_month(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    formats = [
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]

    for date_format in formats:
        try:
            parsed = datetime.strptime(text, date_format)
            return parsed.strftime("%Y-%m")
        except ValueError:
            continue

    return None


def _percentage(part: int, total: int) -> float:
    if total == 0:
        return 0.0

    return round((part / total) * 100, 2)


def _round(value: float, digits: int = 2) -> float:
    return round(value, digits)


@lru_cache(maxsize=4)
def _calculate_dataset_analytics(file_modified_time: float) -> dict:
    del file_modified_time

    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset file not found: {DATASET_PATH}"
        )

    total_records = 0
    unique_orders: set[str] = set()

    late_delivery_count = 0
    advance_shipping_count = 0
    shipping_on_time_count = 0
    shipping_canceled_count = 0

    actual_shipping_total = 0.0
    actual_shipping_count = 0

    scheduled_shipping_total = 0.0
    scheduled_shipping_count = 0

    shipping_delay_total = 0.0
    shipping_delay_count = 0

    total_sales = 0.0
    total_profit = 0.0
    total_order_item_value = 0.0
    order_item_value_count = 0

    shipping_mode_counts: dict[str, int] = {}
    market_counts: dict[str, int] = {}

    monthly_data: dict[str, dict[str, int]] = {}

    with DATASET_PATH.open(
        "r",
        encoding="latin1",
        newline="",
    ) as csv_file:

        reader = csv.DictReader(csv_file)

        required_columns = {
            "Delivery Status",
            "Late_delivery_risk",
            "Days for shipping (real)",
            "Days for shipment (scheduled)",
            "Order Id",
            "Sales",
            "Order Item Total",
            "Order Profit Per Order",
            "Shipping Mode",
            "Market",
            "order date (DateOrders)",
        }

        available_columns = set(reader.fieldnames or [])
        missing_columns = required_columns - available_columns

        if missing_columns:
            raise ValueError(
                "Dataset is missing required columns: "
                + ", ".join(sorted(missing_columns))
            )

        for row in reader:
            total_records += 1

            order_id = str(row.get("Order Id", "")).strip()

            if order_id:
                unique_orders.add(order_id)

            delivery_status = (
                str(row.get("Delivery Status", "")).strip()
            )

            if delivery_status == "Late delivery":
                late_delivery_count += 1

            elif delivery_status == "Advance shipping":
                advance_shipping_count += 1

            elif delivery_status == "Shipping on time":
                shipping_on_time_count += 1

            elif delivery_status == "Shipping canceled":
                shipping_canceled_count += 1

            actual_days = _to_float(
                row.get("Days for shipping (real)")
            )

            scheduled_days = _to_float(
                row.get("Days for shipment (scheduled)")
            )

            if actual_days is not None:
                actual_shipping_total += actual_days
                actual_shipping_count += 1

            if scheduled_days is not None:
                scheduled_shipping_total += scheduled_days
                scheduled_shipping_count += 1

            if (
                actual_days is not None
                and scheduled_days is not None
            ):
                shipping_delay_total += (
                    actual_days - scheduled_days
                )
                shipping_delay_count += 1

            sales = _to_float(row.get("Sales"))

            if sales is not None:
                total_sales += sales

            profit = _to_float(
                row.get("Order Profit Per Order")
            )

            if profit is not None:
                total_profit += profit

            order_item_value = _to_float(
                row.get("Order Item Total")
            )

            if order_item_value is not None:
                total_order_item_value += order_item_value
                order_item_value_count += 1

            shipping_mode = (
                str(row.get("Shipping Mode", "")).strip()
                or "Unknown"
            )

            shipping_mode_counts[shipping_mode] = (
                shipping_mode_counts.get(shipping_mode, 0) + 1
            )

            market = (
                str(row.get("Market", "")).strip()
                or "Unknown"
            )

            market_counts[market] = (
                market_counts.get(market, 0) + 1
            )

            month = _parse_month(
                row.get("order date (DateOrders)")
            )

            if month:
                if month not in monthly_data:
                    monthly_data[month] = {
                        "total_records": 0,
                        "late_deliveries": 0,
                        "on_time_deliveries": 0,
                    }

                monthly_data[month]["total_records"] += 1

                if delivery_status == "Late delivery":
                    monthly_data[month]["late_deliveries"] += 1

                if delivery_status == "Shipping on time":
                    monthly_data[month]["on_time_deliveries"] += 1

    shipping_modes = [
        {
            "shipping_mode": mode,
            "records": count,
            "percentage": _percentage(count, total_records),
        }
        for mode, count in sorted(
            shipping_mode_counts.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    markets = [
        {
            "market": market,
            "records": count,
            "percentage": _percentage(count, total_records),
        }
        for market, count in sorted(
            market_counts.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    monthly_trend = []

    for month in sorted(monthly_data.keys()):
        data = monthly_data[month]

        delivery_records = (
            data["late_deliveries"]
            + data["on_time_deliveries"]
        )

        monthly_trend.append(
            {
                "month": month,
                "total_records": data["total_records"],
                "late_deliveries": data["late_deliveries"],
                "on_time_deliveries": data["on_time_deliveries"],
                "late_delivery_rate": _percentage(
                    data["late_deliveries"],
                    delivery_records,
                ),
            }
        )

    late_delivery_rate = _percentage(
        late_delivery_count,
        total_records,
    )

    delivery_records = (
        late_delivery_count
        + shipping_on_time_count
        + advance_shipping_count
    )

    on_time_delivery_rate = _percentage(
        shipping_on_time_count + advance_shipping_count,
        delivery_records,
    )

    average_actual_shipping_days = (
        actual_shipping_total / actual_shipping_count
        if actual_shipping_count
        else 0.0
    )

    average_scheduled_shipping_days = (
        scheduled_shipping_total / scheduled_shipping_count
        if scheduled_shipping_count
        else 0.0
    )

    average_shipping_delay_days = (
        shipping_delay_total / shipping_delay_count
        if shipping_delay_count
        else 0.0
    )

    average_order_item_value = (
        total_order_item_value / order_item_value_count
        if order_item_value_count
        else 0.0
    )

    return {
        "dataset_name": DATASET_PATH.name,
        "total_records": total_records,
        "unique_orders": len(unique_orders),

        "late_delivery_count": late_delivery_count,
        "late_delivery_rate": _round(late_delivery_rate),
        "on_time_delivery_rate": _round(on_time_delivery_rate),

        "average_actual_shipping_days": _round(
            average_actual_shipping_days
        ),
        "average_scheduled_shipping_days": _round(
            average_scheduled_shipping_days
        ),
        "average_shipping_delay_days": _round(
            average_shipping_delay_days
        ),

        "total_sales": _round(total_sales),
        "total_profit": _round(total_profit),
        "average_order_item_value": _round(
            average_order_item_value
        ),

        "delivery_status": {
            "late_delivery": late_delivery_count,
            "advance_shipping": advance_shipping_count,
            "shipping_on_time": shipping_on_time_count,
            "shipping_canceled": shipping_canceled_count,
        },

        "shipping_modes": shipping_modes,
        "markets": markets,
        "monthly_trend": monthly_trend,
    }


def get_dataset_analytics() -> dict:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset file not found: {DATASET_PATH}"
        )

    modified_time = DATASET_PATH.stat().st_mtime

    return _calculate_dataset_analytics(modified_time)