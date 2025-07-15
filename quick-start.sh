#!/bin/bash

# TaskFlow Quick Start Script
echo "🚀 TaskFlow Quick Start Setup"
echo "============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the TaskFlow root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📁 Current directory: $(pwd)${NC}"
echo ""

# Function to ask user choice
ask_setup_method() {
    echo "Choose your setup method:"
    echo "1) 🐳 Docker Setup (Recommended - Easiest)"
    echo "2) 💻 Local Development Setup"
    echo "3) ❌ Exit"
    echo ""
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1) docker_setup ;;
        2) local_setup ;;
        3) echo "Goodbye! 👋"; exit 0 ;;
        *) echo "Invalid choice. Please try again."; ask_setup_method ;;
    esac
}

docker_setup() {
    echo ""
    echo -e "${BLUE}🐳 Starting Docker Setup...${NC}"
    echo "================================"
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo "Please install Docker Desktop from: https://docker.com"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running${NC}"
        echo "Please start Docker Desktop and try again"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker is ready${NC}"
    
    # Setup environment file
    echo "📝 Setting up environment configuration..."
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✅ Created backend/.env from template${NC}"
        echo -e "${YELLOW}💡 You may want to edit backend/.env for custom settings${NC}"
    else
        echo -e "${YELLOW}⚠️ backend/.env already exists${NC}"
    fi
    
    # Start Docker services
    echo ""
    echo "🚀 Starting Docker services..."
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Docker services started successfully!${NC}"
        echo ""
        echo "🌐 Access your application:"
        echo -e "   Frontend: ${BLUE}http://localhost:8080${NC}"
        echo -e "   Backend API: ${BLUE}http://localhost:5000${NC}"
        echo ""
        echo "📊 Check service status:"
        docker-compose ps
        
        echo ""
        echo "📝 Useful commands:"
        echo "   View logs: docker-compose logs -f"
        echo "   Stop services: docker-compose down"
        echo "   Restart: docker-compose restart"
    else
        echo -e "${RED}❌ Failed to start Docker services${NC}"
        echo "Check the error messages above and try again"
    fi
}

local_setup() {
    echo ""
    echo -e "${BLUE}💻 Starting Local Development Setup...${NC}"
    echo "====================================="
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        echo "Please install Node.js 18+ from: https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js version is too old (found: $(node -v), required: 18+)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $(node -v) is ready${NC}"
    
    # Install dependencies
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    
    # Setup environment files
    echo ""
    echo "📝 Setting up environment files..."
    
    # Backend .env
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✅ Created backend/.env${NC}"
    else
        echo -e "${YELLOW}⚠️ backend/.env already exists${NC}"
    fi
    
    # Frontend .env
    if [ ! -f "frontend/.env" ]; then
        cp frontend/.env.example frontend/.env
        echo -e "${GREEN}✅ Created frontend/.env${NC}"
    else
        echo -e "${YELLOW}⚠️ frontend/.env already exists${NC}"
    fi
    
    # Database setup reminder
    echo ""
    echo -e "${YELLOW}📊 Database Setup Required:${NC}"
    echo "1. Install PostgreSQL 15+"
    echo "2. Create database: 'taskflow_db'"
    echo "3. Update backend/.env with your database credentials"
    echo "4. Run migrations: cd backend && npm run db:migrate"
    echo ""
    
    # Ask if user wants to start development servers
    echo "Start development servers now? (y/n)"
    read -p "Choice: " start_dev
    
    if [ "$start_dev" = "y" ] || [ "$start_dev" = "Y" ]; then
        echo ""
        echo "🚀 Starting development servers..."
        echo "Press Ctrl+C to stop"
        echo ""
        npm run dev
    else
        echo ""
        echo -e "${GREEN}✅ Setup complete!${NC}"
        echo ""
        echo "🚀 To start development:"
        echo "   npm run dev"
        echo ""
        echo "🌐 Development URLs:"
        echo -e "   Frontend: ${BLUE}http://localhost:5173${NC}"
        echo -e "   Backend: ${BLUE}http://localhost:5000${NC}"
    fi
}

# Main execution
echo "Welcome to TaskFlow! 🎯"
echo ""
ask_setup_method
