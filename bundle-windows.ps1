# Windows Bundle Script for Apartment Management System
# Creates a production-ready bundle for deployment on Windows machines

param(
    [string]$OutputDir = "apartment-windows-bundle"
)

Write-Host "🏠 Creating Windows Bundle for Apartment Management..." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

# Clean and create output directory
if (Test-Path $OutputDir) {
    Write-Host "🧹 Cleaning previous bundle..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $OutputDir
}

Write-Host "📁 Creating bundle directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Build the application
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
bun install --frozen-lockfile

Write-Host "🔧 Generating Prisma client..." -ForegroundColor Yellow
bunx prisma generate

Write-Host "🏗️ Building application..." -ForegroundColor Yellow
bun run build

# Copy essential files
Write-Host "📂 Copying application files..." -ForegroundColor Yellow
Copy-Item "build" -Destination "$OutputDir\build" -Recurse
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse  
Copy-Item "public" -Destination "$OutputDir\public" -Recurse
Copy-Item "package.json" -Destination "$OutputDir\package.json"
Copy-Item "bun.lockb" -Destination "$OutputDir\bun.lockb"

# Copy additional files if they exist
$additionalFiles = @("README.md", "EMAIL_SETUP.md", "vite.config.ts", "tsconfig.json")
foreach ($file in $additionalFiles) {
    if (Test-Path $file) {
        Copy-Item $file -Destination "$OutputDir\" -ErrorAction SilentlyContinue
    }
}

# Create environment template
Write-Host "📝 Creating environment template..." -ForegroundColor Yellow
$envLines = @(
    "# Environment variables for Windows production deployment",
    "# Copy this file to .env and update the values",
    "",
    "# Database",
    "DATABASE_URL=file:./data/production.db",
    "",
    "# Authentication (CHANGE THESE IN PRODUCTION!)",
    "JWT_SECRET=your-jwt-secret-32-chars-minimum",
    "SESSION_SECRET=your-session-secret-32-chars-min",
    "",
    "# Email Service (Get your API key from https://resend.com)",
    "RESEND_API_KEY=your-resend-api-key-here",
    "",
    "# Application URL",
    "APP_URL=http://localhost:3000",
    "",
    "# Environment",
    "NODE_ENV=production"
)
$envLines | Out-File -FilePath "$OutputDir\.env.template" -Encoding UTF8

# Create Windows deployment script
Write-Host "📄 Creating deployment script..." -ForegroundColor Yellow
$deployLines = @(
    "# Windows Deployment Script for Apartment Management",
    "Write-Host 'Deploying Apartment Management System...' -ForegroundColor Green",
    "",
    "# Check if .env exists",
    "if (!(Test-Path '.env')) {",
    "    Write-Host 'ERROR: .env file not found!' -ForegroundColor Red",
    "    Write-Host 'Please copy .env.template to .env and configure it' -ForegroundColor Yellow",
    "    exit 1",
    "}",
    "",
    "# Install dependencies",
    "Write-Host 'Installing dependencies...' -ForegroundColor Yellow",
    "bun install --production --frozen-lockfile",
    "",
    "# Create data directory",
    "New-Item -ItemType Directory -Force -Path 'data' | Out-Null",
    "",
    "# Setup database",
    "Write-Host 'Setting up database...' -ForegroundColor Yellow", 
    "bunx prisma migrate deploy",
    "",
    "# Optional seeding",
    "Write-Host 'Do you want to seed the database with sample data? (y/N): ' -NoNewline -ForegroundColor Cyan",
    "`$seed = Read-Host",
    "if (`$seed -eq 'y' -or `$seed -eq 'Y') {",
    "    Write-Host 'Seeding database...' -ForegroundColor Yellow",
    "    bunx tsx prisma/seed.ts",
    "}",
    "",
    "Write-Host 'Deployment complete!' -ForegroundColor Green", 
    "Write-Host 'Start the application with: bun start' -ForegroundColor Cyan"
)
$deployLines | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8

# Create start script
Write-Host "🚀 Creating start script..." -ForegroundColor Yellow
$startLines = @(
    "# Start script for Apartment Management System",
    "Write-Host 'Starting Apartment Management System...' -ForegroundColor Green",
    "",
    "# Check if build exists",
    "if (!(Test-Path 'build')) {",
    "    Write-Host 'ERROR: Build directory not found!' -ForegroundColor Red",
    "    Write-Host 'Please run deploy.ps1 first' -ForegroundColor Yellow",
    "    exit 1",
    "}",
    "",
    "Write-Host 'Server starting on http://localhost:3000' -ForegroundColor Cyan",
    "bun start"
)
$startLines | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

# Create installation guide
Write-Host "📖 Creating installation guide..." -ForegroundColor Yellow
$guideLines = @(
    "# Apartment Management System - Windows Deployment",
    "",
    "This bundle contains everything needed to run the Apartment Management System on Windows.",
    "",
    "## Prerequisites",
    "",
    "- Bun >= 1.0.0 (Download from: https://bun.sh/)",
    "- Windows 10/11 or Windows Server 2019+",
    "- PowerShell 5.1+ (built into Windows)",
    "- 512MB+ RAM",
    "- 100MB+ disk space",
    "",
    "## Quick Installation",
    "",
    "1. **Extract this bundle** to your desired location",
    "",
    "2. **Configure environment**:",
    "   ```powershell",
    "   copy .env.template .env",
    "   notepad .env",
    "   ```",
    "   Update the values in .env (especially JWT_SECRET, SESSION_SECRET, and RESEND_API_KEY)",
    "",
    "3. **Deploy the application**:",
    "   ```powershell",
    "   .\deploy.ps1",
    "   ```",
    "",
    "4. **Start the application**:",
    "   ```powershell", 
    "   .\start.ps1",
    "   ```",
    "",
    "5. **Access the application**: http://localhost:3000",
    "",
    "## Default Admin Account",
    "",
    "- **Email**: admin@apartment.com",
    "- **Password**: admin123",
    "",
    "**⚠️ Important**: Change the admin password immediately after first login!",
    "",
    "## System Features",
    "",
    "- 🏠 Complete apartment booking management",
    "- 📊 Real-time monitoring dashboard with duration displays",
    "- 📧 Automated email notifications",
    "- 👥 Guest management with CRUD operations",
    "- 🔐 Role-based access control", 
    "- 📱 Responsive design for all devices",
    "",
    "## Troubleshooting",
    "",
    "**Port 3000 already in use?**",
    "```powershell",
    "netstat -ano | findstr :3000",
    "# Kill the process if needed",
    "taskkill /PID <process_id> /F",
    "```",
    "",
    "**Database issues?**",
    "```powershell",
    "# Reset database",
    "Remove-Item data\production.db -Force",
    "bunx prisma migrate deploy",
    "```",
    "",
    "**Need to stop the server?**",
    "Press `Ctrl+C` in the PowerShell window",
    "",
    "## Production Notes",
    "",
    "1. **Change all default secrets** in .env file",
    "2. **Set up reverse proxy** (IIS/nginx) for production",
    "3. **Configure firewall** to allow only necessary ports",
    "4. **Regular database backups** (copy data/production.db)",
    "5. **Monitor application logs** for issues",
    "",
    "## Support",
    "",
    "For issues, check the application logs and ensure all environment variables are correctly configured.",
    "",
    "---",
    "🏠 **Platinum Apartment Management System**",
    "Built with ❤️ using Remix.js and Mantine"
)
$guideLines | Out-File -FilePath "$OutputDir\WINDOWS_DEPLOYMENT.md" -Encoding UTF8

# Create bundle info
Write-Host "ℹ️ Creating bundle information..." -ForegroundColor Yellow
$bundleInfo = @{
    name = "Apartment Management System - Windows Bundle"
    version = "1.0.0"
    created = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    platform = "Windows"
    runtime = "Bun"
    size_mb = "Calculating..."
}
$bundleInfo | ConvertTo-Json | Out-File -FilePath "$OutputDir\bundle-info.json" -Encoding UTF8

# Calculate bundle size
$bundleSize = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

# Update bundle info with actual size
$bundleInfo.size_mb = "$bundleSize MB"
$bundleInfo | ConvertTo-Json | Out-File -FilePath "$OutputDir\bundle-info.json" -Encoding UTF8

# Create ZIP archive
Write-Host "📦 Creating ZIP archive..." -ForegroundColor Yellow
$archiveName = "apartment-management-windows-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force

# Summary
Write-Host "`n✅ Windows bundle created successfully!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "📁 Bundle directory: $OutputDir" -ForegroundColor White
Write-Host "📦 ZIP archive: $archiveName" -ForegroundColor White  
Write-Host "💾 Bundle size: $bundleSize MB" -ForegroundColor White
Write-Host ""
Write-Host "🚀 To deploy on target Windows machine:" -ForegroundColor Yellow
Write-Host "   1. Extract $archiveName" -ForegroundColor Gray
Write-Host "   2. Copy .env.template to .env and configure" -ForegroundColor Gray
Write-Host "   3. Run .\deploy.ps1" -ForegroundColor Gray
Write-Host "   4. Run .\start.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 See WINDOWS_DEPLOYMENT.md for detailed instructions" -ForegroundColor Cyan
Write-Host "🌐 Default URL: http://localhost:3000" -ForegroundColor Cyan
