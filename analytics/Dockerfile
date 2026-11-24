# Stage 1: Build & Python environment setup
FROM python:3.11-alpine AS base

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8002

# Install system dependencies
RUN apk add --no-cache curl libc6-compat

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install Python requirements
COPY analytics/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy analytics source code
COPY analytics ./analytics

USER appuser

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8002/health/live || exit 1

CMD ["uvicorn", "analytics.main:app", "--host", "0.0.0.0", "--port", "8002"]
