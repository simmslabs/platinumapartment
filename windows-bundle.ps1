# Windows Bundle Script for Apartment Management System
param(
    [string]$OutputDir = "apartment-windows-bundle"
)

Write-Host "🏠 Creating Windows Bundle..." -ForegroundColor Green

# Clean and create output directory
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Build application
Write-Host "📦 Building application..." -ForegroundColor Yellow
bun install --frozen-lockfile
bunx prisma generate
bun run build

# Copy files
Write-Host "📂 Copying files..." -ForegroundColor Yellow
Copy-Item "build" -Destination "$OutputDir\build" -Recurse
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse
Copy-Item "package.json" -Destination "$OutputDir\package.json"
Copy-Item "bun.lockb" -Destination "$OutputDir\bun.lockb"

# Copy optional files
if (Test-Path "README.md") { Copy-Item "README.md" -Destination "$OutputDir\" }
if (Test-Path "EMAIL_SETUP.md") { Copy-Item "EMAIL_SETUP.md" -Destination "$OutputDir\" }

# Create .env.template
Write-Host "📝 Creating environment template..." -ForegroundColor Yellow
@"
# Environment variables for Windows production
DATABASE_URL=file:./data/production.db
JWT_SECRET=your-jwt-secret-change-this
SESSION_SECRET=your-session-secret-change-this
RESEND_API_KEY=your-resend-api-key-here
APP_URL=http://localhost:3000
NODE_ENV=production
"@ | Out-File -FilePath "$OutputDir\.env.template" -Encoding UTF8

# Create deploy.ps1
Write-Host "📄 Creating deployment script..." -ForegroundColor Yellow
@"
Write-Host 'Deploying Apartment Management System...' -ForegroundColor Green

if (!(Test-Path '.env')) {
    Write-Host 'ERROR: .env file not found!' -ForegroundColor Red
    Write-Host 'Please copy .env.template to .env and configure it' -ForegroundColor Yellow
    exit 1
}

Write-Host 'Installing dependencies...' -ForegroundColor Yellow
bun install --production --frozen-lockfile

New-Item -ItemType Directory -Force -Path 'data' | Out-Null

Write-Host 'Setting up database...' -ForegroundColor Yellow
bunx prisma migrate deploy

Write-Host 'Deployment complete!' -ForegroundColor Green
Write-Host 'Start with: .\start.ps1' -ForegroundColor Cyan
"@ | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8

# Create start.ps1
@"
Write-Host 'Starting Apartment Management System...' -ForegroundColor Green

if (!(Test-Path 'build')) {
    Write-Host 'ERROR: Please run deploy.ps1 first' -ForegroundColor Red
    exit 1
}

Write-Host 'Server starting on http://localhost:3000' -ForegroundColor Cyan
bun start
"@ | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

# Create README
@"
# Apartment Management System - Windows Bundle

## Quick Start

1. Extract this bundle to your desired location
2. Copy .env.template to .env and edit the values
3. Run: .\deploy.ps1
4. Run: .\start.ps1
5. Open: http://localhost:3000

## Requirements

- Bun >= 1.0.0 (download from https://bun.sh)
- Windows 10/11 or Windows Server 2019+
- PowerShell 5.1+

## Default Admin

- Email: admin@apartment.com
- Password: admin123

**Change this password after first login!**

## Features

- 🏠 Apartment booking management
- 📊 Real-time monitoring with duration displays
- 📧 Email notifications
- 👥 Guest management
- 🔐 Role-based access control
- 📱 Responsive design

## Troubleshooting

**Port 3000 in use?**
```
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**Database issues?**
```
Remove-Item data\production.db -Force
bunx prisma migrate deploy
```

**Stop server:** Press Ctrl+C

## Production Notes

1. Change all secrets in .env
2. Use reverse proxy for production
3. Configure firewall
4. Backup database regularly (copy data/production.db)

---
🏠 Platinum Apartment Management System
"@ | Out-File -FilePath "$OutputDir\README.md" -Encoding UTF8

# Create ZIP
$archiveName = "apartment-management-windows-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force

$bundleSize = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host "`n✅ Windows bundle created!" -ForegroundColor Green
Write-Host "📁 Directory: $OutputDir" -ForegroundColor White
Write-Host "📦 Archive: $archiveName" -ForegroundColor White
Write-Host "💾 Size: $bundleSize MB" -ForegroundColor White
Write-Host "`n🚀 To deploy:" -ForegroundColor Yellow
Write-Host "   1. Extract $archiveName on target machine" -ForegroundColor Gray
Write-Host "   2. Copy .env.template to .env and configure" -ForegroundColor Gray
Write-Host "   3. Run .\deploy.ps1" -ForegroundColor Gray
Write-Host "   4. Run .\start.ps1" -ForegroundColor Gray
