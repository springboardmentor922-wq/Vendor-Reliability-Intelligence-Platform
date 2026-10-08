from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)

    item_description = Column(String(300), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    tax_percent = Column(Float, default=0.0)  # e.g. 18 for 18%
    line_total = Column(Float, nullable=False)  # quantity * unit_price * (1 + tax_percent/100)

    purchase_order = relationship("PurchaseOrder", back_populates="items")