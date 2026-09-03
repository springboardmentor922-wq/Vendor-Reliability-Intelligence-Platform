from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router

app = FastAPI(
    title="Vendor IQ API",
    description="Vendor Reliability Intelligence Platform",
    version="1.0.0"
)

# CORS configuration for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication routes (/register, /login, /refresh-token)
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])

@app.get("/")
def root():
    return {"status": "online", "message": "Vendor IQ API is running"}