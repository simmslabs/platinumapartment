Write-Host 'PKG Apartment Management Deployment' -ForegroundColor Green
Write-Host 'This deployment does NOT require Node.js!' -ForegroundColor Yellow

if (!(Test-Path '.env')) {
    Write-Host 'Creating .env from template...' -ForegroundColor Yellow
    Copy-Item '.env.template' -Destination '.env'
    Write-Host 'Please edit .env with your settings' -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path 'data' | Out-Null

$prismaCmd = Get-Command prisma -ErrorAction SilentlyContinue
if (-not $prismaCmd) {
    Write-Host 'Installing Prisma CLI globally...' -ForegroundColor Yellow
    npm install -g prisma
}

Write-Host 'Setting up database...' -ForegroundColor Yellow
prisma migrate deploy

Write-Host 'Setup complete!' -ForegroundColor Green
Write-Host 'Run: .\start.ps1 or .\apartment-management.exe' -ForegroundColor Cyan
