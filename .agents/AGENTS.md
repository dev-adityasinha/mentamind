
# Docker Workflow
- Since the project relies on Docker without host volume mounts for the codebase, **ALWAYS rebuild** the containers (docker compose up -d --build <service>) after making any code modifications. Do not just restart the containers.

## Rebuild after every code change (required)
Because the images bake the code in at build time (no host volume mounts), a
plain `docker compose restart` runs the OLD code. Any change under `apps/api/`
or `apps/web/` only takes effect locally after the affected image is rebuilt.

- **API code change** (`apps/api/**`): `docker compose up -d --build api`
- **Web code change** (`apps/web/**`): `docker compose up -d --build web`
- **Both / unsure**: `docker compose up -d --build`

### Easiest: use the repo helper (does rebuild + migrate + seed)
- Windows: `rebuild.bat`
- macOS/Linux: `./rebuild.sh`
- Full no-cache rebuild: `rebuild.bat clean` / `./rebuild.sh clean`

### When a migration or seed is also needed
- **New/edited Alembic migration** (`apps/api/alembic/versions/**`): after the
  rebuild, run `docker compose exec api alembic upgrade head` (the helper
  scripts already do this). A change to a SQLAlchemy **model's inline
  constraint that only mirrors an already-applied migration** needs the image
  rebuild but NO new migration and NO DDL change.
- **Meditation library seed**: `docker compose exec api python scripts/seed_meditations.py`
  (idempotent; the helper scripts run it automatically).

### Not part of any image (no rebuild needed)
Root-level manual QA/smoke scripts (`qa_test_*.py`, `test_req.py`,
`test_frontend.py`) are run by hand and are not copied into the api/web
images, so editing them requires no rebuild -- they pick up changes on the
next run.

### Note for cloud/remote assistants
An assistant running outside this machine (e.g. a cloud sandbox) cannot
execute Docker here -- it can only edit files. After it changes code, it must
state which service changed and hand over the exact rebuild command for a
human to run locally.
