import uuid
from sqlalchemy.dialects.postgresql import UUID
vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
