@echo off
setlocal EnableDelayedExpansion

echo 🚀 TaskFlow Quick Start Setup (Windows)
echo ========================================

:: Check if we're in the correct directory
if not exist package.json (
    echo ❌ Please run this script from the TaskFlow root directory
    pause
    exit /b 1
)

echo 📁 Current directory: %CD%
echo.

:ask_setup_method
echo Choose your setup method:
echo 1^) 🐳 Docker Setup ^(Recommended - Easiest^)
echo 2^) 💻 Local Development Setup
echo 3^) ❌ Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto docker_setup
if "%choice%"=="2" goto local_setup
if "%choice%"=="3" goto exit_script
echo Invalid choice. Please try again.
goto ask_setup_method

:docker_setup
echo.
echo 🐳 Starting Docker Setup...
echo ============================

:: Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Docker is not installed
    echo Please install Docker Desktop from: https://docker.com
    pause
    exit /b 1
)

:: Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Docker is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo ✅ Docker is ready

:: Setup environment file
echo 📝 Setting up environment configuration...
if not exist backend\.env (
    copy backend\.env.example backend\.env >nul
    echo ✅ Created backend\.env from template
    echo 💡 You may want to edit backend\.env for custom settings
) else (
    echo ⚠️ backend\.env already exists
)

:: Start Docker services
echo.
echo 🚀 Starting Docker services...
docker-compose up -d

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ Docker services started successfully!
    echo.
    echo 🌐 Access your application:
    echo    Frontend: http://localhost:8080
    echo    Backend API: http://localhost:5000
    echo.
    echo 📊 Check service status:
    docker-compose ps
    echo.
    echo 📝 Useful commands:
    echo    View logs: docker-compose logs -f
    echo    Stop services: docker-compose down
    echo    Restart: docker-compose restart
) else (
    echo ❌ Failed to start Docker services
    echo Check the error messages above and try again
)

goto end_script

:local_setup
echo.
echo 💻 Starting Local Development Setup...
echo =====================================

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is not installed
    echo Please install Node.js 18+ from: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js !NODE_VERSION! is ready

:: Install dependencies
echo.
echo 📦 Installing dependencies...
npm install

if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed

:: Setup environment files
echo.
echo 📝 Setting up environment files...

:: Backend .env
if not exist backend\.env (
    copy backend\.env.example backend\.env >nul
    echo ✅ Created backend\.env
) else (
    echo ⚠️ backend\.env already exists
)

:: Frontend .env
if not exist frontend\.env (
    copy frontend\.env.example frontend\.env >nul
    echo ✅ Created frontend\.env
) else (
    echo ⚠️ frontend\.env already exists
)

:: Database setup reminder
echo.
echo 📊 Database Setup Required:
echo 1. Install PostgreSQL 15+
echo 2. Create database: 'taskflow_db'
echo 3. Update backend\.env with your database credentials
echo 4. Run migrations: cd backend ^&^& npm run db:migrate
echo.

:: Ask if user wants to start development servers
set /p start_dev="Start development servers now? (y/n): "

if /i "%start_dev%"=="y" (
    echo.
    echo 🚀 Starting development servers...
    echo Press Ctrl+C to stop
    echo.
    npm run dev
) else (
    echo.
    echo ✅ Setup complete!
    echo.
    echo 🚀 To start development:
    echo    npm run dev
    echo.
    echo 🌐 Development URLs:
    echo    Frontend: http://localhost:5173
    echo    Backend: http://localhost:5000
)

goto end_script

:exit_script
echo Goodbye! 👋
exit /b 0

:end_script
echo.
echo Press any key to exit...
pause >nul
