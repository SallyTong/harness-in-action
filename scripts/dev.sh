#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== AI Homework Grader — Dev Mode ==="

# Kill any lingering processes on our ports
for port in 8000 5173; do
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
done

# Start backend
echo "[backend] Starting FastAPI on :8000..."
cd "$ROOT/apps/backend"
pip install -q -r requirements.txt 2>/dev/null || true
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "[frontend] Starting Vite on :5173..."
cd "$ROOT/apps/frontend"
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
