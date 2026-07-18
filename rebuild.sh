#!/usr/bin/env bash
# ============================================================================
#  Mentamind - Docker rebuild + migrate + seed helper
# ----------------------------------------------------------------------------
#  Rebuilds the api + web images, restarts the stack, applies Alembic
#  migrations, then seeds the meditation library so it is populated out of box.
#
#  Usage:
#    ./rebuild.sh            Rebuild (with cache) + migrate + seed  [default]
#    ./rebuild.sh clean      Full rebuild with --no-cache + migrate + seed
#    ./rebuild.sh migrate    Only apply DB migrations
#    ./rebuild.sh seed       Only seed the meditation library
#    ./rebuild.sh logs       Tail api + web logs
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

ACTION="${1:-default}"

seed() {
  echo "=== Seeding meditation library ==="
  docker compose exec api python scripts/seed_meditations.py
  echo
  echo "=== Done. Web: http://localhost:3000   API: http://localhost:8000 ==="
}

migrate() {
  echo "=== Waiting for the api container to be ready ==="
  sleep 5
  echo "=== Applying database migrations (alembic upgrade head) ==="
  docker compose exec api alembic upgrade head
  seed
}

case "$ACTION" in
  default)
    echo "=== Building images (with cache) and starting the stack ==="
    docker compose up -d --build
    migrate
    ;;
  clean)
    echo "=== Full rebuild (no cache) ==="
    docker compose build --no-cache api web
    docker compose up -d
    migrate
    ;;
  migrate)
    migrate
    ;;
  seed)
    seed
    ;;
  logs)
    docker compose logs -f api web
    ;;
  *)
    echo "Unknown option \"$ACTION\"."
    echo "Usage: ./rebuild.sh [clean|migrate|seed|logs]"
    exit 1
    ;;
esac
