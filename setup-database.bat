@echo off
echo =======================================
echo TaskFlow Database Setup Script
echo =======================================
echo.

echo Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not running.
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✅ Docker is available
echo.

echo Starting PostgreSQL container...
docker compose up postgres -d

echo.
echo Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Checking PostgreSQL connection...
docker compose exec postgres pg_isready -U taskflow_user -d taskflow_db

if %errorlevel% eq 0 (
    echo ✅ PostgreSQL is running successfully!
    echo.
    echo Database Information:
    echo - Host: localhost
    echo - Port: 5432
    echo - Database: taskflow_db
    echo - User: taskflow_user
    echo - Password: taskflow_password
    echo.
    echo You can now run: npm run db:migrate
) else (
    echo ❌ PostgreSQL failed to start properly
    echo Please check Docker logs: docker compose logs postgres
)

echo.
pause
