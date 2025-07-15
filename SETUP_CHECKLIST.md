# 📝 TaskFlow Setup Checklist

Sử dụng checklist này để đảm bảo bạn đã hoàn thành tất cả các bước cần thiết.

## ✅ Trước Khi Bắt Đầu

### Yêu Cầu Hệ Thống
- [ ] **Node.js 18+** đã được cài đặt
- [ ] **Git** đã được cài đặt
- [ ] **Docker Desktop** đã được cài đặt (nếu dùng Docker)
- [ ] **PostgreSQL 15+** đã được cài đặt (nếu chạy local)

### Kiểm Tra Công Cụ
```bash
# Chạy script kiểm tra
./check-requirements.sh   # Linux/macOS
check-requirements.bat    # Windows
```

## 🚀 Lựa Chọn Phương Pháp Setup

### [ ] Option A: Docker Setup (Khuyến Nghị)
- [ ] Clone repository
- [ ] Copy `.env.example` thành `.env`
- [ ] Chỉnh sửa `backend/.env`
- [ ] Chạy `docker-compose up -d`
- [ ] Kiểm tra containers: `docker-compose ps`

### [ ] Option B: Local Development
- [ ] Clone repository
- [ ] Cài đặt dependencies: `npm install`
- [ ] Setup PostgreSQL database
- [ ] Copy và config `.env` files
- [ ] Chạy migrations: `cd backend && npm run db:migrate`
- [ ] Start dev servers: `npm run dev`

## 📊 Kiểm Tra Sau Setup

### URLs Hoạt Động
- [ ] Frontend: http://localhost:5173 (local) hoặc http://localhost:8080 (Docker)
- [ ] Backend API: http://localhost:5000
- [ ] Health check: http://localhost:5000/health

### Database
- [ ] Database `taskflow_db` đã được tạo
- [ ] Tables đã được tạo thông qua migrations
- [ ] Connection thành công (check logs)

### Authentication
- [ ] JWT_SECRET đã được set trong `.env`
- [ ] JWT_REFRESH_SECRET đã được set
- [ ] Có thể đăng ký tài khoản mới
- [ ] Có thể login thành công

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```
- [ ] Auth middleware tests pass
- [ ] Basic unit tests pass
- [ ] Repository tests pass

### API Testing
```bash
# Health check
curl http://localhost:5000/health

# API endpoints (cần auth token)
curl http://localhost:5000/api/v1/tasks
```

## 🛠️ Troubleshooting Checklist

### Port Conflicts
- [ ] Port 5000 (backend) không bị sử dụng
- [ ] Port 5173/8080 (frontend) không bị sử dụng
- [ ] Port 5432 (PostgreSQL) không bị conflict

### Environment Variables
- [ ] `backend/.env` tồn tại và có đúng format
- [ ] `frontend/.env` tồn tại (nếu cần)
- [ ] Database credentials đúng
- [ ] JWT secrets đủ dài (32+ characters)

### Docker Issues
- [ ] Docker Desktop đang chạy
- [ ] Có quyền truy cập Docker
- [ ] Ports không bị conflict
- [ ] Images build thành công

### Database Issues
- [ ] PostgreSQL service đang chạy
- [ ] Database `taskflow_db` đã được tạo
- [ ] User có quyền truy cập database
- [ ] Connection string đúng format

## 📚 Tài Nguyên Hỗ Trợ

### Documentation
- [ ] Đã đọc [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- [ ] Đã đọc [backend/README.md](./backend/README.md)
- [ ] Đã check [frontend/README.md](./frontend/README.md)

### Helpful Commands
```bash
# Kiểm tra logs
docker-compose logs -f        # Docker
npm run dev                   # Local

# Database
npm run db:migrate           # Run migrations
npm run db:rollback         # Rollback migrations
npm run db:reset            # Reset database

# Development
npm run build               # Build production
npm run test                # Run tests
npm run lint                # Code linting
```

## 🎯 Validation Tests

### Functional Tests
- [ ] Có thể tạo tài khoản mới
- [ ] Có thể login với tài khoản đã tạo
- [ ] Có thể tạo task mới
- [ ] Có thể xem danh sách tasks
- [ ] Có thể cập nhật task
- [ ] Có thể xóa task

### Performance Tests
- [ ] Frontend load < 3 seconds
- [ ] API response < 1 second
- [ ] Database queries optimized

### Security Tests
- [ ] Không thể truy cập API without auth
- [ ] JWT tokens expire properly
- [ ] Password được hash
- [ ] CORS configured correctly

## ✅ Setup Complete!

Khi tất cả checkboxes đã được tick:

🎉 **Chúc mừng! TaskFlow đã sẵn sàng sử dụng**

### Next Steps:
1. 👤 Tạo tài khoản admin/user đầu tiên
2. 📝 Tạo tasks và categories
3. 🔍 Khám phá các tính năng
4. 🚀 Bắt đầu development

### Support:
- 📖 Documentation: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- 🐛 Issues: GitHub Issues
- 💬 Community: Project discussions

---

**Happy TaskFlow-ing! 🚀**
