FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    MARKET_DATA_PROVIDER=jquants \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev

COPY stock_drawdown_app.py ./
COPY data ./data
COPY static ./static

EXPOSE 8080

CMD ["sh", "-c", "uvicorn stock_drawdown_app:app --host 0.0.0.0 --port ${PORT:-8080}"]
