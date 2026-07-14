# Mentamind

AI-powered workplace wellbeing platform.

## Quickstart

```bash
# 1. Clone
git clone https://github.com/your-org/mentamind.git
cd mentamind

# 2. Copy env
cp .env.example .env

# 3. Start all services
docker compose up --build
```

### Service URLs

| Service | URL |
|---------|-----|
| Web (Next.js) | http://localhost:3000 |
| API health | http://localhost:8000/health |
| Web API health | http://localhost:3000/api/health |

## Local Development (without Docker)

### API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Web

```bash
cd apps/web
pnpm install
pnpm dev
```

## Structure

```
mentamind/
├── apps/
│   ├── api/          # FastAPI + SQLAlchemy
│   └── web/          # Next.js 14 App Router
├── packages/
│   └── shared/       # Shared TypeScript types
├── docker-compose.yml
└── turbo.json
```
