# ⚡ TaskFlow - Quick Setup (TL;DR)

## 🎯 Mục Tiêu
Chạy TaskFlow task management system trong < 5 phút

## 🔥 Super Quick Start

### 🐳 Docker (Easiest - Recommended)
```bash
# 1. Clone
git clone https://github.com/trung157/task-management.git
cd task-management

# 2. Environment
cp backend/.env.example backend/.env

# 3. Start
docker-compose up -d

# 4. Access
# Frontend: http://localhost:8080
# Backend: http://localhost:5000
```

### 💻 Local Development
```bash
# 1. Clone
git clone https://github.com/trung157/task-management.git
cd task-management

# 2. Install
npm install

# 3. Environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Database (PostgreSQL required)
createdb taskflow_db
cd backend && npm run db:migrate

# 5. Start
npm run dev

# 6. Access
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
```

## 📋 Requirements
- Node.js 18+
- Git
- Docker (for Docker setup) OR PostgreSQL 15+ (for local)

## 🔧 Quick Commands

### Check Requirements
```bash
# Windows
check-requirements.bat

# Linux/macOS
./check-requirements.sh
```

### Automated Setup
```bash
# Windows
quick-start.bat

# Linux/macOS
./quick-start.sh
```

### Docker
```bash
docker-compose up -d      # Start
docker-compose ps         # Status
docker-compose logs -f    # Logs
docker-compose down       # Stop
```

### Development
```bash
npm run dev              # Start both frontend & backend
npm run dev:backend      # Backend only (port 5000)
npm run dev:frontend     # Frontend only (port 5173)
npm test                 # Run tests
npm run build            # Build production
```

### Database
```bash
cd backend
npm run db:migrate       # Run migrations
npm run db:rollback      # Rollback
npm run db:reset         # Reset database
```

## 🌐 Access Points
| Service | Local Dev | Docker | Description |
|---------|-----------|--------|-------------|
| Frontend | http://localhost:5173 | http://localhost:8080 | React UI |
| Backend API | http://localhost:5000 | http://localhost:5000 | REST API |
| Health Check | http://localhost:5000/health | http://localhost:5000/health | API Status |

## ⚡ Troubleshooting

### Port Conflicts
```bash
# Check ports
netstat -ano | findstr :5000    # Windows
lsof -i :5000                   # Linux/macOS

# Kill process
taskkill /PID <PID> /F          # Windows
kill -9 <PID>                   # Linux/macOS
```

### Docker Issues
```bash
docker-compose down -v          # Stop & remove volumes
docker-compose build --no-cache # Rebuild
docker system prune             # Clean up
```

### Database Issues
```bash
# Check PostgreSQL
services.msc                    # Windows
systemctl status postgresql     # Linux
brew services list | grep postgres # macOS

# Recreate database
dropdb taskflow_db
createdb taskflow_db
npm run db:migrate
```

### NPM Issues
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## 🎯 Validation

### Quick Test
```bash
# API Health
curl http://localhost:5000/health

# Frontend access
# Open browser: http://localhost:5173 (local) or http://localhost:8080 (Docker)
```

### Full Test
```bash
npm test                        # Run test suite
```

## 📁 Key Files
```
task-management/
├── SETUP_GUIDE.md             # 📖 Detailed instructions
├── SETUP_CHECKLIST.md         # ✅ Step-by-step checklist
├── quick-start.sh/.bat        # 🚀 Automated setup
├── check-requirements.sh/.bat # 🔍 System check
├── docker-compose.yml         # 🐳 Docker configuration
├── backend/.env.example       # ⚙️ Backend environment template
└── frontend/.env.example      # ⚙️ Frontend environment template
```

## 🆘 Need Help?

1. **Detailed Guide**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. **Checklist**: [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)
3. **Backend Docs**: [backend/README.md](./backend/README.md)

---

**🚀 Happy Coding!**
