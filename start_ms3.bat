@echo off
REM ============================================================
REM  Vendor Reliability Platform - MS1/MS2/MS3 launcher
REM  Starts the FastAPI backend (port 8001) and serves the
REM  frontend (port 5500). Open http://127.0.0.1:5500 afterwards.
REM ============================================================
echo Starting backend on http://127.0.0.1:8001 ...
start "VR-Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"

echo Starting frontend on http://127.0.0.1:5500 ...
start "VR-Frontend" cmd /k "cd /d %~dp0frontend && ..\backend\venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1"

echo.
echo Both servers should be starting. Open:  http://127.0.0.1:5500
echo Demo login: admin@example.com / admin123
echo.
pause