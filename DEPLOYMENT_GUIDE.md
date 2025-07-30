# 🏠 Apartment Management System - Deployment Guide

This guide provides multiple deployment options for the Apartment Management System.

## 📦 Bundle Deployment (Recommended for VPS/Dedicated Servers)

### Prerequisites
- Bun >= 1.0.0 (or Node.js >= 20.0.0)
- 512MB+ RAM
- 100MB+ storage

### Step 1: Create Bundle

**Windows (PowerShell):**
```powershell
.\bundle.ps1
```

**Linux/macOS:**
```bash
chmod +x bundle.sh
./bundle.sh
```

**Options:**
```bash
# Custom output directory
./bundle.sh --output-dir my-deployment

# Include source code
./bundle.sh --include-source

# Clean previous bundle
./bundle.sh --clean
```

### Step 2: Transfer to Target Machine
```bash
# Extract the generated archive
tar -xzf apartment-management-YYYYMMDD-HHMMSS.tar.gz  # Linux/macOS
# or unzip apartment-management-YYYYMMDD-HHMMSS.zip    # Windows
```

### Step 3: Configure Environment
```bash
cp .env.template .env
# Edit .env with your production values
```

### Step 4: Deploy
```bash
# Linux/macOS
./deploy.sh

# Windows
.\deploy.ps1
```

### Step 5: Start Application
```bash
# Option 1: Direct start
bun start

# Option 2: Using start script
./start.sh      # Linux/macOS
.\start.ps1     # Windows
```

## 🐳 Docker Deployment

### Prerequisites
- Docker >= 20.0.0
- Docker Compose >= 2.0.0

### Option 1: Docker Compose (Recommended)

1. **Setup Environment:**
   ```bash
   cp .env.docker .env
   # Edit .env with your values
   ```

2. **Start Application:**
   ```bash
   docker-compose up -d
   ```

3. **With Nginx Reverse Proxy:**
   ```bash
   docker-compose --profile with-nginx up -d
   ```

### Option 2: Docker Build & Run

1. **Build Image:**
   ```bash
   docker build -t apartment-management .
   ```

2. **Run Container:**
   ```bash
   docker run -d \
     --name apartment-app \
     -p 3000:3000 \
     -e JWT_SECRET="your-secret" \
     -e SESSION_SECRET="your-session-secret" \
     -e RESEND_API_KEY="your-resend-key" \
     -v apartment_data:/app/data \
     apartment-management
   ```

## ☁️ Cloud Platform Deployment

### Render.com

1. **Create Blueprint File (render.yaml):**
   ```yaml
   services:
     - type: web
       name: apartment-management
       env: node
       buildCommand: bun install && bun run build
       startCommand: bun start
       envVars:
         - key: NODE_ENV
           value: production
         - key: DATABASE_URL
           value: file:./data/production.db
   ```

2. **Deploy via Git or Upload**

### Railway

1. **Connect Repository**
2. **Set Environment Variables**
3. **Deploy Automatically**

### Fly.io

1. **Install Fly CLI**
2. **Initialize:**
   ```bash
   fly launch
   ```
3. **Deploy:**
   ```bash
   fly deploy
   ```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./data/production.db` |
| `JWT_SECRET` | JWT signing secret | 32+ character random string |
| `SESSION_SECRET` | Session encryption | 32+ character random string |
| `RESEND_API_KEY` | Email API key | Get from resend.com |
| `APP_URL` | Application URL | `https://yourdomain.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` |

## 🗄️ Database Setup

### Initial Migration
```bash
bunx prisma migrate deploy
```

### Seed Database (Optional)
```bash
bunx tsx prisma/seed.ts
```

### Backup Database
```bash
# Copy the SQLite file
cp data/production.db backups/backup-$(date +%Y%m%d).db
```

## 🔐 Security Checklist

- [ ] **Change default secrets** in .env
- [ ] **Set up HTTPS** (Let's Encrypt recommended)
- [ ] **Configure firewall** (allow only 80, 443, 22)
- [ ] **Regular updates** of dependencies
- [ ] **Database backups** scheduled
- [ ] **Change admin password** after first login
- [ ] **Set strong passwords** for all users
- [ ] **Monitor logs** for suspicious activity

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Application Logs
```bash
# Docker
docker logs apartment-management

# PM2 (if using)
pm2 logs apartment-management
```

### Database Size
```bash
ls -lh data/production.db
```

## 🚀 Performance Optimization

### Process Manager (Recommended)

**Install PM2:**
```bash
npm install -g pm2
```

**Create ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'apartment-management',
    script: 'bun',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster'
  }]
}
```

**Start with PM2:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

**Install Nginx:**
```bash
sudo apt install nginx
```

**Configure (/etc/nginx/sites-available/apartment):**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 🆘 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

**Database Permission Issues:**
```bash
# Fix permissions
chmod 755 data/
chmod 644 data/production.db
```

**Build Failures:**
```bash
# Clear cache and rebuild
rm -rf node_modules .cache build
bun install
bun run build
```

### Debug Mode
```bash
# Set debug environment
export DEBUG=remix:*
bun start
```

## 📞 Support

- **Documentation**: See DEPLOYMENT.md in bundle
- **Health Check**: `/health` endpoint
- **Admin Panel**: Login with admin credentials
- **Logs**: Check application logs for errors

---

🏠 **Platinum Apartment Management System**
Built with ❤️ using Remix.js and Mantine

Last updated: $(date)
