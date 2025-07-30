# Simple Windows Bundle Script
param([string]$OutputDir = "apartment-bundle")

Write-Host "Creating Windows Bundle..." -ForegroundColor Green

# Clean and create
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Build
Write-Host "Building application..." -ForegroundColor Yellow
bun install --frozen-lockfile
bunx prisma generate
bun run build

# Copy core files
Write-Host "Copying files..." -ForegroundColor Yellow
Copy-Item "build" -Destination "$OutputDir\build" -Recurse
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse
Copy-Item "package.json" -Destination "$OutputDir\package.json"
Copy-Item "bun.lockb" -Destination "$OutputDir\bun.lockb"

# Create .env template
Write-Host "Creating configuration..." -ForegroundColor Yellow
$envContent = "DATABASE_URL=file:./data/production.db`nJWT_SECRET=your-jwt-secret`nSESSION_SECRET=your-session-secret`nRESEND_API_KEY=your-api-key`nAPP_URL=http://localhost:3000`nNODE_ENV=production"
$envContent | Out-File -FilePath "$OutputDir\.env.template"

# Create deploy script
$deployContent = "Write-Host 'Deploying Apartment System' -ForegroundColor Green`nif (!(Test-Path '.env')) { Write-Host 'Copy .env.template to .env first'; exit 1 }`nbun install --production`nNew-Item -ItemType Directory -Force -Path 'data' | Out-Null`nbunx prisma migrate deploy`nWrite-Host 'Done! Run start.ps1'"
$deployContent | Out-File -FilePath "$OutputDir\deploy.ps1"

# Create start script  
$startContent = "Write-Host 'Starting server' -ForegroundColor Green`nif (!(Test-Path 'build')) { Write-Host 'Run deploy.ps1 first'; exit 1 }`nWrite-Host 'Open http://localhost:3000'`nbun start"
$startContent | Out-File -FilePath "$OutputDir\start.ps1"

# Create README
$readmeContent = "# Apartment Management - Windows Bundle`n`n## Quick Start`n1. Copy .env.template to .env`n2. Edit .env with your values`n3. Run deploy.ps1`n4. Run start.ps1`n5. Open http://localhost:3000`n`n## Admin Login`nEmail: admin@apartment.com`nPassword: admin123`n`nChange password after login!"
$readmeContent | Out-File -FilePath "$OutputDir\README.md"

# Create ZIP
$zipName = "apartment-windows-bundle.zip"
if (Test-Path $zipName) { Remove-Item $zipName }
Compress-Archive -Path "$OutputDir\*" -DestinationPath $zipName

Write-Host "Bundle created successfully!" -ForegroundColor Green
Write-Host "Folder: $OutputDir" -ForegroundColor White
Write-Host "ZIP: $zipName" -ForegroundColor White
Write-Host ""
Write-Host "To deploy:" -ForegroundColor Yellow
Write-Host "1. Extract ZIP on target machine" -ForegroundColor Gray
Write-Host "2. Copy .env.template to .env and edit" -ForegroundColor Gray  
Write-Host "3. Run deploy.ps1" -ForegroundColor Gray
Write-Host "4. Run start.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Requirements: Bun (from https://bun.sh)" -ForegroundColor Cyan
