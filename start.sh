#!/usr/bin/env bash

echo "=================================================="
echo "  Starting VendorIQ (Backend + Frontend)          "
echo "=================================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[1/2] Starting FastAPI Backend at http://localhost:8000..."
(cd "$DIR/backend" && python -m uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

sleep 2

echo "[2/2] Starting React Frontend at http://localhost:5173..."
(cd "$DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo " Both services running:"
echo "   - Backend API:  http://localhost:8000"
echo "   - Swagger Docs: http://localhost:8000/docs"
echo "   - Frontend UI:  http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT
wait
