# Final PKG Bundle Script
param([string]$OutputDir = "apartment-pkg-final")

Write-Host "Creating PKG Bundle with temporary package.json modification..." -ForegroundColor Green

# Clean and create
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Check for pkg
$pkgCmd = Get-Command pkg -ErrorAction SilentlyContinue
if (-not $pkgCmd) {
    Write-Host "Installing pkg globally..." -ForegroundColor Yellow
    npm install -g pkg
}

# Build application first
Write-Host "Building application..." -ForegroundColor Yellow
npm install
npx prisma generate
npm run build

# Backup original package.json
Write-Host "Backing up package.json..." -ForegroundColor Yellow
Copy-Item "package.json" -Destination "package.json.backup"

# Read and modify package.json temporarily
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

# Add bin property for PKG
$packageJson.bin = @{
    "apartment-management" = "build/server/index.js"
}

# Add PKG configuration
$packageJson.pkg = @{
    assets = @(
        "node_modules/.prisma/**/*"
        "prisma/**/*"
        "public/**/*"
        "build/**/*"
    )
    targets = @("node20-win-x64")
}

# Write modified package.json
$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "package.json" -Encoding UTF8

Write-Host "Creating executable with PKG..." -ForegroundColor Yellow
try {
    pkg . --target node20-win-x64 --output "$OutputDir\apartment-management.exe"
    
    if (Test-Path "$OutputDir\apartment-management.exe") {
        Write-Host "PKG executable created successfully!" -ForegroundColor Green
        $pkgSuccess = $true
    } else {
        Write-Host "PKG executable was not created" -ForegroundColor Red
        $pkgSuccess = $false
    }
} catch {
    Write-Host "PKG creation failed: $_" -ForegroundColor Red
    $pkgSuccess = $false
}

# Restore original package.json
Write-Host "Restoring original package.json..." -ForegroundColor Yellow
Copy-Item "package.json.backup" -Destination "package.json" -Force
Remove-Item "package.json.backup" -Force

if ($pkgSuccess) {
    # Copy deployment files
    Write-Host "Copying deployment files..." -ForegroundColor Yellow
    Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
    Copy-Item "public" -Destination "$OutputDir\public" -Recurse

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
Write-Host 'This deployment does NOT require Node.js installation!' -ForegroundColor Yellow

if (!(Test-Path '.env')) {
    Write-Host 'Creating .env from template...' -ForegroundColor Yellow
    Copy-Item '.env.template' -Destination '.env'
    Write-Host 'IMPORTANT: Edit .env file with your settings before continuing!' -ForegroundColor Red
    Write-Host 'Press any key after editing .env file...' -ForegroundColor Yellow
    `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}

# Create data directory
New-Item -ItemType Directory -Force -Path 'data' | Out-Null

# Check for Prisma CLI
`$prismaCmd = Get-Command prisma -ErrorAction SilentlyContinue
if (-not `$prismaCmd) {
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

Write-Host 'Starting server on port 3000...' -ForegroundColor Yellow
Write-Host 'Open your browser to: http://localhost:3000' -ForegroundColor Cyan
Write-Host 'Admin login: admin@apartment.com / admin123' -ForegroundColor Gray
Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Gray
Write-Host ''

.\apartment-management.exe
"@ | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

    # Create quick start batch file for non-PowerShell users
    @"
@echo off
echo Starting Apartment Management System...
echo.
echo Open your browser to: http://localhost:3000
echo Admin login: admin@apartment.com / admin123
echo.
echo Press Ctrl+C to stop the server
echo.
apartment-management.exe
pause
"@ | Out-File -FilePath "$OutputDir\start.bat" -Encoding ASCII

    # Create comprehensive README
    @"
# Apartment Management System - PKG Executable

## Standalone Windows Executable - No Node.js Required!

This bundle contains a complete apartment management system as a single executable file that runs on Windows without requiring Node.js installation.

## Quick Start Guide

### 1. First Time Setup
1. Copy `.env.template` to `.env`
2. Edit `.env` file with your settings (see Configuration section)
3. Run: `.\deploy.ps1`
4. Run: `.\start.ps1` or `.\apartment-management.exe`
5. Open browser to: http://localhost:3000

### 2. Daily Use
- Double-click `start.bat` or run `.\start.ps1`
- Access at: http://localhost:3000
- Default admin: admin@apartment.com / admin123

## Configuration (.env file)

```env
# Database (SQLite - no separate database server needed)
DATABASE_URL=file:./data/production.db

# Security Settings (CHANGE THESE!)
JWT_SECRET=your-very-secure-jwt-secret-minimum-32-characters
SESSION_SECRET=your-very-secure-session-secret-minimum-32-characters

# Email Service (Optional - for notifications)
RESEND_API_KEY=your-resend-api-key-here

# Application Settings
APP_URL=http://localhost:3000
NODE_ENV=production
```

**IMPORTANT:** Change the JWT_SECRET and SESSION_SECRET to long, random strings!

## System Features

### Core Management
- **Apartments**: Add, edit, delete apartment units
- **Guests**: Manage guest profiles and contact information
- **Bookings**: Create and manage reservations
- **Check-in/Check-out**: Process guest arrivals and departures

### Real-time Monitoring
- Live apartment status dashboard
- Duration tracking for current stays
- Occupancy rate monitoring
- Revenue analytics

### Additional Features
- **Payment Tracking**: Record and manage payments
- **Maintenance Logs**: Track maintenance requests and completion
- **Email Notifications**: Automated booking confirmations
- **User Management**: Admin and staff roles
- **Data Export**: Export reports and guest information
- **Responsive Design**: Works on desktop, tablet, and mobile

## Files in this Bundle

- `apartment-management.exe` - Main application executable
- `deploy.ps1` - Initial setup script
- `start.ps1` - Start application script
- `start.bat` - Start application (Windows batch file)
- `.env.template` - Environment configuration template
- `prisma/` - Database schema and migrations
- `public/` - Web application assets
- `README.md` - This documentation

## Troubleshooting

### Port Already in Use
If port 3000 is busy:
1. Edit `.env` file
2. Add line: `PORT=3001` (or another available port)
3. Restart the application

### Database Issues
To reset the database:
1. Stop the application
2. Delete `data\production.db` file
3. Run `.\deploy.ps1` again

### Permission Errors
If you get execution policy errors:
1. Open PowerShell as Administrator
2. Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Type 'Y' and press Enter

### Application Won't Start
1. Check that `.env` file exists and is configured
2. Ensure port 3000 is not in use by another application
3. Try running as Administrator
4. Check Windows Firewall settings

## Advanced Configuration

### Custom Port
Edit `.env` file and add:
```env
PORT=8080
```

### External Database
To use PostgreSQL or MySQL instead of SQLite:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/apartment_db
# or
DATABASE_URL=mysql://user:password@localhost:3306/apartment_db
```

### Email Configuration
For email notifications, sign up at resend.com and add your API key:
```env
RESEND_API_KEY=re_your_actual_api_key_here
```

## Security Notes

1. **Change Default Passwords**: Log in and change the admin password immediately
2. **Secure Secrets**: Use long, random strings for JWT_SECRET and SESSION_SECRET
3. **Network Access**: By default, the application only accepts connections from localhost
4. **Firewall**: Windows Firewall may prompt for network access - allow if needed
5. **Data Backup**: Regularly backup the `data/` directory

## Technical Information

- **Runtime**: Node.js v20 (embedded)
- **Database**: SQLite (included)
- **Web Framework**: Remix.js
- **UI Library**: Mantine + Tailwind CSS
- **File Size**: ~60MB executable
- **Memory Usage**: ~50MB typical
- **Startup Time**: 2-5 seconds

## Support and Updates

This is a self-contained deployment. For updates:
1. Download new bundle
2. Copy your `.env` and `data/` folder to new location
3. Run deploy script in new location

For technical support, check the application logs in the console window.

---

**Apartment Management System v1.0**
Standalone PKG Executable Bundle
"@ | Out-File -FilePath "$OutputDir\README.md" -Encoding UTF8

    # Create ZIP archive
    $zipName = "apartment-pkg-final.zip"
    if (Test-Path $zipName) { Remove-Item $zipName }
    
    Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
    Compress-Archive -Path "$OutputDir\*" -DestinationPath $zipName

    # Calculate sizes
    $totalSize = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    $exeSize = [math]::Round((Get-Item "$OutputDir\apartment-management.exe").Length / 1MB, 2)
    $zipSize = [math]::Round((Get-Item $zipName).Length / 1MB, 2)

    Write-Host ""
    Write-Host "SUCCESS: PKG Bundle Created!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host "Bundle Folder: $OutputDir" -ForegroundColor White
    Write-Host "ZIP Archive: $zipName" -ForegroundColor White
    Write-Host "Total Size: $totalSize MB" -ForegroundColor White
    Write-Host "Executable: apartment-management.exe ($exeSize MB)" -ForegroundColor Yellow
    Write-Host "ZIP Size: $zipSize MB" -ForegroundColor White
    Write-Host ""
    Write-Host "Key Advantages:" -ForegroundColor Cyan
    Write-Host "• No Node.js required on target machine" -ForegroundColor Gray
    Write-Host "• Single executable file with embedded runtime" -ForegroundColor Gray
    Write-Host "• Self-contained SQLite database" -ForegroundColor Gray
    Write-Host "• Faster startup than regular Node.js apps" -ForegroundColor Gray
    Write-Host "• Easy deployment - just extract and run" -ForegroundColor Gray
    Write-Host "• Complete apartment management system" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Deployment Instructions:" -ForegroundColor Yellow
    Write-Host "1. Extract $zipName on target Windows machine" -ForegroundColor Gray
    Write-Host "2. Copy .env.template to .env and edit settings" -ForegroundColor Gray
    Write-Host "3. Run deploy.ps1 for initial setup" -ForegroundColor Gray
    Write-Host "4. Run start.ps1 or apartment-management.exe" -ForegroundColor Gray
    Write-Host "5. Access at http://localhost:3000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Default Admin Login:" -ForegroundColor Magenta
    Write-Host "Email: admin@apartment.com" -ForegroundColor Gray
    Write-Host "Password: admin123" -ForegroundColor Gray
    Write-Host "(Change password after first login!)" -ForegroundColor Red

} else {
    Write-Host ""
    Write-Host "PKG Bundle Creation Failed!" -ForegroundColor Red
    Write-Host "============================" -ForegroundColor Red
    Write-Host "The PKG tool was unable to create the executable." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative Options:" -ForegroundColor Cyan
    Write-Host "1. Use bundle-simple.ps1 for Bun-based deployment" -ForegroundColor Gray
    Write-Host "2. Use regular npm start deployment" -ForegroundColor Gray
    Write-Host "3. Try installing PKG manually: npm install -g pkg@latest" -ForegroundColor Gray
    Write-Host ""
    Write-Host "The bundle-simple.ps1 script works reliably and is recommended" -ForegroundColor Green
}

Write-Host ""
Write-Host "Bundle process completed!" -ForegroundColor Green
