@echo off
echo =======================================
echo PostgreSQL Local Installation Guide
echo =======================================
echo.

echo This script will guide you through PostgreSQL installation.
echo.

echo Step 1: Download PostgreSQL
echo Go to: https://www.postgresql.org/download/windows/
echo Download PostgreSQL 15 or higher for Windows
echo.

echo Step 2: During installation:
echo - Remember your postgres superuser password
echo - Keep default port 5432
echo - Install pgAdmin 4 (recommended)
echo.

echo Step 3: After installation, create TaskFlow database:
echo.
echo   1. Open pgAdmin or use command line:
echo      psql -U postgres
echo.
echo   2. Create database and user:
echo      CREATE DATABASE task_management_db;
echo      CREATE USER taskflow_user WITH PASSWORD 'your_password';
echo      GRANT ALL PRIVILEGES ON DATABASE task_management_db TO taskflow_user;
echo.

echo Step 4: Update your .env file with:
echo   DB_HOST=localhost
echo   DB_PORT=5432
echo   DB_NAME=task_management_db
echo   DB_USER=taskflow_user
echo   DB_PASSWORD=your_password
echo.

echo Step 5: Run database migrations:
echo   cd backend
echo   npm run db:migrate
echo.

pause
