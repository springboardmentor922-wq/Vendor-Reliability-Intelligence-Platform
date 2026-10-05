from fastapi import APIRouter, HTTPException, status

from app.schemas.dataset_analytics import DatasetAnalyticsResponse
from app.services.dataset_analytics import get_dataset_analytics


router = APIRouter(
    prefix="/api/dataset-analytics",
    tags=["Dataset Analytics"],
)


@router.get(
    "",
    response_model=DatasetAnalyticsResponse,
)
def dataset_analytics():
    try:
        return get_dataset_analytics()

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process the supply-chain dataset.",
        )