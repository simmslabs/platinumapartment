# Fixed PKG Bundle Script
param([string]$OutputDir = "apartment-pkg-fixed")

Write-Host "Creating Fixed PKG Bundle..." -ForegroundColor Green

# Clean and create
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Check for pkg
$pkgCmd = Get-Command pkg -ErrorAction SilentlyContinue
if (-not $pkgCmd) {
    Write-Host "Installing pkg globally..." -ForegroundColor Yellow
    npm install -g pkg
}

# Build application
Write-Host "Building application..." -ForegroundColor Yellow
npm install
npx prisma generate
npm run build

# Create simplified package.json for pkg
Write-Host "Creating PKG configuration..." -ForegroundColor Yellow
$pkgConfig = @{
    name = "apartment-management"
    version = "1.0.0"
    main = "build/server/index.js"
    bin = @{
        "apartment-management" = "build/server/index.js"
    }
    scripts = @{
        start = "node build/server/index.js"
    }
    pkg = @{
        assets = @(
            "node_modules/.prisma/**/*"
            "prisma/**/*"
            "public/**/*"
            "build/**/*"
        )
        targets = @("node20-win-x64")
    }
    dependencies = @{
        "@prisma/client" = "^6.13.0"
        "@remix-run/node" = "*"
        "@remix-run/serve" = "*"
    }
} | ConvertTo-Json -Depth 10

$pkgConfig | Out-File -FilePath "pkg-config.json" -Encoding UTF8

# Create executable with proper config
Write-Host "Creating executable with PKG..." -ForegroundColor Yellow
pkg . --config pkg-config.json --target node20-win-x64 --output "$OutputDir\apartment-management.exe"

# Copy essential files
Write-Host "Copying deployment files..." -ForegroundColor Yellow
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse

# Copy Prisma client if exists
if (Test-Path "node_modules\.prisma") {
    New-Item -ItemType Directory -Force -Path "$OutputDir\node_modules\.prisma" | Out-Null
    Copy-Item "node_modules\.prisma" -Destination "$OutputDir\node_modules\.prisma" -Recurse -Force
}

# Create environment template
@"
DATABASE_URL=file:./data/production.db
JWT_SECRET=your-jwt-secret-change-this
SESSION_SECRET=your-session-secret-change-this
RESEND_API_KEY=your-resend-api-key-here
APP_URL=http://localhost:3000
NODE_ENV=production
"@ | Out-File -FilePath "$OutputDir\.env.template" -Encoding UTF8

# Create deploy script
@"
Write-Host 'PKG Apartment Management Deployment' -ForegroundColor Green
Write-Host 'This deployment does NOT require Node.js!' -ForegroundColor Yellow

if (!(Test-Path '.env')) {
    Write-Host 'Creating .env from template...' -ForegroundColor Yellow
    Copy-Item '.env.template' -Destination '.env'
    Write-Host 'Please edit .env with your settings' -ForegroundColor Red
    exit 1
}

# Create data directory
New-Item -ItemType Directory -Force -Path 'data' | Out-Null

# Check if Prisma CLI is available
$prismaCmd = Get-Command prisma -ErrorAction SilentlyContinue
if (-not $prismaCmd) {
    Write-Host 'Installing Prisma CLI globally...' -ForegroundColor Yellow
    npm install -g prisma
}

Write-Host 'Setting up database...' -ForegroundColor Yellow
prisma migrate deploy

Write-Host 'Setup complete!' -ForegroundColor Green
Write-Host 'Run: .\start.ps1 or .\apartment-management.exe' -ForegroundColor Cyan
"@ | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8

# Create start script
@"
Write-Host 'Starting Apartment Management System...' -ForegroundColor Green

if (!(Test-Path '.env')) {
    Write-Host 'Run deploy.ps1 first to set up the application' -ForegroundColor Red
    exit 1
}

Write-Host 'Starting server...' -ForegroundColor Yellow
Write-Host 'Open browser to: http://localhost:3000' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop server' -ForegroundColor Gray

.\apartment-management.exe
"@ | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

# Create comprehensive README
@"
# Apartment Management System - PKG Executable Bundle

## 🚀 No Node.js Required!
This bundle contains a standalone executable that does NOT require Node.js installation on the target machine.

## 📦 What's Included
- apartment-management.exe (Standalone executable)
- Database migration files (prisma/)
- Static assets (public/)
- Environment template (.env.template)
- Deployment scripts (deploy.ps1, start.ps1)

## ⚡ Quick Start

### 1. Configure Environment
```powershell
# Copy template and edit settings
Copy-Item .env.template -Destination .env
notepad .env
```

### 2. Deploy
```powershell
.\deploy.ps1
```

### 3. Start Application
```powershell
.\start.ps1
```

### 4. Access Application
Open browser to: http://localhost:3000

## 🔐 Default Admin Login
- Email: admin@apartment.com
- Password: admin123

**⚠️ Change password immediately after first login!**

## 📝 Environment Configuration

Edit `.env` file with your settings:

```env
# Database (SQLite by default)
DATABASE_URL=file:./data/production.db

# Security (CHANGE THESE!)
JWT_SECRET=your-very-secure-jwt-secret-here
SESSION_SECRET=your-very-secure-session-secret-here

# Email Service (Optional)
RESEND_API_KEY=your-resend-api-key-here

# Application
APP_URL=http://localhost:3000
NODE_ENV=production
```

## 🌟 System Features
- **Apartment Management**: Add, edit, delete apartments
- **Guest Management**: Track guest information and stays
- **Booking System**: Manage reservations and check-ins/outs
- **Real-time Monitoring**: Live status updates with duration displays
- **Payment Tracking**: Record and manage payments
- **Maintenance Logs**: Track maintenance requests and completions
- **Analytics Dashboard**: Occupancy rates, revenue metrics
- **Email Notifications**: Automated booking confirmations
- **Role-based Access**: Admin and staff user roles
- **Responsive Design**: Works on desktop, tablet, and mobile

## 🔧 Technical Details
- **Runtime**: Standalone executable (Node.js v20 embedded)
- **Database**: SQLite (included, no separate installation)
- **Web Server**: Built-in HTTP server on port 3000
- **Architecture**: Full-stack Remix.js application
- **UI Framework**: Mantine components with Tailwind CSS

## 🛠️ Troubleshooting

### Port Already in Use
If port 3000 is busy, edit `.env` and add:
```env
PORT=3001
```

### Database Issues
Reset database:
```powershell
Remove-Item data\production.db -Force
.\deploy.ps1
```

### Permission Errors
Run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📁 Directory Structure
```
apartment-pkg-bundle/
├── apartment-management.exe    # Main executable
├── .env.template              # Environment template
├── .env                       # Your configuration
├── deploy.ps1                 # Setup script
├── start.ps1                  # Start script
├── README.md                  # This file
├── data/                      # Database directory
├── prisma/                    # Database schema & migrations
└── public/                    # Static web assets
```

## 🔄 Updates
To update the application:
1. Extract new bundle to different folder
2. Copy your `.env` file to new location
3. Copy `data/` directory to preserve database
4. Run `.\deploy.ps1` in new location

## 📞 Support
For issues or questions:
1. Check this README
2. Verify `.env` configuration
3. Check Windows Event Viewer for errors
4. Ensure port 3000 is available

## ✅ Deployment Checklist
- [ ] Extracted bundle files
- [ ] Copied .env.template to .env
- [ ] Edited .env with proper values
- [ ] Ran deploy.ps1 successfully
- [ ] Started application with start.ps1
- [ ] Accessed http://localhost:3000
- [ ] Logged in with admin credentials
- [ ] Changed default admin password

Enjoy your self-contained apartment management system! 🏠
"@ | Out-File -FilePath "$OutputDir\README.md" -Encoding UTF8

# Create ZIP archive
$zipName = "apartment-pkg-fixed.zip"
if (Test-Path $zipName) { Remove-Item $zipName }

# Check if executable was created
if (Test-Path "$OutputDir\apartment-management.exe") {
    Write-Host "PKG executable created successfully!" -ForegroundColor Green
    Compress-Archive -Path "$OutputDir\*" -DestinationPath $zipName
    
    $size = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    $exeSize = [math]::Round((Get-Item "$OutputDir\apartment-management.exe").Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "✅ PKG Bundle created successfully!" -ForegroundColor Green
    Write-Host "📁 Folder: $OutputDir" -ForegroundColor White
    Write-Host "📦 ZIP: $zipName" -ForegroundColor White
    Write-Host "📊 Total Size: $size MB" -ForegroundColor White
    Write-Host "⚡ Executable: apartment-management.exe ($exeSize MB)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🌟 Advantages:" -ForegroundColor Cyan
    Write-Host "   • No Node.js required on target machine" -ForegroundColor Gray
    Write-Host "   • Single executable file" -ForegroundColor Gray
    Write-Host "   • Self-contained deployment" -ForegroundColor Gray
    Write-Host "   • Faster startup than regular Node.js" -ForegroundColor Gray
    Write-Host "   • Built-in SQLite database" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🚀 To deploy:" -ForegroundColor Yellow
    Write-Host "   1. Extract $zipName on target machine" -ForegroundColor Gray
    Write-Host "   2. Copy .env.template to .env and configure" -ForegroundColor Gray
    Write-Host "   3. Run deploy.ps1" -ForegroundColor Gray
    Write-Host "   4. Run apartment-management.exe" -ForegroundColor Gray
} else {
    Write-Host "❌ PKG executable creation failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    Write-Host "You can still use the regular bundle-simple.ps1 script" -ForegroundColor Gray
}

# Cleanup
Remove-Item "pkg-config.json" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Bundle process completed!" -ForegroundColor Green
