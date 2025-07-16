@echo off
echo 🔧 Setting up TaskFlow Environment Files
echo ========================================

echo.
echo 📁 Setting up environment files...

:: Root .env for Docker
if not exist .env (
    echo # TaskFlow Docker Environment Configuration > .env
    echo DB_DATABASE=taskflow_db >> .env
    echo DB_USER=taskflow_user >> .env
    echo DB_PASSWORD=taskflow_secure_password_2024 >> .env
    echo DB_PORT=5432 >> .env
    echo BACKEND_PORT=5000 >> .env
    echo FRONTEND_PORT=8080 >> .env
    echo REDIS_PORT=6379 >> .env
    echo JWT_SECRET=taskflow_jwt_secret_for_docker_32chars_minimum_secure_key >> .env
    echo JWT_REFRESH_SECRET=taskflow_refresh_secret_for_docker_32chars_minimum_secure_key >> .env
    echo ✅ Created root .env for Docker
) else (
    echo ⚠️ Root .env already exists
)

:: Backend .env
if not exist backend\.env (
    if exist backend\.env.example (
        copy backend\.env.example backend\.env >nul
        echo ✅ Created backend\.env from template
    ) else (
        echo ❌ Backend template file not found
    )
) else (
    echo ⚠️ backend\.env already exists
)

:: Frontend .env
if not exist frontend\.env (
    if exist frontend\.env.example (
        copy frontend\.env.example frontend\.env >nul
        echo ✅ Created frontend\.env from template
    ) else (
        echo ❌ Frontend template file not found
    )
) else (
    echo ⚠️ frontend\.env already exists
)

echo.
echo 🎯 Next Steps:
echo ==============
echo 1. 📝 Edit backend\.env and update DB_PASSWORD with your PostgreSQL password
echo 2. 🚀 For Docker: docker-compose up -d
echo 3. 💻 For Local: npm run dev
echo.
echo 🎉 Environment setup complete!
echo.
pause
