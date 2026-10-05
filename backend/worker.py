from celery_app import celery_app
import tasks  # noqa: F401

__all__ = ["celery_app"]
