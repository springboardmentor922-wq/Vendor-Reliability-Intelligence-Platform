"""
api/client.py
-------------
HTTP API Client for Streamlit to communicate with FastAPI backend.
Seamlessly falls back to direct services if the API server is unavailable.
"""

import logging
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)

API_BASE_URL = "http://127.0.0.1:8000/api"
TIMEOUT = 5.0


def api_get(endpoint: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Perform a GET request to the FastAPI backend."""
    url = f"{API_BASE_URL}{endpoint if endpoint.startswith('/') else '/' + endpoint}"
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.warning("API GET %s returned %d: %s", url, resp.status_code, resp.text)
    except Exception as exc:
        logger.debug("FastAPI direct connection not reachable (%s), using service fallback: %s", url, exc)
    return None


def api_post(endpoint: str, json_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Perform a POST request to the FastAPI backend."""
    url = f"{API_BASE_URL}{endpoint if endpoint.startswith('/') else '/' + endpoint}"
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.post(url, json=json_data)
            if resp.status_code in (200, 201):
                return resp.json()
            logger.warning("API POST %s returned %d: %s", url, resp.status_code, resp.text)
    except Exception as exc:
        logger.debug("FastAPI direct connection error (%s): %s", url, exc)
    return None
