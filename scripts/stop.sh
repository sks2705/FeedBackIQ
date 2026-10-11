#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo " FeedbackIQ - Shutting Down Services    "
echo "=========================================="

# Stop AI Service PID if exists
if [ -f "$REPO_ROOT/scripts/.ai_service.pid" ]; then
    AI_PID=$(cat "$REPO_ROOT/scripts/.ai_service.pid")
    if kill -0 "$AI_PID" 2>/dev/null; then
        echo "Stopping AI Service (PID: $AI_PID)..."
        kill "$AI_PID" || true
    fi
    rm -f "$REPO_ROOT/scripts/.ai_service.pid"
fi

# Stop Postgres Docker container
echo "Stopping PostgreSQL Docker container..."
docker compose -f "$REPO_ROOT/docker-compose.yml" stop postgres

echo "Services shut down cleanly."
