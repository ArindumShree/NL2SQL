FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install backend deps first (includes google-genai, mcp, fastapi, asyncpg, sqlparse)
COPY backend/requirements.txt /tmp/backend_req.txt
RUN pip install --no-cache-dir -r /tmp/backend_req.txt

# MCP server deps are a subset of backend deps — no separate install needed.
# Copy the MCP server script so the backend can spawn it as a subprocess.
COPY mcp_server/server.py /mcp_server/server.py

# Copy backend entrypoint
COPY backend/main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]