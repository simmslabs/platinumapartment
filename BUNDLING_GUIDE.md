# 🏠 Apartment Management System - Bundling Options Summary

This document provides an overview of all available scripts to bundle the Apartment Management System for deployment on different Windows machines.

## 📦 Available Bundle Scripts

### 1. `bundle-simple.ps1` ✅ **WORKING**
**Best for: Quick Windows deployment**

```powershell
.\bundle-simple.ps1
```

**What it creates:**
- `apartment-bundle/` folder with all necessary files
- `apartment-windows-bundle.zip` archive ready for transfer
- Simple deployment and start scripts
- Environment template with all required variables

**Output includes:**
- Built application (`build/` folder)
- Database schema (`prisma/` folder)  
- Static assets (`public/` folder)
- Dependency files (`package.json`, `bun.lockb`)
- `.env.template` for configuration
- `deploy.ps1` for easy deployment
- `start.ps1` for starting the server
- `README.md` with instructions

### 2. `bundle-win.ps1` ⚠️ **HAS UNICODE ISSUES**
More comprehensive but has character encoding problems.

### 3. `bundle-windows.ps1` ❌ **COMPLEX SYNTAX ISSUES**
Most comprehensive but PowerShell parsing problems.

### 4. `bundle-node.ps1` ❌ **SYNTAX ERRORS**
Node.js alternative but has PowerShell syntax issues.

### 5. Docker Deployment 🐳
**Best for: Production environments**

Files available:
- `Dockerfile` - Container definition
- `docker-compose.yml` - Complete stack
- `.env.docker` - Docker environment template

```bash
# Build and run with Docker
docker-compose up -d
```

## 🚀 Recommended Deployment Process

### For Windows Machines (Recommended)

1. **Create Bundle:**
   ```powershell
   .\bundle-simple.ps1
   ```

2. **Transfer to Target Machine:**
   - Copy `apartment-windows-bundle.zip` to the target Windows machine
   - Extract the ZIP file to desired location

3. **Configure Environment:**
   ```powershell
   copy .env.template .env
   notepad .env
   ```
   Update these critical values:
   - `JWT_SECRET` - 32+ character random string
   - `SESSION_SECRET` - 32+ character random string  
   - `RESEND_API_KEY` - Get from https://resend.com
   - `APP_URL` - Your domain or http://localhost:3000

4. **Deploy:**
   ```powershell
   .\deploy.ps1
   ```

5. **Start Application:**
   ```powershell
   .\start.ps1
   ```

6. **Access Application:**
   Open http://localhost:3000 in browser

## 📋 System Requirements

### Target Windows Machine Requirements:
- **OS:** Windows 10/11 or Windows Server 2019+
- **Runtime:** Bun >= 1.0.0 (download from https://bun.sh)
- **PowerShell:** 5.1+ (built into Windows)
- **RAM:** Minimum 512MB
- **Storage:** Minimum 100MB free space
- **Network:** Port 3000 available (or configure different port)

### Alternative Runtime:
If Bun is not available, can use Node.js >= 20.0.0, but requires bundle script modifications.

## 🔧 Bundle Contents

Each bundle includes:

### Core Application:
- **build/** - Compiled Remix.js application
- **prisma/** - Database schema and migrations  
- **public/** - Static assets (CSS, images, etc.)
- **package.json** - Dependencies and scripts
- **bun.lockb** - Dependency lock file

### Configuration:
- **.env.template** - Environment variables template
- **README.md** - Deployment instructions

### Scripts:
- **deploy.ps1** - Automated deployment script
- **start.ps1** - Application start script

### Optional:
- **EMAIL_SETUP.md** - Email service configuration guide
- **vite.config.ts** - Build configuration (if needed)

## 🏠 Application Features

The bundled system includes:

### Core Features:
- 🏠 **Complete apartment booking management**
- 📊 **Real-time monitoring dashboard with duration displays** 
- 👥 **Guest management with CRUD operations**
- 📧 **Automated email notifications (welcome emails, booking confirmations)**
- 🔐 **Role-based access control (admin vs client views)**
- 📱 **Responsive design for mobile and desktop**

### Dashboard Modules:
- **Monitoring** - Real-time checkout tracking with urgency indicators
- **Bookings** - Comprehensive booking management with filters
- **Guests** - Guest database with search and management tools
- **Rooms** - Room inventory and availability tracking
- **Analytics** - Occupancy and revenue reporting
- **Payments** - Payment tracking and management
- **Maintenance** - Facility maintenance scheduling

## 🔐 Security & Configuration

### Default Admin Account:
- **Email:** admin@apartment.com
- **Password:** admin123
- **⚠️ Critical:** Change this password immediately after first login!

### Essential Security Steps:
1. **Change all default secrets** in .env file
2. **Update admin password** on first login
3. **Configure firewall** to allow only necessary ports
4. **Set up HTTPS** for production use
5. **Regular database backups** (copy data/production.db)

### Email Service Setup:
1. Sign up at https://resend.com
2. Get API key from dashboard
3. Update `RESEND_API_KEY` in .env file
4. Test email functionality with welcome emails

## 🆘 Troubleshooting

### Common Issues:

**Port 3000 already in use:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**Bun not found:**
- Download and install Bun from https://bun.sh
- Restart PowerShell after installation

**Database permission issues:**
```powershell
# Fix file permissions
icacls data /grant Everyone:F /T
```

**Application won't start:**
```powershell
# Check if build exists
dir build
# If not, run deploy again
.\deploy.ps1
```

**Email not working:**
- Verify RESEND_API_KEY is correct
- Check EMAIL_SETUP.md for detailed configuration

## 📊 Bundle Statistics

Typical bundle size: **~50-80 MB** (compressed)
- Build files: ~30-40 MB
- Dependencies: ~15-20 MB  
- Assets and config: ~5-10 MB

## 🌐 Production Deployment Tips

### For Production Use:
1. **Use reverse proxy** (IIS, nginx) for HTTPS
2. **Set up process manager** (PM2, Windows Service)
3. **Configure monitoring** and logging
4. **Implement backup strategy** for database
5. **Set up SSL certificates** (Let's Encrypt)
6. **Configure domain name** and DNS

### Scaling Considerations:
- SQLite database suitable for small to medium deployments
- For larger scale, consider PostgreSQL migration
- Implement caching strategies for high traffic
- Consider load balancing for multiple instances

---

## ✅ Summary

**Use `bundle-simple.ps1`** for reliable Windows deployment. It creates a complete, ready-to-deploy bundle with all necessary files and clear instructions.

The bundle includes the full-featured Apartment Management System with real-time monitoring, comprehensive booking management, guest CRUD operations, automated emails, and role-based access control - everything needed for professional apartment management operations.

🏠 **Platinum Apartment Management System**  
*Ready for production deployment on Windows machines*
