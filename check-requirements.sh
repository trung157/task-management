#!/bin/bash

echo "🔍 TaskFlow System Requirements Check"
echo "===================================="

REQUIREMENTS_MET=1

echo ""
echo "Checking system requirements..."
echo ""

# Check Node.js
echo "[1/4] Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js $NODE_VERSION found"
    
    # Check version
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "⚠️  Node.js version 18+ is recommended (current: $NODE_VERSION)"
    fi
else
    echo "❌ Node.js is not installed"
    echo "   Required: Node.js 18.0.0 or higher"
    echo "   Download: https://nodejs.org/"
    REQUIREMENTS_MET=0
fi

# Check npm
echo "[2/4] Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm $NPM_VERSION found"
else
    echo "❌ npm is not installed"
    echo "   npm should come with Node.js"
    REQUIREMENTS_MET=0
fi

# Check Git
echo "[3/4] Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "✅ $GIT_VERSION found"
else
    echo "⚠️  Git is not installed (optional but recommended)"
    echo "   Install: sudo apt install git (Ubuntu) or brew install git (macOS)"
fi

# Check Docker
echo "[4/4] Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✅ $DOCKER_VERSION found"
    
    # Check if Docker is running
    if docker info &> /dev/null; then
        echo "✅ Docker is running"
    else
        echo "⚠️  Docker is installed but not running"
        echo "   Please start Docker service"
    fi
else
    echo "⚠️  Docker is not installed (optional but recommended)"
    echo "   Download: https://www.docker.com/products/docker-desktop/"
fi

echo ""
echo "===================================="

if [ $REQUIREMENTS_MET -eq 1 ]; then
    echo "✅ All required dependencies are installed!"
    echo ""
    echo "You can now run:"
    echo "  ./setup.sh         # Setup the project"
    echo "  npm install        # Install dependencies" 
    echo "  docker-compose up  # Start with Docker"
    echo ""
else
    echo "❌ Some required dependencies are missing."
    echo ""
    echo "Please install the missing requirements:"
    echo ""
    echo "Required:"
    echo "- Node.js 18+: https://nodejs.org/"
    echo ""
    echo "Optional but recommended:"
    echo "- Git: https://git-scm.com/"
    echo "- Docker: https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "For detailed installation guide, see INSTALL.md"
    echo ""
fi
