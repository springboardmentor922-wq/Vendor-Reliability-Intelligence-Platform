@echo off
echo ============================================================
echo   Starting ProcuraHub Enterprise Platform (Milestone 1-4)
echo ============================================================
echo.

cd backend
echo Starting FastAPI Backend Server on port 8001...
start "ProcuraHub Backend" venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
cd ..

echo Starting Frontend Server on port 5500...
cd frontend
start "ProcuraHub Frontend" python -m http.server 5500
cd ..

echo.
echo Platform successfully initialized!
echo - Frontend UI: http://127.0.0.1:5500
echo - Backend API: http://127.0.0.1:8001
echo - API Docs:    http://127.0.0.1:8001/docs
echo.
pause
