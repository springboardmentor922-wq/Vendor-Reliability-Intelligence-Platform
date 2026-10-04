from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db, Base, engine
from app.seed_data import seed_database

router = APIRouter(prefix="/seed", tags=["Seed Data"])

@router.post("")
def run_seed(db: Session = Depends(get_db)):
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    return seed_database(db)

@router.post("/reset")
def reset_and_seed(db: Session = Depends(get_db)):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return seed_database(db)
