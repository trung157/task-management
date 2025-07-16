@echo off
echo =======================================
echo TaskFlow Database Setup
echo =======================================
echo.

set PGPATH="C:\Program Files\PostgreSQL\17\bin"
set PSQL=%PGPATH%\psql.exe

echo Checking PostgreSQL installation...
if not exist %PSQL% (
    echo ❌ PostgreSQL not found at expected location.
    echo Please verify PostgreSQL is installed or update the path in this script.
    pause
    exit /b 1
)

echo ✅ PostgreSQL found at %PGPATH%
echo.

echo Creating TaskFlow database...
echo Please enter your PostgreSQL 'postgres' user password when prompted.
echo.

REM Create database
%PSQL% -U postgres -c "CREATE DATABASE task_management_db;"
if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to create database. Please check:
    echo    1. PostgreSQL service is running
    echo    2. Password is correct
    echo    3. You have sufficient privileges
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Database 'task_management_db' created successfully!
echo.

echo Creating database user...
%PSQL% -U postgres -d task_management_db -c "CREATE USER taskflow_user WITH PASSWORD 'taskflow_password';"
%PSQL% -U postgres -d task_management_db -c "GRANT ALL PRIVILEGES ON DATABASE task_management_db TO taskflow_user;"
%PSQL% -U postgres -d task_management_db -c "GRANT ALL PRIVILEGES ON SCHEMA public TO taskflow_user;"

if %errorlevel% eq 0 (
    echo ✅ User 'taskflow_user' created and configured!
    echo.
    echo Database setup complete:
    echo - Database: task_management_db
    echo - User: taskflow_user
    echo - Password: taskflow_password
    echo - Host: localhost
    echo - Port: 5432
    echo.
    echo Next steps:
    echo 1. cd backend
    echo 2. npm run db:migrate
    echo 3. npm run dev
) else (
    echo ❌ Failed to create user or grant privileges
)

echo.
pause
