#!/usr/bin/env bash
set -euo pipefail

echo "=== AI Homework Grader — Dev Mode ==="

# Start backend
echo "[backend] Starting FastAPI on :8000..."
cd "$(dirname "$0")/../apps/backend"
pip install -q -r requirements.txt 2>/dev/null || true
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "[frontend] Starting Vite on :5173..."
cd "$(dirname "$0")/../apps/frontend"
npm install --silent 2>/dev/null || true
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
echo ""
echo "  Frontend → http://localhost:5173"
echo "  Backend  → http://localhost:8000"
echo "  Health   → http://localhost:8000/api/health"
echo ""
wait
