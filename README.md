# FeedbackIQ

> **Turn feedback into actionable insights**

**Live Application URL**: [https://feedbackiq.yourdomain.com](https://feedbackiq.yourdomain.com)

---

## 1. Overview & Key Features

FeedbackIQ is an AI-powered feedback management platform designed to automate customer feedback intake, sentiment classification, category routing, priority rating, and executive summarization. It allows users to submit feedback with optional screenshot attachments while providing admins with a real-time intelligence dashboard and analytics suite. Built with high-performance modern web tech and local AI models, FeedbackIQ operates without external third-party AI APIs or monthly SaaS fees.

### Key Features
- **Public Submission Portal**: Clean, accessible feedback form with optional screenshot attachment uploads (PNG, JPEG, WebP) up to 5 MB.
- **AI Intelligence Pipeline**: Pre-trained Hugging Face RoBERTa transformer sentiment analysis, rule-based category scoring, deterministic priority matrix, and extractive summary generation.
- **Admin Dashboard & Analytics**: Role-based access control (Admin / Viewer), real-time filtering, search, interactive Recharts trends, status management, and CSV export.
- **Private S3 Cloud Storage**: Secure screenshot storage with authenticated server-side streaming proxy and strict security headers.
- **Containerized Infrastructure**: Docker Compose setup with Caddy HTTPS reverse proxy, automatic Let's Encrypt TLS certificates, and isolated internal networks.

---

## 2. Application Screenshots

| Public Feedback Form | Admin Dashboard |
|---|---|
| ![Public Form](docs/images/01_public_form.png) | ![Admin Dashboard](docs/images/02_admin_dashboard.png) |

| Feedback Detail View | Architecture Diagram |
|---|---|
| ![Feedback Detail](docs/images/03_feedback_detail.png) | ![Architecture](docs/images/04_architecture.png) |

---

## 3. Architecture & Request Flow

```mermaid
graph TD
    Client["User Browser / Client"] -->|HTTPS / Port 443| Caddy["Caddy Reverse Proxy"]
    Caddy -->|HTTP / Port 3000| Web["Next.js Web Service (Node 20)"]
    Web -->|SQL / Port 5432| DB[("PostgreSQL 16 Database")]
    Web -->|HTTP / Port 8000| AI["FastAPI AI Service (Python 3.11)"]
    Web -->|AWS SDK v3| S3[("AWS S3 Bucket (Private Storage)")]
```

### 5-Line Request Flow & Failure Behavior
1. The user submits a feedback item (and optional screenshot) to Caddy over HTTPS (`port 443`).
2. Caddy validates body size (max 6MB) and forwards the request to the backend (`backend:3000`).
3. The backend uploads the validated image to AWS S3 (`uploads/<uuid>.<ext>`) and saves the record in PostgreSQL using `DATABASE_URL` as `PENDING`.
4. Next.js triggers an async REST request (`POST /analyze`) to the Python FastAPI AI service (`ai-service:8000`).
5. **Failure & Retry Behavior**: If the AI service is offline or times out (15s), Next.js marks `analysisStatus` as `FAILED` with `analysisError` logged. Admins can click **Reanalyze** from the dashboard to re-trigger the AI pipeline once the service recovers.

---

## 4. Tech Stack & Dependencies

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend & Web API** | Next.js (App Router) | `16.4.0` | Server-rendered UI & REST route handlers |
| **UI Library** | React | `19.3.0` | Reactive UI component tree |
| **Styling** | Tailwind CSS | `^4.0.0` | Responsive utility-first dark theme |
| **Data Visualization** | Recharts | `3.10.1` | Analytics charts and category distribution |
| **Database ORM** | Prisma | `6.4.0` | PostgreSQL schema modeling & migrations |
| **Database Engine** | PostgreSQL | `16-alpine` | Relational data persistence |
| **Cloud Storage** | `@aws-sdk/client-s3` | `^3.731.0` | AWS S3 object storage integration |
| **AI Framework** | Python FastAPI | `0.115.0` | Microservice web server for NLP pipeline |
| **Sentiment Model** | Hugging Face Transformers | `4.44.2` | RoBERTa sequence classification pipeline |
| **Machine Learning** | PyTorch (CPU) | `2.4.1` | CPU tensor evaluation engine |
| **Reverse Proxy** | Caddy | `2-alpine` | Automatic HTTPS TLS & security headers |

---

## 5. Running Locally with Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)
- Node.js 20+ (optional for local CLI scripts)

### Setup & Run Commands
```bash
# 1. Clone repository & change directory
cd feedbackiq

# 2. Copy environment template
cp .env.example .env

# 3. Build and launch all containers
docker compose up --build -d

# 4. Create local admin user account inside web container
docker compose exec -it backend node scripts/create-admin.js admin@feedbackiq.local AdminPassword123!

# 5. Access local HTTPS application
# Open https://localhost in your browser (accept local Caddy self-signed certificate)

# 6. Stop containers & reset database
docker compose down -v
```

---

## 6. Environment Variables Reference

Secrets come strictly from `.env` at runtime and are **never** committed to version control.

| Variable Name | Purpose | Example Value | Required? |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require` | Required |
| `DIRECT_URL` | Direct PostgreSQL connection used by the backend and Prisma migrations; never use the pooler URL | `postgresql://USER:PASSWORD@DIRECT_HOST:5432/DATABASE?sslmode=require` | Required |
| `POSTGRES_USER` | Database username | `feedbackiq` | Required |
| `POSTGRES_PASSWORD` | Database password | `secure_db_pass` | Required |
| `JWT_SECRET` | Secret key for HS256 session token signing | `random_32_character_string` | Required |
| `TRUST_PROXY` | Enable reverse proxy header parsing | `true` | Required |
| `S3_BUCKET` | AWS S3 bucket name | `feedbackiq-attachments-production` | Required |
| `S3_REGION` | AWS S3 region | `us-east-1` | Required |
| `S3_ACCESS_KEY_ID` | Local dev access key | `AKIA...` (Leave empty on EC2 IAM Role) | Optional |
| `S3_SECRET_ACCESS_KEY` | Local dev secret key | `wJal...` (Leave empty on EC2 IAM Role) | Optional |
| `MAX_UPLOAD_MB` | Maximum allowed upload size | `5` | Required |
| `APP_DOMAIN` | Production domain or localhost | `feedbackiq.yourdomain.com` | Required |
| `ACME_EMAIL` | Let's Encrypt TLS notification email | `admin@yourdomain.com` | Required |

---

## 7. Cloud Deployment Summary

FeedbackIQ is designed for single-command production cloud deployment on an AWS EC2 `t3.medium` VM with S3 IAM Role integration and Caddy HTTPS reverse proxy.

Refer to the complete, step-by-step deployment runbook:
👉 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## 8. REST API Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/feedback` | Public | Submit new feedback item (optional `attachmentKey`) |
| `POST` | `/api/uploads` | Public | Upload screenshot file (PNG, JPEG, WebP, max 5MB) |
| `GET` | `/api/health` | Public | Probes DB, AI Service, and S3 Storage status |
| `POST` | `/api/auth/login` | Public | Authenticate user and issue HTTP-only session cookie |
| `GET` | `/api/auth/me` | Logged In | Return current authenticated user payload |
| `POST` | `/api/auth/logout` | Logged In | Clear session cookie |
| `GET` | `/api/feedback` | Logged In | List feedback with search, filter, and pagination |
| `GET` | `/api/feedback/:id` | Logged In | Get feedback record details and attachment proxy URL |
| `PATCH` | `/api/feedback/:id/status` | Admin | Update status (`NEW`, `REVIEWING`, `RESOLVED`) |
| `POST` | `/api/feedback/:id/reanalyze` | Admin | Re-run AI analysis pipeline on record |
| `GET` | `/api/analytics/summary` | Logged In | Get summary metrics, sentiment/priority, and trend |
| `GET` | `/api/feedback/export` | Logged In | Export filtered feedback dataset as CSV |
| `GET` | `/api/attachments/:id` | Logged In | Authenticated inline stream of S3 attachment |

### Example cURL Commands

#### 1. Health Check (`GET /api/health`)
```bash
curl -i https://feedbackiq.yourdomain.com/api/health
```

#### 2. Submit Feedback (`POST /api/feedback`)
```bash
curl -i -X POST https://feedbackiq.yourdomain.com/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"message":"The login page crashes on mobile Safari","productName":"Web App","source":"web"}'
```

#### 3. Upload Screenshot (`POST /api/uploads`)
```bash
curl -i -X POST https://feedbackiq.yourdomain.com/api/uploads \
  -F "file=@screenshot.png;type=image/png"
```

---

## 9. Security Architecture & Non-Production Limitations

### Implemented Security Controls
- **Authentication & Roles**: Jose JWT signed with HS256 stored in `HttpOnly; Secure; SameSite=Lax` cookies.
- **Rate Limiting**: Sliding window rate limiter (10 requests/min on submission, 5 attempts/min on login).
- **HTTPS & Security Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Upload Validation**: Content-Type validation, size limit checks, magic bytes binary header verification, and filename path traversal sanitization.
- **S3 Bucket Isolation**: Private bucket (`Block all public access = ON`), IAM Role credential fetching, and authenticated backend proxy streaming.

### Honest Non-Production Limitations
1. **In-Memory Rate Limiter**: Rate limiting uses a single-instance in-memory map; scaling to multi-instance web servers requires Redis.
2. **No Password Reset / Email Verification**: User registration and password recovery workflows are omitted; users are provisioned via seeds or CLI scripts.
3. **Single VM Deployment**: Deployed on one VM via Docker Compose; high availability requires Kubernetes/ECS and managed Postgres.
4. **No Upload Antivirus/Malware Scanning**: Files undergo binary magic bytes inspection but are not passed through ClamAV or a malware scanner.

---

## 10. AI Model Pipeline & Limitations

### Design Architecture
1. **Sentiment**: `cardiffnlp/twitter-roberta-base-sentiment-latest` pre-trained transformer model evaluating sequence probabilities.
2. **Category**: Weighted keyword rule table mapping domain-specific terms (`security`, `bug`, `performance`, `feature_request`, `ui_ux`, `other`).
3. **Priority**: Matrix combining keyword severity triggers, urgency signals, and sentiment outputs.
4. **Summary**: Extractive sentence scoring ranking input sentences by keyword density.

### Limitations
- **English-Language Bias**: Model tokenizers and keyword tables are optimized for English text.
- **Short-Text Bias**: Extractive summarization performs best on multi-sentence paragraphs; single-sentence inputs return the input verbatim.

---

## 11. Empirical AI Evaluation Results

The metrics below were measured directly on the frozen ground-truth test dataset (`evaluation/dataset_test.csv`, **150 samples**) evaluated on CPU:

- **Date of Evaluation**: 2026-10-11 00:04:49
- **Dataset Evaluated**: `evaluation/dataset_test.csv` (Dataset Size: **150** samples)
- **Model Version**: `sent=cardiffnlp/twitter-roberta-base-sentiment-latest;rules=v1;zs=off`
- **CPU Latency**: Median **68.58 ms** | 95th Percentile **102.26 ms**

### Task Metrics Table

| Task | Accuracy | Macro F1 | Weighted F1 | Special Metric |
|---|---|---|---|---|
| **Sentiment** | **0.6000** | **0.4842** | **0.6386** | N/A |
| **Category** | **0.6133** | **0.5179** | **0.6532** | N/A |
| **Priority** | **0.4667** | **0.3211** | **0.4150** | Within 1-Level: **0.7533** |

---

## 12. Troubleshooting Guide

| Problem | Root Cause | Fix |
|---|---|---|
| **1. Containers unhealthy** | Database or AI container starting slowly | Run `docker compose logs -f` and wait for `start-period` (15s). |
| **2. Port 80 / 443 in use** | Another web server (e.g. Nginx or Apache) running on host | Stop host service: `sudo systemctl stop nginx`. |
| **3. Migration failing** | Database not ready or bad connection string | Verify `DATABASE_URL` credentials in `.env`. |
| **4. AI container Out of Memory** | PyTorch RAM spike during RoBERTa model load | Increase VM RAM to 4 GB (`t3.medium`) or set memory limit to `1536M`. |
| **5. S3 AccessDenied** | Missing IAM Role or bad bucket name | Verify EC2 has `FeedbackIQEC2S3Role` attached and IMDS hop limit is `2`. |
| **6. Certificate not issued** | Port 80/443 blocked or invalid domain | Verify Security Group allows 0.0.0.0/0 on ports 80/443 and DNS A record is propagated. |
| **7. DNS not propagated** | Registrar TTL delay | Run `nslookup feedbackiq.yourdomain.com` until Elastic IP is returned. |
| **8. 502 Bad Gateway from Caddy** | Web container crashed or not responding on port 3000 | Check web logs: `docker compose logs web`. |

---

## 13. Project Structure

```
feedbackiq/
├── caddy/
│   └── Caddyfile
├── docker-compose.yml
├── .env.example
├── README.md
├── docs/
│   ├── CLOUD_STORAGE.md
│   ├── DEMO.md
│   ├── DEPLOYMENT.md
│   ├── LIVE_CHECKLIST.md
│   └── images/
├── ai-service/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── main.py
│   ├── analyzer.py
│   ├── rules.py
│   ├── summarizer.py
│   ├── requirements.txt
│   └── evaluation/
│       ├── LABELING_GUIDE.md
│       ├── README.md
│       ├── dataset_dev.csv
│       ├── dataset_test.csv
│       ├── evaluate.py
│       └── results/
│           └── REPORT.md
└── web/
    ├── Dockerfile
    ├── .dockerignore
    ├── next.config.ts
    ├── package.json
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    ├── app/
    │   ├── page.tsx
    │   ├── admin/
    │   └── api/
    │       ├── feedback/
    │       ├── uploads/
    │       ├── attachments/
    │       ├── health/
    │       ├── analytics/
    │       └── auth/
    ├── components/
    ├── lib/
    │   ├── storage.ts
    │   └── uploadValidation.ts
    └── scripts/
        ├── create-admin.ts
        └── live-check.mjs
```
