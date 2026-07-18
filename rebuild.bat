@echo off
REM ===========================================================================
REM  Mentamind - Docker rebuild + migrate + seed helper (Windows)
REM ---------------------------------------------------------------------------
REM  Rebuilds the api + web images so code changes take effect, restarts the
REM  stack, applies pending Alembic migrations, then seeds the meditation
REM  library so it is populated out of the box.
REM
REM  Usage:
REM    rebuild.bat            Rebuild (with cache) + migrate + seed  [default]
REM    rebuild.bat clean      Full rebuild with --no-cache + migrate + seed
REM    rebuild.bat migrate    Only apply DB migrations
REM    rebuild.bat seed       Only seed the meditation library
REM    rebuild.bat logs       Tail api + web logs
REM ===========================================================================

setlocal
cd /d "%~dp0"

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=default"

if /I "%ACTION%"=="logs"    goto logs
if /I "%ACTION%"=="seed"    goto seed
if /I "%ACTION%"=="migrate" goto migrate
if /I "%ACTION%"=="clean"   goto clean
if /I "%ACTION%"=="default" goto default

echo Unknown option "%ACTION%".
echo Usage: rebuild.bat [clean^|migrate^|seed^|logs]
exit /b 1

:default
echo === Building images (with cache) and starting the stack ===
docker compose up -d --build
if errorlevel 1 goto fail
goto migrate

:clean
echo === Full rebuild (no cache) ===
docker compose build --no-cache api web
if errorlevel 1 goto fail
docker compose up -d
if errorlevel 1 goto fail
goto migrate

:migrate
echo === Waiting for the api container to be ready ===
REM Give the api service a moment to boot before running migrations.
timeout /t 5 /nobreak >nul
echo === Applying database migrations (alembic upgrade head) ===
docker compose exec api alembic upgrade head
if errorlevel 1 goto fail
goto seed

:seed
echo === Seeding meditation library ===
docker compose exec api python scripts/seed_meditations.py
if errorlevel 1 goto fail
echo.
echo === Done. Web: http://localhost:3000   API: http://localhost:8000 ===
goto end

:logs
docker compose logs -f api web
goto end

:fail
echo.
echo *** A step failed. Check the output above. ***
exit /b 1

:end
endlocal
