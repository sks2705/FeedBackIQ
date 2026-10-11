#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo " FeedbackIQ - Local Development Startup  "
echo "=========================================="

# 1. Prerequisite checks
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    exit 1
fi

if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "ERROR: Python 3 is not installed."
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)

# Ensure .env exists in web/
if [ ! -f "$REPO_ROOT/web/.env" ]; then
    echo "Copying web/.env.example to web/.env..."
    cp "$REPO_ROOT/web/.env.example" "$REPO_ROOT/web/.env"
fi

# 2. Start PostgreSQL via Docker Compose
echo "[1/5] Starting PostgreSQL container..."
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d postgres

echo "Waiting for PostgreSQL to be ready..."
until docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T postgres pg_isready -U feedbackiq -d feedbackiq &> /dev/null; do
    sleep 1
done
echo "PostgreSQL is ready!"

# 3. Run Prisma migrations in web/
echo "[2/5] Running Prisma migrations..."
(cd "$REPO_ROOT/web" && npx prisma migrate deploy)

# 4. Setup & Start AI service in venv
echo "[3/5] Setting up AI Service virtualenv..."
AI_DIR="$REPO_ROOT/ai-service"

if [ ! -d "$AI_DIR/venv" ]; then
    echo "Creating virtualenv in $AI_DIR/venv..."
    $PYTHON_CMD -m venv "$AI_DIR/venv"
    "$AI_DIR/venv/bin/pip" install --upgrade pip
    "$AI_DIR/venv/bin/pip" install --extra-index-url https://download.pytorch.org/whl/cpu -r "$AI_DIR/requirements.txt"
fi

echo "[4/5] Starting AI Service in background..."
"$AI_DIR/venv/bin/uvicorn" main:app --app-dir "$AI_DIR" --host 0.0.0.0 --port 8000 &
AI_PID=$!
echo $AI_PID > "$REPO_ROOT/scripts/.ai_service.pid"

echo "Waiting for AI Service GET /health..."
until curl -s http://localhost:8000/health | grep -q '"status":"ok"'; do
    sleep 1
done
echo "AI Service is healthy!"

# 5. Start Web App
echo "[5/5] Starting Next.js Web App on http://localhost:3000..."
echo "Press Ctrl+C or run scripts/stop.sh to terminate services."
(cd "$REPO_ROOT/frontend" && npm run dev)
