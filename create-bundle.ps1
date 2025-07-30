# Simple bundling script for Apartment Management System
param(
    [string]$OutputDir = "apartment-bundle"
)

Write-Host "🏠 Creating production bundle..." -ForegroundColor Green

# Clean and create output directory
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Install dependencies and build
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
bun install --frozen-lockfile

Write-Host "🔧 Generating Prisma client..." -ForegroundColor Yellow  
bunx prisma generate

Write-Host "🏗️ Building application..." -ForegroundColor Yellow
bun run build

# Copy essential files
Write-Host "📁 Copying files..." -ForegroundColor Yellow
Copy-Item "build" -Destination "$OutputDir\build" -Recurse
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse
Copy-Item "package.json" -Destination "$OutputDir\package.json"
Copy-Item "bun.lockb" -Destination "$OutputDir\bun.lockb"

# Copy configuration files
if (Test-Path "vite.config.ts") { Copy-Item "vite.config.ts" -Destination "$OutputDir\" }
if (Test-Path "tsconfig.json") { Copy-Item "tsconfig.json" -Destination "$OutputDir\" }
if (Test-Path "README.md") { Copy-Item "README.md" -Destination "$OutputDir\" }
if (Test-Path "EMAIL_SETUP.md") { Copy-Item "EMAIL_SETUP.md" -Destination "$OutputDir\" }

# Create files using temporary files to avoid parsing issues
Write-Host "📄 Creating deployment files..." -ForegroundColor Yellow

# Create .env.template
"DATABASE_URL=`"file:./data/production.db`"" | Out-File -FilePath "$OutputDir\.env.template"
"JWT_SECRET=`"change-this-secret-in-production`"" | Add-Content -Path "$OutputDir\.env.template"
"SESSION_SECRET=`"change-this-session-secret`"" | Add-Content -Path "$OutputDir\.env.template"
"RESEND_API_KEY=`"your-resend-api-key-here`"" | Add-Content -Path "$OutputDir\.env.template"
"APP_URL=`"http://localhost:3000`"" | Add-Content -Path "$OutputDir\.env.template"
"NODE_ENV=`"production`"" | Add-Content -Path "$OutputDir\.env.template"

# Create deploy.ps1
"Write-Host `"Deploying Apartment Management System...`" -ForegroundColor Green" | Out-File -FilePath "$OutputDir\deploy.ps1"
"if (!(Test-Path `".env`")) { Write-Host `"Please copy .env.template to .env`" -ForegroundColor Red; exit 1 }" | Add-Content -Path "$OutputDir\deploy.ps1"
"bun install --production --frozen-lockfile" | Add-Content -Path "$OutputDir\deploy.ps1"
"New-Item -ItemType Directory -Force -Path `"data`" | Out-Null" | Add-Content -Path "$OutputDir\deploy.ps1"
"bunx prisma migrate deploy" | Add-Content -Path "$OutputDir\deploy.ps1"
"Write-Host `"Deployment complete! Run 'bun start' to start`" -ForegroundColor Green" | Add-Content -Path "$OutputDir\deploy.ps1"

# Create start.ps1
"Write-Host `"Starting Apartment Management System...`" -ForegroundColor Green" | Out-File -FilePath "$OutputDir\start.ps1"
"bun start" | Add-Content -Path "$OutputDir\start.ps1"

# Create README
"# Apartment Management System - Production Bundle" | Out-File -FilePath "$OutputDir\DEPLOYMENT.md"
"" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"## Quick Start" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"1. Copy .env.template to .env and edit values" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"2. Run deploy.ps1" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"3. Run start.ps1" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"## Requirements" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"- Bun >= 1.0.0 or Node.js >= 20.0.0" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"- Resend API key for emails" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"## Default Admin" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"Email: admin@apartment.com" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"
"Password: admin123" | Add-Content -Path "$OutputDir\DEPLOYMENT.md"

Write-Host "`n✅ Bundle created successfully!" -ForegroundColor Green
Write-Host "📁 Location: $OutputDir" -ForegroundColor White
Write-Host "📖 See DEPLOYMENT.md for instructions" -ForegroundColor Cyan

# Create archive
$archiveName = "apartment-management-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force
Write-Host "📦 Archive created: $archiveName" -ForegroundColor Green
