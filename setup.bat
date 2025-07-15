@echo off
echo 🚀 Setting up TaskFlow - Task Management System
echo =================================================

:: Check Node.js
echo 🔍 Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download and install the LTS version
    echo 3. Make sure to add Node.js to PATH during installation
    echo 4. Restart your terminal and run this script again
    echo.
    echo Or use Windows Package Manager:
    echo   winget install OpenJS.NodeJS
    echo.
    echo For detailed instructions, see INSTALL.md
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed or not in PATH
    echo npm should come with Node.js installation
    echo Please reinstall Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Show versions
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% detected
echo ✅ npm %NPM_VERSION% detected

:: Install dependencies
echo 📦 Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)
echo ✅ Dependencies installed successfully

:: Setup environment
echo 🔧 Setting up environment...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo 📝 Created backend\.env from .env.example
    echo ⚠️  Please edit backend\.env with your configuration
) else (
    echo ✅ backend\.env already exists
)

:: Build the project
echo 🔨 Building the project...
npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    exit /b 1
)
echo ✅ Build completed successfully

echo.
echo 🎉 Setup completed successfully!
echo.
echo Next steps:
echo 1. Edit backend\.env with your database credentials
echo 2. Start PostgreSQL and Redis services
echo 3. Run database migrations: npm run db:migrate
echo 4. Start development servers: npm run dev
echo.
echo Or use Docker:
echo docker-compose up -d
echo.
echo Access your application:
echo - Frontend: http://localhost:5173
echo - Backend API: http://localhost:3000
echo - API Docs: http://localhost:3000/docs

pause
