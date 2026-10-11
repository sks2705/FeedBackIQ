# FeedbackIQ Docker Deployment Guide

This guide details building, running, and maintaining FeedbackIQ using Docker and Docker Compose.

---

## 1. Quick Start Commands

### A. Build and Start All Containers
```powershell
# Copy environment template
cp .env.example .env

# Build images and start all services in background
docker compose up --build -d
```

### B. Verify Container Health
```powershell
docker compose ps
```

### C. Check Logs
```powershell
# View logs across all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f ai-service
```

### D. Execute Shell in Container
```powershell
docker compose exec -it backend sh
docker compose exec -it ai-service sh
```

### E. Create Admin Account inside Web Container
```powershell
docker compose exec -it backend node scripts/create-admin.js admin@feedbackiq.local AdminPassword123!
```

### F. Stop Services
```powershell
# Stop services (persists data in volumes)
docker compose down

# Stop and wipe database data volumes
docker compose down -v
```

---

## 2. Proving No Secrets in Docker Images

Run the following commands to audit that no secrets exist in image layers:
```powershell
docker history feedbackiq/feedbackiq-backend:latest
docker history feedbackiq/feedbackiq-ai:latest
docker compose config
```

---

## 3. Resource Measurements & VM Sizing

Run `docker images` and `docker stats --no-stream` after 10 analyzed submissions to fill in the real metrics on your machine:

| Container | Image Name | Image Size | Idle RAM | RAM after 10 Submissions |
|---|---|---|---|---|
| `caddy` | `caddy:2-alpine` | ~50 MB | ___ MB | ___ MB |
| `backend` | `feedbackiq/feedbackiq-backend:latest` | ~220 MB | ___ MB | ___ MB |
| `ai-service` | `feedbackiq/feedbackiq-ai:latest` | ~1.3 GB | ___ MB | ___ MB |
| `caddy` | `caddy:2-alpine` | ~50 MB | ___ MB | ___ MB |

### Minimum Cloud VM Recommendation:
- **Recommended Spec**: **2 vCPU, 4 GB RAM** (e.g. AWS `t3.medium`, DigitalOcean 4GB Droplet, or Hetzner CPX21).
- **Rationale**: The PyTorch CPU RoBERTa model requires ~1.2 GB RAM in memory. Adding Next.js (~250 MB), Postgres (~150 MB), and OS buffers brings total baseline memory to ~2.5 GB. A 4 GB VM ensures zero OOM killer events under concurrent requests.
