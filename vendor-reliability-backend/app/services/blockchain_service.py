import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from app.db.session import SessionLocal

logger = logging.getLogger("blockchain_service")

def generate_transaction_hash(entity_type: str, entity_id: int, payload_data: Dict[str, Any]) -> str:
    """Computes SHA-256 cryptographic audit integrity hash for a business transaction."""
    serialized = json.dumps(payload_data, sort_keys=True, default=str)
    raw_str = f"{entity_type}:{entity_id}:{serialized}:{datetime.utcnow().isoformat()}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

def record_blockchain_audit_async(
    entity_type: str,
    entity_id: int,
    action: str,
    actor_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Non-blocking background worker task for blockchain audit integrity layer.
    Computes cryptographic block hash, commits blockchain status from PENDING -> CONFIRMED.
    Executes in FastAPI background tasks AFTER the main HTTP response has been returned.
    """
    db = SessionLocal()
    try:
        tx_hash = generate_transaction_hash(entity_type, entity_id, {
            "action": action,
            "actor_id": actor_id,
            "metadata": metadata or {}
        })

        # Update entity blockchain status if supported
        now = datetime.utcnow()
        if entity_type == "ProcurementRequest":
            from app.models.procurement import ProcurementRequest
            entity = db.query(ProcurementRequest).filter(ProcurementRequest.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now
        elif entity_type == "PurchaseOrder":
            from app.models.purchase_order import PurchaseOrder
            entity = db.query(PurchaseOrder).filter(PurchaseOrder.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now
        elif entity_type == "VendorSelection":
            from app.models.vendor_selection import VendorSelection
            entity = db.query(VendorSelection).filter(VendorSelection.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now
        elif entity_type == "FinancialApproval":
            from app.models.financial_approval import FinancialApproval
            entity = db.query(FinancialApproval).filter(FinancialApproval.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now
        elif entity_type == "Delivery":
            from app.models.delivery import Delivery
            entity = db.query(Delivery).filter(Delivery.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now
        elif entity_type == "Invoice":
            from app.models.invoice import Invoice
            entity = db.query(Invoice).filter(Invoice.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now
        elif entity_type == "Payment":
            from app.models.payment import Payment
            entity = db.query(Payment).filter(Payment.id == entity_id).first()
            if entity:
                entity.blockchain_status = "CONFIRMED"
                entity.blockchain_tx_hash = tx_hash
                entity.blockchain_confirmed_at = now

        db.commit()
    except Exception as e:
        logger.error(f"Blockchain audit recording error for {entity_type} #{entity_id}: {e}")
        try:
            db.rollback()
        except:
            pass
    finally:
        db.close()
