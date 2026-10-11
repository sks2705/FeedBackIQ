FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --create-home appuser

COPY requirements.txt .

# Install CPU-only PyTorch wheel and production dependencies
RUN pip install --default-timeout=1000 --retries 10 --no-cache-dir torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu && \
    pip install --default-timeout=1000 --retries 10 --no-cache-dir -r requirements.txt

COPY . .

# Set explicit cache location for non-root user
ENV HF_HOME=/home/appuser/.cache/huggingface \
    TORCH_HOME=/home/appuser/.cache/torch

# Create cache directory with correct permissions and download Hugging Face transformer model
RUN mkdir -p /home/appuser/.cache && \
    python -c "from transformers import pipeline; pipeline('text-classification', model='cardiffnlp/twitter-roberta-base-sentiment-latest', tokenizer='cardiffnlp/twitter-roberta-base-sentiment-latest', device=-1)" && \
    chown -R appuser:appgroup /app /home/appuser/.cache

ENV HF_HUB_OFFLINE=1

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:8000/health | grep -q '"models_loaded":true' || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
