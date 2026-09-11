from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    order_number = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, default="Pending", nullable=False)  # Pending, Approved, Ordered, Delivered, Completed, Cancelled
    total_amount = Column(Float, nullable=False)
    
    # Supply Chain & Procurement Attributes (DataCo mapped)
    department = Column(String, default="Supply Chain & Logistics", nullable=True)  # Technology, Fitness, Apparel, Outdoors, etc.
    shipping_mode = Column(String, default="Standard Class", nullable=True)  # Standard Class, First Class, Second Class, Same Day
    destination_country = Column(String, default="United States", nullable=True)
    destination_city = Column(String, nullable=True)
    items_count = Column(Integer, default=1, nullable=True)
    unit_price = Column(Float, nullable=True)
    product_category = Column(String, nullable=True)
    priority = Column(String, default="Standard", nullable=True)  # Standard, High, Urgent
    notes = Column(String, nullable=True)  # Dock handling & special instructions
    
    # Dates for metrics
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expected_delivery_date = Column(Date, nullable=False)
    actual_delivery_date = Column(Date, nullable=True)
    
    # Quality & Performance Metrics
    quality_rating = Column(Float, nullable=True)  # 1.0 to 5.0
    issue_flag = Column(Boolean, default=False)
    issue_resolved = Column(Boolean, default=True)
    response_time_hours = Column(Float, nullable=True)

    # Vendor Dispatch Details (Stage 3: Ordered)
    carrier_name = Column(String, nullable=True)
    tracking_number = Column(String, nullable=True)
    dispatch_date = Column(Date, nullable=True)

    # Supply Chain QA Inspection (Stage 4: Delivered)
    qa_notes = Column(String, nullable=True)

    # Finance & Invoice Clearance (Stage 5: Completed)
    invoice_number = Column(String, nullable=True)
    invoice_amount = Column(Float, nullable=True)
    invoice_status = Column(String, default="None", nullable=False)  # None, Submitted, Paid
    payment_date = Column(Date, nullable=True)
    payment_notes = Column(String, nullable=True)

    vendor = relationship("Vendor", back_populates="purchase_orders")
