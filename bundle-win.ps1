# Windows Bundle Script for Apartment Management System
param([string]$OutputDir = "apartment-windows-bundle")

Write-Host "🏠 Creating Windows Bundle..." -ForegroundColor Green

# Clean and create output directory
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Build application
Write-Host "📦 Building..." -ForegroundColor Yellow
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

# Create environment template using individual lines
Write-Host "📝 Creating files..." -ForegroundColor Yellow
"DATABASE_URL=file:./data/production.db" | Out-File -FilePath "$OutputDir\.env.template"
"JWT_SECRET=your-jwt-secret-change-this" | Add-Content -Path "$OutputDir\.env.template"
"SESSION_SECRET=your-session-secret-change-this" | Add-Content -Path "$OutputDir\.env.template"
"RESEND_API_KEY=your-resend-api-key-here" | Add-Content -Path "$OutputDir\.env.template"
"APP_URL=http://localhost:3000" | Add-Content -Path "$OutputDir\.env.template"
"NODE_ENV=production" | Add-Content -Path "$OutputDir\.env.template"

# Create deploy.ps1
"Write-Host 'Deploying...' -ForegroundColor Green" | Out-File -FilePath "$OutputDir\deploy.ps1"
"if (!(Test-Path '.env')) { Write-Host 'Copy .env.template to .env first' -ForegroundColor Red; exit 1 }" | Add-Content -Path "$OutputDir\deploy.ps1"
"bun install --production --frozen-lockfile" | Add-Content -Path "$OutputDir\deploy.ps1"
"New-Item -ItemType Directory -Force -Path 'data' | Out-Null" | Add-Content -Path "$OutputDir\deploy.ps1"
"bunx prisma migrate deploy" | Add-Content -Path "$OutputDir\deploy.ps1"
"Write-Host 'Complete! Run start.ps1' -ForegroundColor Green" | Add-Content -Path "$OutputDir\deploy.ps1"

# Create start.ps1  
"Write-Host 'Starting server...' -ForegroundColor Green" | Out-File -FilePath "$OutputDir\start.ps1"
"if (!(Test-Path 'build')) { Write-Host 'Run deploy.ps1 first' -ForegroundColor Red; exit 1 }" | Add-Content -Path "$OutputDir\start.ps1"
"Write-Host 'Open http://localhost:3000' -ForegroundColor Cyan" | Add-Content -Path "$OutputDir\start.ps1"
"bun start" | Add-Content -Path "$OutputDir\start.ps1"

# Create README
"# Apartment Management - Windows Bundle" | Out-File -FilePath "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## Quick Start" | Add-Content -Path "$OutputDir\README.md"
"1. Copy .env.template to .env and edit values" | Add-Content -Path "$OutputDir\README.md"
"2. Run: .\deploy.ps1" | Add-Content -Path "$OutputDir\README.md"
"3. Run: .\start.ps1" | Add-Content -Path "$OutputDir\README.md"
"4. Open: http://localhost:3000" | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## Requirements" | Add-Content -Path "$OutputDir\README.md"
"- Bun (download from https://bun.sh)" | Add-Content -Path "$OutputDir\README.md"
"- Windows 10+" | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## Default Admin" | Add-Content -Path "$OutputDir\README.md"
"Email: admin@apartment.com" | Add-Content -Path "$OutputDir\README.md"
"Password: admin123" | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"Change password after first login!" | Add-Content -Path "$OutputDir\README.md"

# Create ZIP
$archiveName = "apartment-windows-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force

$size = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host "`n✅ Bundle created!" -ForegroundColor Green
Write-Host "📁 Folder: $OutputDir" -ForegroundColor White
Write-Host "📦 ZIP: $archiveName" -ForegroundColor White  
Write-Host "Size: $size MB" -ForegroundColor White
Write-Host "`n🚀 To deploy on Windows machine:" -ForegroundColor Yellow
Write-Host "  1. Extract ZIP file" -ForegroundColor Gray
Write-Host "  2. Copy .env.template to .env" -ForegroundColor Gray
Write-Host "  3. Edit .env with your settings" -ForegroundColor Gray
Write-Host "  4. Run .\deploy.ps1" -ForegroundColor Gray
Write-Host "  5. Run .\start.ps1" -ForegroundColor Gray
Write-Host "`n📖 See README.md in bundle for details" -ForegroundColor Cyan
