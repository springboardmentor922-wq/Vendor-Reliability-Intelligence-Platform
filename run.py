"""
VendorIQ - Predictive Vendor Intelligence Platform Launcher
Run this script to start the complete full-stack web application.
"""
import sys
import os
from pathlib import Path
import uvicorn

# Ensure project root is in python path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

from backend.database import DB_PATH
from backend.etl_seed import seed_database

def main():
    print("=" * 65)
    print("   VENDORIQ - PREDICTIVE VENDOR INTELLIGENCE PLATFORM")
    print("   Enterprise Supplier Risk & Performance Intelligence")
    print("=" * 65)

    if not DB_PATH.exists():
        print("[*] Database not detected. Running automated database setup and ETL seed...")
        seed_database()
        print("[+] Database initialized and seeded successfully.")
    else:
        print("[+] Database connected: backend/vendoriq.db")

    print("\n[*] Starting FastAPI & Enterprise Web Application on http://127.0.0.1:8000")
    print("    - Interactive API Docs: http://127.0.0.1:8000/docs")
    print("    - Web Platform:         http://127.0.0.1:8000")
    print("    - Demo Mode:            6 Clickable Roles on Landing Page")
    print("\nPress Ctrl+C to stop the server.\n")

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()
