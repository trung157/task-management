#!/bin/bash

# TaskFlow Environment Setup Script
echo "🔧 Setting up TaskFlow Environment Files"
echo "========================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to copy env file if it doesn't exist
setup_env_file() {
    local example_file=$1
    local target_file=$2
    local description=$3
    
    if [ -f "$target_file" ]; then
        echo -e "${YELLOW}⚠️ $target_file already exists, skipping...${NC}"
    else
        if [ -f "$example_file" ]; then
            cp "$example_file" "$target_file"
            echo -e "${GREEN}✅ Created $target_file from $example_file${NC}"
        else
            echo -e "${RED}❌ Template file $example_file not found${NC}"
            return 1
        fi
    fi
}

echo ""
echo "📁 Setting up environment files..."

# Root .env for Docker
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# TaskFlow Docker Environment Configuration
DB_DATABASE=taskflow_db
DB_USER=taskflow_user
DB_PASSWORD=taskflow_secure_password_2024
DB_PORT=5432
BACKEND_PORT=5000
FRONTEND_PORT=8080
REDIS_PORT=6379
JWT_SECRET=taskflow_jwt_secret_for_docker_32chars_minimum_secure_key
JWT_REFRESH_SECRET=taskflow_refresh_secret_for_docker_32chars_minimum_secure_key
EOF
    echo -e "${GREEN}✅ Created root .env for Docker${NC}"
else
    echo -e "${YELLOW}⚠️ Root .env already exists${NC}"
fi

# Backend .env
setup_env_file "backend/.env.example" "backend/.env" "Backend environment"

# Frontend .env
setup_env_file "frontend/.env.example" "frontend/.env" "Frontend environment"

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. 📝 Edit backend/.env and update DB_PASSWORD with your PostgreSQL password"
echo "2. 🚀 For Docker: docker-compose up -d"
echo "3. 💻 For Local: npm run dev"
echo ""
echo -e "${GREEN}🎉 Environment setup complete!${NC}"
