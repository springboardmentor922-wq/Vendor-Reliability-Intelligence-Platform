# Import all models here so Base.metadata knows about them for create_all()
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.vendor import Vendor, VendorContact  # noqa
from app.models.procurement import ProcurementRequest  # noqa
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, Invoice  # noqa
from app.models.contract import Contract, Certification  # noqa
from app.models.communication import Message, ActivityLog, Notification  # noqa
