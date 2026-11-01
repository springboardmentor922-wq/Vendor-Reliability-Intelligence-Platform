from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class ItemCategory(Base):
    __tablename__ = "item_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("Item", back_populates="category", cascade="all, delete-orphan")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("item_categories.id", ondelete="CASCADE"), nullable=True)
    category_name = Column(String(100), nullable=False) # e.g. "IT & Electronics"
    name = Column(String(150), nullable=False, index=True) # e.g. "Laptop"
    sku = Column(String(50), unique=True, nullable=True)
    unit = Column(String(50), default="Units") # Units, Kg, Hours, Packages
    estimated_unit_price = Column(Float, default=0.0)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("ItemCategory", back_populates="items")
