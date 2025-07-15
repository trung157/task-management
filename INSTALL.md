# 🚀 TaskFlow - Installation Guide

## Prerequisites Installation

### 1. Install Node.js (Required)

**Option A: Download from Official Website (Recommended)**
1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download the LTS version (Long Term Support)
3. Run the installer and follow the installation wizard
4. Make sure to check "Add to PATH" during installation

**Option B: Using Windows Package Manager (winget)**
```powershell
winget install OpenJS.NodeJS
```

**Option C: Using Chocolatey**
```powershell
choco install nodejs
```

**Option D: Using Scoop**
```powershell
scoop install nodejs
```

### 2. Verify Installation

After installation, restart your terminal and run:
```powershell
node -v
npm -v
```

You should see version numbers like:
```
v18.17.0
9.6.7
```

### 3. Install Docker (Optional but Recommended)

**Option A: Docker Desktop**
1. Download from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Install and restart your computer
3. Start Docker Desktop

**Option B: Using winget**
```powershell
winget install Docker.DockerDesktop
```

### 4. Install PostgreSQL (If not using Docker)

**Option A: Official Installer**
1. Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Install with default settings
3. Remember the password you set for the 'postgres' user

**Option B: Using winget**
```powershell
winget install PostgreSQL.PostgreSQL
```

### 5. Install Redis (If not using Docker)

**Option A: Using WSL2**
```powershell
# Install WSL2 first if not already installed
wsl --install
# Then install Redis in WSL2
wsl
sudo apt update
sudo apt install redis-server
```

**Option B: Windows Port**
Download from [https://github.com/tporadowski/redis/releases](https://github.com/tporadowski/redis/releases)

## Quick Setup Commands

Once Node.js is installed, run these commands in PowerShell:

```powershell
# Navigate to project directory
cd "D:\Dev\task-management"

# Install dependencies
npm install

# Copy environment file
copy "backend\.env.example" "backend\.env"

# Edit the .env file with your database credentials
notepad "backend\.env"

# Run with Docker (easiest)
docker-compose up -d

# OR run manually (requires PostgreSQL and Redis)
npm run dev
```

## Troubleshooting

### Node.js PATH Issues
If Node.js is installed but not recognized:

1. **Check Installation Path:**
   ```powershell
   Get-ChildItem "C:\Program Files\nodejs\" -ErrorAction SilentlyContinue
   Get-ChildItem "C:\Program Files (x86)\nodejs\" -ErrorAction SilentlyContinue
   ```

2. **Add to PATH manually:**
   - Open System Properties → Environment Variables
   - Add `C:\Program Files\nodejs\` to PATH
   - Restart terminal

3. **Refresh Environment Variables:**
   ```powershell
   refreshenv
   ```

### PowerShell Execution Policy
If you get execution policy errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### WSL2 for Linux Tools
Some tools work better in WSL2:
```powershell
wsl --install
wsl --set-default-version 2
```

## Next Steps

After successful installation:

1. **Configure Environment:**
   - Edit `backend/.env` with your database credentials
   - Set up PostgreSQL database
   - Configure Redis (if not using Docker)

2. **Start Development:**
   ```powershell
   # Using Docker (recommended)
   docker-compose up -d
   
   # Or manual start
   npm run dev
   ```

3. **Access Application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000/docs

## Support

If you encounter issues:
1. Check the [GitHub Issues](https://github.com/trung157/task-management/issues)
2. Ensure all prerequisites are properly installed
3. Verify environment variables are configured correctly
4. Check that PostgreSQL and Redis services are running
