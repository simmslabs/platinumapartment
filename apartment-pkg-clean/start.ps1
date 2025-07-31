Write-Host 'Starting Apartment Management System...' -ForegroundColor Green

if (!(Test-Path '.env')) {
    Write-Host 'Run deploy.ps1 first to set up the application' -ForegroundColor Red
    exit 1
}

Write-Host 'Starting server...' -ForegroundColor Yellow
Write-Host 'Open browser to: http://localhost:3000' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop server' -ForegroundColor Gray

.\apartment-management.exe
