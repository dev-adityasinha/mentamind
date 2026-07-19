FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir .

EXPOSE 8000

# Shell form so `&&` and `${PORT}` are interpreted by /bin/sh. On Render the
# platform injects $PORT; fall back to 8000 for local `docker run`.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
