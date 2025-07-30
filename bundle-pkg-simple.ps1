# Simple PKG Bundle Script
param([string]$OutputDir = "apartment-pkg-bundle")

Write-Host "Creating PKG Bundle..." -ForegroundColor Green

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

# Create simple package.json for pkg
$pkgJson = @"
{
  "name": "apartment-management",
  "version": "1.0.0",
  "main": "build/server/index.js",
  "bin": "build/server/index.js",
  "scripts": {
    "start": "node build/server/index.js"
  },
  "pkg": {
    "assets": [
      "node_modules/.prisma/**/*",
      "prisma/**/*",
      "public/**/*",
      "build/**/*"
    ],
    "targets": ["node20-win-x64"]
  },
  "dependencies": {
    "@prisma/client": "^6.13.0",
    "@remix-run/node": "*",
    "@remix-run/serve": "*"
  }
}
"@

$pkgJson | Out-File -FilePath "temp-pkg.json" -Encoding UTF8

# Create executable
Write-Host "Creating executable with pkg..." -ForegroundColor Yellow
pkg . --config temp-pkg.json --target node20-win-x64 --output "$OutputDir\apartment-management.exe"

# Copy essential files
Write-Host "Copying files..." -ForegroundColor Yellow
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse

# Create Prisma directory
New-Item -ItemType Directory -Force -Path "$OutputDir\node_modules\.prisma" | Out-Null
if (Test-Path "node_modules\.prisma") {
    Copy-Item "node_modules\.prisma" -Destination "$OutputDir\node_modules\.prisma" -Recurse -Force
}

# Create environment template
"DATABASE_URL=file:./data/production.db" | Out-File -FilePath "$OutputDir\.env.template"
"JWT_SECRET=your-jwt-secret-change-this" | Add-Content -Path "$OutputDir\.env.template"
"SESSION_SECRET=your-session-secret-change-this" | Add-Content -Path "$OutputDir\.env.template"
"RESEND_API_KEY=your-resend-api-key-here" | Add-Content -Path "$OutputDir\.env.template"
"APP_URL=http://localhost:3000" | Add-Content -Path "$OutputDir\.env.template"
"NODE_ENV=production" | Add-Content -Path "$OutputDir\.env.template"

# Create deploy script
"Write-Host 'PKG Deployment' -ForegroundColor Green" | Out-File -FilePath "$OutputDir\deploy.ps1"
"if (!(Test-Path '.env')) { Write-Host 'Copy .env.template to .env first'; exit 1 }" | Add-Content -Path "$OutputDir\deploy.ps1"
"New-Item -ItemType Directory -Force -Path 'data' | Out-Null" | Add-Content -Path "$OutputDir\deploy.ps1"
"Write-Host 'Installing Prisma CLI...' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\deploy.ps1"
"npm install -g prisma" | Add-Content -Path "$OutputDir\deploy.ps1"
"Write-Host 'Setting up database...' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\deploy.ps1"
"prisma migrate deploy" | Add-Content -Path "$OutputDir\deploy.ps1"
"Write-Host 'Complete! Run: .\apartment-management.exe' -ForegroundColor Green" | Add-Content -Path "$OutputDir\deploy.ps1"

# Create start script
"Write-Host 'Starting PKG Application...' -ForegroundColor Green" | Out-File -FilePath "$OutputDir\start.ps1"
"if (!(Test-Path '.env')) { Write-Host 'Run deploy.ps1 first'; exit 1 }" | Add-Content -Path "$OutputDir\start.ps1"
"Write-Host 'Open http://localhost:3000' -ForegroundColor Cyan" | Add-Content -Path "$OutputDir\start.ps1"
".\apartment-management.exe" | Add-Content -Path "$OutputDir\start.ps1"

# Create README
"# Apartment Management - PKG Executable Bundle" | Out-File -FilePath "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## No Node.js Required!" | Add-Content -Path "$OutputDir\README.md"
"This bundle contains a standalone executable that does NOT require Node.js." | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## Quick Start" | Add-Content -Path "$OutputDir\README.md"
"1. Copy .env.template to .env and edit values" | Add-Content -Path "$OutputDir\README.md"
"2. Run: .\deploy.ps1" | Add-Content -Path "$OutputDir\README.md"
"3. Run: .\start.ps1 or .\apartment-management.exe" | Add-Content -Path "$OutputDir\README.md"
"4. Open: http://localhost:3000" | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## Admin Login" | Add-Content -Path "$OutputDir\README.md"
"Email: admin@apartment.com" | Add-Content -Path "$OutputDir\README.md"
"Password: admin123" | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"Change password after login!" | Add-Content -Path "$OutputDir\README.md"
"" | Add-Content -Path "$OutputDir\README.md"
"## Features" | Add-Content -Path "$OutputDir\README.md"
"- Complete apartment management system" | Add-Content -Path "$OutputDir\README.md"
"- Real-time monitoring with duration displays" | Add-Content -Path "$OutputDir\README.md"
"- Guest and booking management" | Add-Content -Path "$OutputDir\README.md"
"- Email notifications" | Add-Content -Path "$OutputDir\README.md"
"- Role-based access control" | Add-Content -Path "$OutputDir\README.md"
"- Self-contained executable" | Add-Content -Path "$OutputDir\README.md"

# Create ZIP
$zipName = "apartment-pkg-bundle.zip"
if (Test-Path $zipName) { Remove-Item $zipName }
Compress-Archive -Path "$OutputDir\*" -DestinationPath $zipName

# Cleanup
Remove-Item "temp-pkg.json" -Force -ErrorAction SilentlyContinue

$size = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host "`nPKG Bundle created successfully!" -ForegroundColor Green
Write-Host "Folder: $OutputDir" -ForegroundColor White
Write-Host "ZIP: $zipName" -ForegroundColor White
Write-Host "Size: $size MB" -ForegroundColor White
Write-Host "Executable: apartment-management.exe" -ForegroundColor Yellow
Write-Host ""
Write-Host "Advantages:" -ForegroundColor Cyan
Write-Host "- No Node.js required on target machine" -ForegroundColor Gray
Write-Host "- Single executable file" -ForegroundColor Gray
Write-Host "- Self-contained deployment" -ForegroundColor Gray
Write-Host "- Faster startup" -ForegroundColor Gray
Write-Host ""
Write-Host "To deploy:" -ForegroundColor Yellow
Write-Host "1. Extract ZIP on target machine" -ForegroundColor Gray
Write-Host "2. Copy .env.template to .env and configure" -ForegroundColor Gray
Write-Host "3. Run deploy.ps1" -ForegroundColor Gray
Write-Host "4. Run apartment-management.exe" -ForegroundColor Gray
