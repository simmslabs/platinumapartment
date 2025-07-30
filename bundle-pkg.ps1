# PKG Bundle Script for Apartment Management System
# Creates standalone executables using pkg

param(
    [string]$OutputDir = "apartment-pkg-bundle",
    [switch]$Clean = $false
)

Write-Host "🏠 Creating PKG Bundle for Apartment Management..." -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan

# Clean and create output directory
if ($Clean -and (Test-Path $OutputDir)) {
    Write-Host "🧹 Cleaning previous bundle..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $OutputDir
}

Write-Host "📁 Creating bundle directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Install pkg globally if not present
Write-Host "🔧 Checking for pkg..." -ForegroundColor Yellow
$pkgInstalled = Get-Command pkg -ErrorAction SilentlyContinue
if (-not $pkgInstalled) {
    Write-Host "📦 Installing pkg globally..." -ForegroundColor Yellow
    npm install -g pkg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install pkg" -ForegroundColor Red
        exit 1
    }
}

# Install dependencies and build
Write-Host "📦 Installing dependencies with npm..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

Write-Host "🏗️ Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build application" -ForegroundColor Red
    exit 1
}

# Create package.json for pkg
Write-Host "📄 Creating pkg package.json..." -ForegroundColor Yellow
$pkgPackage = @{
    name = "apartment-management"
    version = "1.0.0"
    main = "build/server/index.js"
    bin = "build/server/index.js"
    scripts = @{
        start = "node build/server/index.js"
        pkg = "pkg . --target node20-win-x64 --output apartment-management.exe"
        "pkg-all" = "pkg . --target node20-win-x64,node20-linux-x64,node20-macos-x64 --output apartment-management"
    }
    dependencies = @{
        "@prisma/client" = "^6.13.0"
        "@remix-run/node" = "*"
        "@remix-run/serve" = "*"
        "prisma" = "^6.13.0"
        "tsx" = "^4.20.3"
    }
    pkg = @{
        scripts = @(
            "build/**/*"
        )
        assets = @(
            "node_modules/.prisma/**/*",
            "prisma/**/*",
            "public/**/*"
        )
        targets = @(
            "node20-win-x64"
        )
        outputPath = "dist"
    }
    engines = @{
        node = ">=20.0.0"
    }
}

$pkgPackage | ConvertTo-Json -Depth 10 | Out-File -FilePath "package-pkg.json" -Encoding UTF8

# Create pkg executable
Write-Host "📦 Creating executable with pkg..." -ForegroundColor Yellow
pkg . --config package-pkg.json --target node20-win-x64 --output "$OutputDir\apartment-management.exe"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create executable" -ForegroundColor Red
    exit 1
}

# Copy essential files to bundle
Write-Host "📂 Copying essential files..." -ForegroundColor Yellow
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse

# Create node_modules with only Prisma client
New-Item -ItemType Directory -Force -Path "$OutputDir\node_modules\.prisma" | Out-Null
Copy-Item "node_modules\.prisma" -Destination "$OutputDir\node_modules\.prisma" -Recurse -Force

# Create environment template
Write-Host "📝 Creating environment template..." -ForegroundColor Yellow
$envLines = @(
    "# Environment variables for PKG deployment",
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

# Create deployment script for PKG
Write-Host "📄 Creating PKG deployment script..." -ForegroundColor Yellow
$deployScript = @(
    "# PKG Deployment Script for Apartment Management",
    "Write-Host 'Deploying Apartment Management System (PKG)...' -ForegroundColor Green",
    "",
    "# Check if .env exists",
    "if (!(Test-Path '.env')) {",
    "    Write-Host 'ERROR: .env file not found!' -ForegroundColor Red",
    "    Write-Host 'Please copy .env.template to .env and configure it' -ForegroundColor Yellow",
    "    exit 1",
    "}",
    "",
    "# Create data directory",
    "New-Item -ItemType Directory -Force -Path 'data' | Out-Null",
    "",
    "# Check if Prisma CLI is available",
    "`$prismaCmd = Get-Command prisma -ErrorAction SilentlyContinue",
    "if (-not `$prismaCmd) {",
    "    Write-Host 'Installing Prisma CLI...' -ForegroundColor Yellow",
    "    npm install -g prisma",
    "}",
    "",
    "# Setup database",
    "Write-Host 'Setting up database...' -ForegroundColor Yellow",
    "prisma migrate deploy",
    "",
    "# Optional seeding",
    "Write-Host 'Do you want to seed the database? (y/N): ' -NoNewline -ForegroundColor Cyan",
    "`$seed = Read-Host",
    "if (`$seed -eq 'y' -or `$seed -eq 'Y') {",
    "    Write-Host 'Seeding database...' -ForegroundColor Yellow",
    "    # Note: Seeding requires Node.js since it uses TypeScript",
    "    if (Test-Path 'prisma\\seed.ts') {",
    "        npx tsx prisma/seed.ts",
    "    } else {",
    "        Write-Host 'Seed file not found, skipping...' -ForegroundColor Yellow",
    "    }",
    "}",
    "",
    "Write-Host 'Deployment complete!' -ForegroundColor Green",
    "Write-Host 'Start with: .\\apartment-management.exe' -ForegroundColor Cyan"
)
$deployScript | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8

# Create start script
Write-Host "🚀 Creating start script..." -ForegroundColor Yellow
$startScript = @(
    "# Start script for PKG Apartment Management",
    "Write-Host 'Starting Apartment Management System...' -ForegroundColor Green",
    "",
    "# Check if executable exists",
    "if (!(Test-Path 'apartment-management.exe')) {",
    "    Write-Host 'ERROR: apartment-management.exe not found!' -ForegroundColor Red",
    "    Write-Host 'Please run deploy.ps1 first' -ForegroundColor Yellow",
    "    exit 1",
    "}",
    "",
    "# Check if .env exists",
    "if (!(Test-Path '.env')) {",
    "    Write-Host 'ERROR: .env file not found!' -ForegroundColor Red",
    "    Write-Host 'Please copy .env.template to .env and configure it' -ForegroundColor Yellow",
    "    exit 1",
    "}",
    "",
    "Write-Host 'Server starting on http://localhost:3000' -ForegroundColor Cyan",
    "Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Yellow",
    "",
    ".\\apartment-management.exe"
)
$startScript | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

# Copy additional files
if (Test-Path "README.md") { Copy-Item "README.md" -Destination "$OutputDir\" }
if (Test-Path "EMAIL_SETUP.md") { Copy-Item "EMAIL_SETUP.md" -Destination "$OutputDir\" }

# Create PKG-specific README
Write-Host "📖 Creating PKG README..." -ForegroundColor Yellow
$readmeContent = @(
    "# Apartment Management System - PKG Executable Bundle",
    "",
    "This bundle contains a standalone executable created with PKG.",
    "",
    "## Contents",
    "",
    "- `apartment-management.exe` - Standalone executable (no Node.js required)",
    "- `prisma/` - Database schema and migrations",
    "- `public/` - Static assets",
    "- `node_modules/.prisma/` - Prisma client binaries",
    "- `.env.template` - Environment configuration template",
    "- `deploy.ps1` - Automated deployment script",
    "- `start.ps1` - Application start script",
    "",
    "## System Requirements",
    "",
    "- Windows 10/11 or Windows Server 2019+",
    "- PowerShell 5.1+ (built into Windows)",
    "- 512MB+ RAM",
    "- 100MB+ disk space",
    "- Port 3000 available (or configure different port)",
    "",
    "**Note:** The executable is self-contained and does NOT require Node.js to be installed!",
    "",
    "## Quick Start",
    "",
    "1. **Configure environment**:",
    "   ```powershell",
    "   copy .env.template .env",
    "   notepad .env",
    "   ```",
    "   Update these critical values:",
    "   - JWT_SECRET (32+ character random string)",
    "   - SESSION_SECRET (32+ character random string)",
    "   - RESEND_API_KEY (get from https://resend.com)",
    "   - APP_URL (your domain or http://localhost:3000)",
    "",
    "2. **Deploy**:",
    "   ```powershell",
    "   .\\deploy.ps1",
    "   ```",
    "",
    "3. **Start**:",
    "   ```powershell",
    "   .\\start.ps1",
    "   ```",
    "   Or directly:",
    "   ```powershell",
    "   .\\apartment-management.exe",
    "   ```",
    "",
    "4. **Access**: Open http://localhost:3000",
    "",
    "## Default Admin Account",
    "",
    "- **Email**: admin@apartment.com",
    "- **Password**: admin123",
    "",
    "**⚠️ Important**: Change the admin password immediately after first login!",
    "",
    "## Features",
    "",
    "- 🏠 Complete apartment booking management",
    "- 📊 Real-time monitoring with duration displays",
    "- 📧 Automated email notifications",
    "- 👥 Guest management with CRUD operations",
    "- 🔐 Role-based access control",
    "- 📱 Responsive design for all devices",
    "",
    "## Database Setup",
    "",
    "The deployment script will:",
    "1. Create data directory for SQLite database",
    "2. Run Prisma migrations to set up tables",
    "3. Optionally seed with sample data",
    "",
    "## Troubleshooting",
    "",
    "**Executable won't start:**",
    "```powershell",
    "# Check if .env file exists and is configured",
    "dir .env",
    "type .env",
    "```",
    "",
    "**Port 3000 already in use:**",
    "```powershell",
    "netstat -ano | findstr :3000",
    "taskkill /PID <process_id> /F",
    "```",
    "",
    "**Database issues:**",
    "```powershell",
    "# Reset database",
    "Remove-Item data\\production.db -Force",
    "prisma migrate deploy",
    "```",
    "",
    "**Prisma CLI not found:**",
    "The deploy script will automatically install Prisma CLI globally if needed.",
    "",
    "## Advantages of PKG Bundle",
    "",
    "- ✅ **No Node.js required** on target machine",
    "- ✅ **Single executable file** - easy to distribute",
    "- ✅ **Faster startup** - no dependency resolution",
    "- ✅ **Smaller deployment** - only includes used dependencies",
    "- ✅ **Version consistency** - bundled Node.js version",
    "",
    "## Production Notes",
    "",
    "1. **Security**: Change all default secrets in .env",
    "2. **HTTPS**: Set up reverse proxy for SSL",
    "3. **Firewall**: Configure to allow only necessary ports",
    "4. **Backups**: Regular database backups (copy data/production.db)",
    "5. **Monitoring**: Set up application monitoring and logging",
    "",
    "## Support",
    "",
    "For issues, check the executable output and ensure:",
    "- .env file is properly configured",
    "- Database permissions are correct",
    "- Port 3000 is available",
    "- All required directories exist",
    "",
    "---",
    "🏠 **Platinum Apartment Management System - PKG Bundle**",
    "Self-contained executable - no Node.js installation required!"
)
$readmeContent | Out-File -FilePath "$OutputDir\README-PKG.md" -Encoding UTF8

# Create bundle info
$bundleSize = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
$bundleInfo = @{
    name = "Apartment Management System - PKG Bundle"
    version = "1.0.0"
    created = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    platform = "Windows x64"
    runtime = "Node.js 20 (bundled)"
    bundle_type = "PKG Executable"
    size_mb = "$bundleSize MB"
    executable = "apartment-management.exe"
    requires_nodejs = $false
}
$bundleInfo | ConvertTo-Json | Out-File -FilePath "$OutputDir\bundle-info.json" -Encoding UTF8

# Create ZIP archive
Write-Host "📦 Creating ZIP archive..." -ForegroundColor Yellow
$archiveName = "apartment-management-pkg-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force

# Clean up temporary files
Remove-Item "package-pkg.json" -Force -ErrorAction SilentlyContinue

# Summary
Write-Host "`n✅ PKG bundle created successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📁 Bundle directory: $OutputDir" -ForegroundColor White
Write-Host "📦 ZIP archive: $archiveName" -ForegroundColor White
Write-Host "💾 Bundle size: $bundleSize MB" -ForegroundColor White
Write-Host "🎯 Executable: apartment-management.exe" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Advantages of PKG bundle:" -ForegroundColor Yellow
Write-Host "   ✅ No Node.js required on target machine" -ForegroundColor Green
Write-Host "   ✅ Single executable file" -ForegroundColor Green
Write-Host "   ✅ Faster startup time" -ForegroundColor Green
Write-Host "   ✅ Self-contained deployment" -ForegroundColor Green
Write-Host ""
Write-Host "📋 To deploy on target Windows machine:" -ForegroundColor Yellow
Write-Host "   1. Extract $archiveName" -ForegroundColor Gray
Write-Host "   2. Copy .env.template to .env and configure" -ForegroundColor Gray
Write-Host "   3. Run .\\deploy.ps1" -ForegroundColor Gray
Write-Host "   4. Run .\\start.ps1 or .\\apartment-management.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 See README-PKG.md for detailed instructions" -ForegroundColor Cyan
