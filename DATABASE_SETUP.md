# Database Setup Instructions

## Option 1: Use existing PostgreSQL database with correct credentials

Update backend/.env file with your actual PostgreSQL credentials:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_db
DB_USER=postgres
DB_PASSWORD=postgres
```

## Option 2: Create new PostgreSQL user and database

1. Connect to PostgreSQL as superuser:
```sql
CREATE USER postgres WITH PASSWORD 'postgres';
CREATE DATABASE task_management_db OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE task_management_db TO postgres;
```

2. Update backend/.env:
```bash
DB_USER=postgres
DB_PASSWORD=postgres
```

3. Run migrations:
```bash
cd backend
node migrations/migrate.js
```

## Current Status: Mock Mode Active

- ✅ Registration works with in-memory storage
- ✅ All features functional
- ❌ Data doesn't persist between server restarts
- ❌ Not suitable for production

When database is properly configured, the server will automatically switch to database mode.
