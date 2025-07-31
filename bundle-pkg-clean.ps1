# Clean PKG Bundle Script
param([string]$OutputDir = "apartment-pkg-clean")

Write-Host "Creating Clean PKG Bundle..." -ForegroundColor Green

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

# Create PKG configuration
Write-Host "Creating PKG configuration..." -ForegroundColor Yellow
$pkgConfig = @"
{
  "name": "apartment-management",
  "version": "1.0.0",
  "main": "build/server/index.js",
  "bin": {
    "apartment-management": "build/server/index.js"
  },
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

$pkgConfig | Out-File -FilePath "pkg-config.json" -Encoding UTF8

# Create executable
Write-Host "Creating executable with PKG..." -ForegroundColor Yellow
pkg . --config pkg-config.json --target node20-win-x64 --output "$OutputDir\apartment-management.exe"

# Copy files
Write-Host "Copying deployment files..." -ForegroundColor Yellow
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse

if (Test-Path "node_modules\.prisma") {
    New-Item -ItemType Directory -Force -Path "$OutputDir\node_modules\.prisma" | Out-Null
    Copy-Item "node_modules\.prisma" -Destination "$OutputDir\node_modules\.prisma" -Recurse -Force
}

# Create environment template
"DATABASE_URL=file:./data/production.db" | Out-File -FilePath "$OutputDir\.env.template" -Encoding UTF8
"JWT_SECRET=your-jwt-secret-change-this" | Add-Content -Path "$OutputDir\.env.template" -Encoding UTF8
"SESSION_SECRET=your-session-secret-change-this" | Add-Content -Path "$OutputDir\.env.template" -Encoding UTF8
"RESEND_API_KEY=your-resend-api-key-here" | Add-Content -Path "$OutputDir\.env.template" -Encoding UTF8
"APP_URL=http://localhost:3000" | Add-Content -Path "$OutputDir\.env.template" -Encoding UTF8
"NODE_ENV=production" | Add-Content -Path "$OutputDir\.env.template" -Encoding UTF8

# Create deploy script
"Write-Host 'PKG Apartment Management Deployment' -ForegroundColor Green" | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8
"Write-Host 'This deployment does NOT require Node.js!' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"if (!(Test-Path '.env')) {" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"    Write-Host 'Creating .env from template...' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"    Copy-Item '.env.template' -Destination '.env'" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"    Write-Host 'Please edit .env with your settings' -ForegroundColor Red" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"    exit 1" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"}" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"New-Item -ItemType Directory -Force -Path 'data' | Out-Null" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"`$prismaCmd = Get-Command prisma -ErrorAction SilentlyContinue" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"if (-not `$prismaCmd) {" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"    Write-Host 'Installing Prisma CLI globally...' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"    npm install -g prisma" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"}" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"Write-Host 'Setting up database...' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"prisma migrate deploy" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"Write-Host 'Setup complete!' -ForegroundColor Green" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8
"Write-Host 'Run: .\start.ps1 or .\apartment-management.exe' -ForegroundColor Cyan" | Add-Content -Path "$OutputDir\deploy.ps1" -Encoding UTF8

# Create start script
"Write-Host 'Starting Apartment Management System...' -ForegroundColor Green" | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"if (!(Test-Path '.env')) {" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"    Write-Host 'Run deploy.ps1 first to set up the application' -ForegroundColor Red" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"    exit 1" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"}" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"Write-Host 'Starting server...' -ForegroundColor Yellow" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"Write-Host 'Open browser to: http://localhost:3000' -ForegroundColor Cyan" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"Write-Host 'Press Ctrl+C to stop server' -ForegroundColor Gray" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8
".\apartment-management.exe" | Add-Content -Path "$OutputDir\start.ps1" -Encoding UTF8

# Create README
"# Apartment Management System - PKG Executable Bundle" | Out-File -FilePath "$OutputDir\README.md" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"## No Node.js Required!" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"This bundle contains a standalone executable that does NOT require Node.js installation." | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"## Quick Start" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"1. Copy .env.template to .env and edit with your settings" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"2. Run: .\deploy.ps1" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"3. Run: .\start.ps1 or .\apartment-management.exe" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"4. Open browser to: http://localhost:3000" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"## Default Admin Login" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Email: admin@apartment.com" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Password: admin123" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"**IMPORTANT: Change password after first login!**" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"## Features" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Complete apartment management system" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Real-time monitoring with duration displays" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Guest and booking management" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Payment tracking and analytics" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Email notifications" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Role-based access control" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- Self-contained executable - no Node.js needed!" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"## Environment Configuration" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"Edit .env file with your specific settings:" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- DATABASE_URL: SQLite database location" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- JWT_SECRET: Change to a secure random string" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- SESSION_SECRET: Change to a secure random string" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- RESEND_API_KEY: For email notifications (optional)" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8
"- APP_URL: Your application URL" | Add-Content -Path "$OutputDir\README.md" -Encoding UTF8

# Create ZIP
$zipName = "apartment-pkg-clean.zip"
if (Test-Path $zipName) { Remove-Item $zipName }

# Check if executable exists
if (Test-Path "$OutputDir\apartment-management.exe") {
    Write-Host "PKG executable created successfully!" -ForegroundColor Green
    Compress-Archive -Path "$OutputDir\*" -DestinationPath $zipName
    
    $size = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    $exeSize = [math]::Round((Get-Item "$OutputDir\apartment-management.exe").Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "PKG Bundle created successfully!" -ForegroundColor Green
    Write-Host "Folder: $OutputDir" -ForegroundColor White
    Write-Host "ZIP: $zipName" -ForegroundColor White
    Write-Host "Total Size: $size MB" -ForegroundColor White
    Write-Host "Executable Size: $exeSize MB" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Advantages:" -ForegroundColor Cyan
    Write-Host "- No Node.js required on target machine" -ForegroundColor Gray
    Write-Host "- Single executable file" -ForegroundColor Gray
    Write-Host "- Self-contained deployment" -ForegroundColor Gray
    Write-Host "- Faster startup than regular Node.js" -ForegroundColor Gray
    Write-Host "- Built-in SQLite database" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To deploy:" -ForegroundColor Yellow
    Write-Host "1. Extract $zipName on target machine" -ForegroundColor Gray
    Write-Host "2. Copy .env.template to .env and configure" -ForegroundColor Gray
    Write-Host "3. Run deploy.ps1" -ForegroundColor Gray
    Write-Host "4. Run apartment-management.exe" -ForegroundColor Gray
} else {
    Write-Host "PKG executable creation failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    Write-Host "You can still use the regular bundle-simple.ps1 script" -ForegroundColor Gray
}

# Cleanup
Remove-Item "pkg-config.json" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Bundle process completed!" -ForegroundColor Green
