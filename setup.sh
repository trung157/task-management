#!/bin/bash

# TaskFlow Setup Script
echo "🚀 Setting up TaskFlow - Task Management System"
echo "================================================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Setup environment
echo "🔧 Setting up environment..."
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "📝 Created backend/.env from .env.example"
    echo "⚠️  Please edit backend/.env with your configuration"
else
    echo "✅ backend/.env already exists"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your database credentials"
echo "2. Start PostgreSQL and Redis services"
echo "3. Run database migrations: npm run db:migrate"
echo "4. Start development servers: npm run dev"
echo ""
echo "Or use Docker:"
echo "docker-compose up -d"
echo ""
echo "Access your application:"
echo "- Frontend: http://localhost:5173"
echo "- Backend API: http://localhost:5000"
echo "- API Docs: http://localhost:5000/docs"
