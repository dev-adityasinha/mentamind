FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir .

EXPOSE 8000

# Shell form so `&&` and `${PORT}` are interpreted by /bin/sh. On Render the
# platform injects $PORT; fall back to 8000 for local `docker run`.
#
# The curriculum seed runs on every boot because the free plan has no shell to
# run it from by hand. It is an idempotent upsert keyed on block/day, so
# repeated runs only refresh the static content.
CMD alembic upgrade head && python scripts/seed_curriculum.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
