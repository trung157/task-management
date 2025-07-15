@echo off
echo 🔍 TaskFlow System Requirements Check
echo ====================================

set REQUIREMENTS_MET=1

echo.
echo Checking system requirements...
echo.

:: Check Node.js
echo [1/4] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo    Required: Node.js 18.0.0 or higher
    echo    Download: https://nodejs.org/
    set REQUIREMENTS_MET=0
) else (
    for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODE_VERSION=%%i
    if defined NODE_VERSION (
        echo ✅ Node.js %NODE_VERSION% found
    ) else (
        echo ❌ Node.js installation appears corrupted
        set REQUIREMENTS_MET=0
    )
)

:: Check npm
echo [2/4] Checking npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    echo    npm should come with Node.js
    set REQUIREMENTS_MET=0
) else (
    for /f "tokens=*" %%i in ('npm -v 2^>nul') do set NPM_VERSION=%%i
    if defined NPM_VERSION (
        echo ✅ npm %NPM_VERSION% found
    ) else (
        echo ❌ npm installation appears corrupted
        set REQUIREMENTS_MET=0
    )
)

:: Check Git
echo [3/4] Checking Git...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Git is not installed (optional but recommended)
    echo    Download: https://git-scm.com/download/windows
) else (
    for /f "tokens=*" %%i in ('git --version 2^>nul') do set GIT_VERSION=%%i
    if defined GIT_VERSION (
        echo ✅ %GIT_VERSION% found
    )
)

:: Check Docker
echo [4/4] Checking Docker...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Docker is not installed (optional but recommended)
    echo    Download: https://www.docker.com/products/docker-desktop/
) else (
    for /f "tokens=*" %%i in ('docker --version 2^>nul') do set DOCKER_VERSION=%%i
    if defined DOCKER_VERSION (
        echo ✅ %DOCKER_VERSION% found
        
        :: Check if Docker is running
        docker info >nul 2>nul
        if %errorlevel% neq 0 (
            echo ⚠️  Docker is installed but not running
            echo    Please start Docker Desktop
        ) else (
            echo ✅ Docker is running
        )
    )
)

echo.
echo ====================================

if %REQUIREMENTS_MET%==1 (
    echo ✅ All required dependencies are installed!
    echo.
    echo You can now run:
    echo   setup.bat          # Setup the project
    echo   npm install        # Install dependencies
    echo   docker-compose up  # Start with Docker
    echo.
) else (
    echo ❌ Some required dependencies are missing.
    echo.
    echo Please install the missing requirements:
    echo.
    echo Required:
    echo - Node.js 18+: https://nodejs.org/
    echo.
    echo Optional but recommended:
    echo - Git: https://git-scm.com/download/windows
    echo - Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo.
    echo For detailed installation guide, see INSTALL.md
    echo.
)

pause
