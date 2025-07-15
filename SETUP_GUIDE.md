# 🚀 Hướng Dẫn Chạy Project TaskFlow

## 📋 Mục Lục
1. [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
2. [Phương Pháp 1: Chạy với Docker (Khuyến Nghị)](#phương-pháp-1-chạy-với-docker-khuyến-nghị)
3. [Phương Pháp 2: Chạy Local Development](#phương-pháp-2-chạy-local-development)
4. [Kiểm Tra & Sử Dụng](#kiểm-tra--sử-dụng)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Yêu Cầu Hệ Thống

### Bắt Buộc:
- **Node.js** 18.0.0 trở lên → [Tải về](https://nodejs.org/)
- **Git** → [Tải về](https://git-scm.com/)

### Cho Docker Setup:
- **Docker Desktop** → [Tải về](https://www.docker.com/products/docker-desktop/)

### Cho Local Development:
- **PostgreSQL** 15 trở lên → [Tải về](https://www.postgresql.org/download/)
- **Redis** (tùy chọn) → [Tải về](https://redis.io/docs/install/)

---

## 🐳 Phương Pháp 1: Chạy với Docker (Khuyến Nghị)

### Bước 1: Clone Repository
```bash
git clone https://github.com/trung157/task-management.git
cd task-management
```

### Bước 2: Cấu Hình Environment
```bash
# Windows
copy "backend\.env.example" "backend\.env"

# Linux/macOS
cp backend/.env.example backend/.env
```

### Bước 3: Chỉnh Sửa File .env (Backend)
Mở file `backend/.env` và cập nhật:
```bash
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=taskflow_db
DB_USER=taskflow_user
DB_PASSWORD=your_secure_password

# JWT Configuration  
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here

# Server Configuration
NODE_ENV=development
PORT=5000
```

### Bước 4: Khởi Động Với Docker
```bash
# Khởi động tất cả services
docker-compose up -d

# Kiểm tra trạng thái containers
docker-compose ps

# Xem logs nếu cần
docker-compose logs -f
```

### Bước 5: Chạy Database Migrations
```bash
# Vào backend container và chạy migrations
docker-compose exec backend npm run db:migrate

# Hoặc chạy từ local
cd backend
npm install
npm run db:migrate
```

---

## 💻 Phương Pháp 2: Chạy Local Development

### Bước 1: Clone & Install Dependencies
```bash
git clone https://github.com/trung157/task-management.git
cd task-management

# Install dependencies cho toàn bộ project
npm install
```

### Bước 2: Setup PostgreSQL Database
```bash
# Tạo database
createdb taskflow_db

# Hoặc sử dụng psql
psql -U postgres
CREATE DATABASE taskflow_db;
\q
```

### Bước 3: Cấu Hình Environment Files

**Backend (.env):**
```bash
cd backend
cp .env.example .env
```

Chỉnh sửa `backend/.env`:
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskflow_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_key_minimum_32_characters

# Server
NODE_ENV=development
PORT=5000
HOST=localhost
```

**Frontend (.env):**
```bash
cd ../frontend
cp .env.example .env
```

Chỉnh sửa `frontend/.env`:
```bash
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=TaskFlow
```

### Bước 4: Setup Database Schema
```bash
cd backend

# Chạy migrations
npm run db:migrate

# Nếu có seed data
npm run db:seed
```

### Bước 5: Khởi Động Development Servers
```bash
# Từ thư mục root
npm run dev

# Hoặc chạy riêng từng service:
npm run dev:backend    # Backend sẽ chạy trên port 5000
npm run dev:frontend   # Frontend sẽ chạy trên port 5173
```

---

## ✅ Kiểm Tra & Sử Dụng

### URLs Truy Cập:
- **Frontend**: http://localhost:5173 (development) hoặc http://localhost:8080 (Docker)
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/docs (nếu có Swagger)

### Kiểm Tra Backend API:
```bash
# Health check
curl http://localhost:5000/health

# API endpoints
curl http://localhost:5000/api/v1/tasks
```

### Test Accounts (nếu có seed data):
```
Admin: admin@taskflow.com / admin123
User: user@taskflow.com / user123
```

---

## 🛠️ Các Lệnh Hữu Ích

### Development:
```bash
# Khởi động development
npm run dev

# Build production
npm run build

# Chạy tests
npm run test

# Lint code
npm run lint
```

### Docker:
```bash
# Khởi động
docker-compose up -d

# Dừng
docker-compose down

# Rebuild containers
docker-compose build

# Xem logs
docker-compose logs -f [service_name]

# Vào container
docker-compose exec backend bash
docker-compose exec frontend bash
```

### Database:
```bash
cd backend

# Chạy migrations
npm run db:migrate

# Rollback migrations
npm run db:rollback

# Reset database
npm run db:reset

# Tạo migration mới
npm run db:create-migration <migration_name>
```

---

## 🚨 Troubleshooting

### Lỗi Port Đã Được Sử Dụng:
```bash
# Kiểm tra port đang được sử dụng
netstat -ano | findstr :5000
netstat -ano | findstr :5173

# Kill process trên Windows
taskkill /PID <PID> /F

# Kill process trên Linux/macOS
kill -9 <PID>
```

### Lỗi Database Connection:
1. Kiểm tra PostgreSQL đã khởi động chưa:
   ```bash
   # Windows
   services.msc → tìm PostgreSQL
   
   # Linux/macOS
   sudo systemctl status postgresql
   ```

2. Kiểm tra credentials trong `.env`
3. Kiểm tra firewall/network settings

### Lỗi Docker:
```bash
# Xóa containers và volumes
docker-compose down -v

# Rebuild từ đầu
docker-compose build --no-cache

# Kiểm tra Docker logs
docker-compose logs -f
```

### Lỗi NPM/Dependencies:
```bash
# Xóa node_modules và reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

### Lỗi JWT/Authentication:
1. Đảm bảo JWT_SECRET đủ dài (ít nhất 32 ký tự)
2. Kiểm tra JWT_REFRESH_SECRET
3. Clear browser localStorage/cookies

---

## 📚 Thông Tin Thêm

### Cấu Trúc Project:
```
task-management/
├── 📁 backend/          # Node.js + Express API
│   ├── src/
│   ├── migrations/
│   ├── package.json
│   └── .env
├── 📁 frontend/         # React + TypeScript
│   ├── src/
│   ├── package.json
│   └── .env
├── 🐳 docker-compose.yml
└── 📋 package.json      # Workspace config
```

### Environment Variables Quan Trọng:
- `DB_*`: Database connection settings
- `JWT_SECRET`: JWT token signing key
- `NODE_ENV`: development/production
- `PORT`: Server port
- `CORS_ORIGIN`: Frontend URL for CORS

### Default Ports:
- Backend API: 5000
- Frontend Dev: 5173
- Frontend Prod: 8080 (Docker)
- PostgreSQL: 5432
- Redis: 6379

---

## 🎯 Bước Tiếp Theo

1. **Đăng ký tài khoản** trên frontend
2. **Tạo tasks đầu tiên**
3. **Khám phá các tính năng**:
   - Task management
   - Categories & Tags
   - Search & Filter
   - User profiles

4. **Development**:
   - Đọc API documentation
   - Xem database schema
   - Chạy tests
   - Contribute code

---

## 💡 Tips & Best Practices

- Luôn chạy `npm run test` trước khi commit
- Sử dụng Docker cho consistency
- Backup database trước khi migrate
- Check logs khi có lỗi
- Sử dụng environment-specific configs

---

**Happy Coding! 🚀**
