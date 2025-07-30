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

# Create environment template
Write-Host "📄 Creating environment template..." -ForegroundColor Yellow
$envTemplate = @"
# Environment variables for production
DATABASE_URL="file:./data/production.db"
JWT_SECRET="change-this-secret-in-production"
SESSION_SECRET="change-this-session-secret"
RESEND_API_KEY="your-resend-api-key-here"
APP_URL="http://localhost:3000"
NODE_ENV="production"
"@
$envTemplate | Out-File -FilePath "$OutputDir\.env.template" -Encoding UTF8

# Create simple deployment script
$deployScript = @"
# Simple deployment for Windows
Write-Host "Deploying Apartment Management System..." -ForegroundColor Green

if (!(Test-Path ".env")) {
    Write-Host "Please copy .env.template to .env and configure it" -ForegroundColor Red
    exit 1
}

bun install --production --frozen-lockfile
New-Item -ItemType Directory -Force -Path "data" | Out-Null
bunx prisma migrate deploy

Write-Host "Deployment complete! Run 'bun start' to start the application" -ForegroundColor Green
"@
$deployScript | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8

# Create simple start script
$startScript = @"
Write-Host "Starting Apartment Management System..." -ForegroundColor Green
bun start
"@
$startScript | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

# Create simple README
$readme = @"
# Apartment Management System - Production Bundle

## Quick Start

1. Copy environment template:
   \`\`\`
   cp .env.template .env
   \`\`\`

2. Edit .env with your production values

3. Deploy:
   \`\`\`
   .\deploy.ps1
   \`\`\`

4. Start:
   \`\`\`
   .\start.ps1
   \`\`\`

## Requirements
- Bun >= 1.0.0 (or Node.js >= 20.0.0)
- SQLite database
- Resend API key for emails

## Default Admin
- Email: admin@apartment.com  
- Password: admin123

Change this after first login!
"@
$readme | Out-File -FilePath "$OutputDir\DEPLOYMENT.md" -Encoding UTF8

Write-Host "`n✅ Bundle created successfully!" -ForegroundColor Green
Write-Host "📁 Location: $OutputDir" -ForegroundColor White
Write-Host "📖 See DEPLOYMENT.md for instructions" -ForegroundColor Cyan

# Create archive
$archiveName = "apartment-management-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force
Write-Host "📦 Archive created: $archiveName" -ForegroundColor Green
