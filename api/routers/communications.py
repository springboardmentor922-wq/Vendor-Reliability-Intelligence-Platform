"""
api/routers/communications.py
-----------------------------
FastAPI endpoints for Communication & Threaded Messaging.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.communication_service import (
    send_message,
    get_messages,
    get_all_threads,
    get_thread_stats,
)

router = APIRouter(prefix="/communications", tags=["Communications"])


class MessageSendRequest(BaseModel):
    sender_id: str
    sender_name: str
    thread_type: str
    thread_id: str
    thread_label: str
    content: str


@router.get("/threads")
def list_threads(
    thread_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    """List conversation threads."""
    return get_all_threads(thread_type=thread_type, limit=limit)


@router.get("/threads/{thread_type}/{thread_id}/messages")
def list_messages(thread_type: str, thread_id: str):
    """Retrieve message history for a specific thread."""
    return get_messages(thread_type=thread_type, thread_id=thread_id)


@router.get("/stats")
def thread_stats():
    """Communication statistics."""
    return get_thread_stats()


@router.post("/messages")
def post_message(payload: MessageSendRequest):
    """Send a message to a thread."""
    success, result = send_message(
        sender_id=payload.sender_id,
        sender_name=payload.sender_name,
        thread_type=payload.thread_type,
        thread_id=payload.thread_id,
        thread_label=payload.thread_label,
        content=payload.content,
    )
    if not success:
        raise HTTPException(status_code=400, detail=result)
    return {"message": "Message sent.", "doc": result}
