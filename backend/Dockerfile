# ── Backend Dockerfile ──────────────────────────────────────────────────────
# Python 3.12 slim image for a small production footprint
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed by psycopg2-binary and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer-caching friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source
COPY . .

# Create upload directories that the app expects at runtime
RUN mkdir -p uploads/po_documents uploads/contracts uploads/communication

# Configurable port — default 8000, overridable via PORT env var
ENV PORT=8000

# Expose the configured port
EXPOSE ${PORT}

# Run Alembic migrations then start Uvicorn
# Using shell form so ${PORT} is expanded at runtime
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
