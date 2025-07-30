# PowerShell script to bundle the Remix.js Apartment Management application for deployment
# This script creates a production-ready bundle for deployment on a different machine

param(
    [string]$OutputDir = "apartment-bundle",
    [switch]$IncludeSource = $false,
    [switch]$Clean = $false
)

Write-Host "🏠 Bundling Apartment Management Application..." -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan

# Function to show progress
function Write-Progress-Step {
    param([string]$Step, [string]$Color = "Yellow")
    Write-Host "📦 $Step" -ForegroundColor $Color
}

# Clean previous bundle if requested
if ($Clean -and (Test-Path $OutputDir)) {
    Write-Progress-Step "Cleaning previous bundle..."
    Remove-Item -Recurse -Force $OutputDir
}

# Create output directory
Write-Progress-Step "Creating bundle directory: $OutputDir"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

try {
    # Step 1: Install dependencies
    Write-Progress-Step "Installing production dependencies..."
    bun install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "Failed to install dependencies" }

    # Step 2: Generate Prisma client
    Write-Progress-Step "Generating Prisma client..."
    bunx prisma generate
    if ($LASTEXITCODE -ne 0) { throw "Failed to generate Prisma client" }

    # Step 3: Build the application
    Write-Progress-Step "Building application for production..."
    bun run build
    if ($LASTEXITCODE -ne 0) { throw "Failed to build application" }

    # Step 4: Copy essential files
    Write-Progress-Step "Copying essential files..."
    
    # Core application files
    Copy-Item "build" -Destination "$OutputDir\build" -Recurse
    Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
    Copy-Item "public" -Destination "$OutputDir\public" -Recurse
    Copy-Item "package.json" -Destination "$OutputDir\package.json"
    Copy-Item "bun.lockb" -Destination "$OutputDir\bun.lockb"
    
    # Configuration files
    if (Test-Path "vite.config.ts") { Copy-Item "vite.config.ts" -Destination "$OutputDir\vite.config.ts" }
    if (Test-Path "tsconfig.json") { Copy-Item "tsconfig.json" -Destination "$OutputDir\tsconfig.json" }
    if (Test-Path "tailwind.config.ts") { Copy-Item "tailwind.config.ts" -Destination "$OutputDir\tailwind.config.ts" }
    if (Test-Path "postcss.config.js") { Copy-Item "postcss.config.js" -Destination "$OutputDir\postcss.config.js" }

    # Documentation
    if (Test-Path "README.md") { Copy-Item "README.md" -Destination "$OutputDir\README.md" }
    if (Test-Path "EMAIL_SETUP.md") { Copy-Item "EMAIL_SETUP.md" -Destination "$OutputDir\EMAIL_SETUP.md" }

    # Copy source code if requested
    if ($IncludeSource) {
        Write-Progress-Step "Including source code..."
        Copy-Item "app" -Destination "$OutputDir\app" -Recurse
    }

    # Step 5: Create environment template
    Write-Progress-Step "Creating environment template..."
    @"
# Environment variables for production deployment
# Copy this file to .env and update the values

# Database
DATABASE_URL="file:./data/production.db"

# Authentication (CHANGE THESE IN PRODUCTION!)
JWT_SECRET="$((-join ((65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})))"
SESSION_SECRET="$((-join ((65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})))"

# Email Service (Get your API key from https://resend.com)
RESEND_API_KEY="your-resend-api-key-here"

# Application URL (Update to your domain)
APP_URL="http://localhost:3000"

# Node Environment
NODE_ENV="production"
"@ | Out-File -FilePath "$OutputDir\.env.template" -Encoding UTF8

    # Step 6: Create deployment scripts
    Write-Progress-Step "Creating deployment scripts..."

    # PowerShell deployment script
    @"
# PowerShell Deployment Script for Apartment Management System
Write-Host "🏠 Deploying Apartment Management System..." -ForegroundColor Green

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please copy .env.template to .env and configure it." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
bun install --production --frozen-lockfile

# Create data directory for database
New-Item -ItemType Directory -Force -Path "data" | Out-Null

# Run database migrations
Write-Host "🗄️ Setting up database..." -ForegroundColor Yellow
bunx prisma migrate deploy

# Seed database (optional)
Write-Host "🌱 Do you want to seed the database with sample data? (y/N)" -ForegroundColor Cyan
`$seed = Read-Host
if (`$seed -eq "y" -or `$seed -eq "Y") {
    bunx tsx prisma/seed.ts
}

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🚀 Start the application with: bun start" -ForegroundColor Cyan
Write-Host "🌐 The application will be available at the URL specified in your .env file" -ForegroundColor Cyan
"@ | Out-File -FilePath "$OutputDir\deploy.ps1" -Encoding UTF8

    # Bash deployment script
    @"
#!/bin/bash
# Bash Deployment Script for Apartment Management System
echo "🏠 Deploying Apartment Management System..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please copy .env.template to .env and configure it."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
bun install --production --frozen-lockfile

# Create data directory for database
mkdir -p data

# Run database migrations
echo "🗄️ Setting up database..."
bunx prisma migrate deploy

# Seed database (optional)
echo "🌱 Do you want to seed the database with sample data? (y/N)"
read -r seed
if [ "`$seed" = "y" ] || [ "`$seed" = "Y" ]; then
    bunx tsx prisma/seed.ts
fi

echo "✅ Deployment complete!"
echo "🚀 Start the application with: bun start"
echo "🌐 The application will be available at the URL specified in your .env file"
"@ | Out-File -FilePath "$OutputDir\deploy.sh" -Encoding UTF8

    # Step 7: Create start script
    @"
# Start script for Apartment Management System
Write-Host "🚀 Starting Apartment Management System..." -ForegroundColor Green

# Check if build exists
if (!(Test-Path "build")) {
    Write-Host "❌ Build directory not found. Please run deployment first." -ForegroundColor Red
    exit 1
}

# Start the application
Write-Host "🌐 Starting server on port 3000..." -ForegroundColor Yellow
bun start
"@ | Out-File -FilePath "$OutputDir\start.ps1" -Encoding UTF8

    # Step 8: Create package.json for production
    Write-Progress-Step "Creating production package.json..."
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    # Remove dev dependencies and scripts we don't need in production
    $productionPackage = @{
        name = $packageJson.name
        private = $packageJson.private
        sideEffects = $packageJson.sideEffects
        type = $packageJson.type
        scripts = @{
            start = $packageJson.scripts.start
            "db:migrate" = $packageJson.scripts."db:migrate"
            "db:generate" = $packageJson.scripts."db:generate"
            "db:seed" = $packageJson.scripts."db:seed"
        }
        dependencies = $packageJson.dependencies
        engines = $packageJson.engines
    }
    
    $productionPackage | ConvertTo-Json -Depth 10 | Out-File -FilePath "$OutputDir\package.json" -Encoding UTF8

    # Step 9: Create README for deployment
    Write-Progress-Step "Creating deployment README..."
    @"
# Apartment Management System - Production Deployment

This bundle contains a production-ready version of the Apartment Management System.

## Quick Start

1. **Configure Environment**
   ```bash
   cp .env.template .env
   # Edit .env with your production values
   ```

2. **Deploy the Application**
   
   **Windows (PowerShell):**
   ```powershell
   .\deploy.ps1
   ```
   
   **Linux/macOS:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Start the Application**
   ```bash
   bun start
   ```
   
   Or use the start script:
   ```powershell
   .\start.ps1
   ```

## System Requirements

- **Runtime**: Bun >= 1.0.0 (or Node.js >= 20.0.0)
- **Database**: SQLite (included)
- **Memory**: Minimum 512MB RAM
- **Storage**: Minimum 100MB free space

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite database path | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `SESSION_SECRET` | Session encryption secret | Yes |
| `RESEND_API_KEY` | Email service API key | Yes |
| `APP_URL` | Application base URL | Yes |
| `NODE_ENV` | Environment (production) | Optional |

## Features

- 🏠 **Apartment Management**: Complete booking and guest management
- 📊 **Real-time Monitoring**: Checkout tracking and alerts
- 📧 **Email Automation**: Welcome emails and notifications
- 🔐 **Role-based Access**: Secure user authentication
- 📱 **Responsive Design**: Works on all devices
- ⚡ **High Performance**: Built with Remix.js and Mantine

## Default Admin Account

After deployment and seeding:
- **Email**: admin@apartment.com
- **Password**: admin123

**⚠️ Change the admin password immediately after first login!**

## Support

For issues and questions, refer to the original repository or documentation.

## Security Notes

1. **Change all default secrets** in the .env file
2. **Set up HTTPS** in production
3. **Configure firewall** to restrict database access
4. **Regular backups** of the SQLite database
5. **Update dependencies** regularly

---

🏠 **Platinum Apartment Management System**
Built with ❤️ using Remix.js and Mantine
"@ | Out-File -FilePath "$OutputDir\DEPLOYMENT.md" -Encoding UTF8

    # Step 10: Create bundle info
    $bundleInfo = @{
        name = "Apartment Management System"
        version = "1.0.0"
        bundled_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss UTC")
        node_version = node --version
        bun_version = bun --version
        platform = $env:OS
        includes_source = $IncludeSource
        size_mb = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    }
    
    $bundleInfo | ConvertTo-Json -Depth 10 | Out-File -FilePath "$OutputDir\bundle-info.json" -Encoding UTF8

    # Step 11: Create archive
    Write-Progress-Step "Creating deployment archive..."
    $archiveName = "apartment-management-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
    Compress-Archive -Path "$OutputDir\*" -DestinationPath $archiveName -Force

    # Summary
    Write-Host "`n✅ Bundle created successfully!" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "📁 Bundle directory: $OutputDir" -ForegroundColor White
    Write-Host "📦 Archive created: $archiveName" -ForegroundColor White
    Write-Host "💾 Bundle size: $($bundleInfo.size_mb) MB" -ForegroundColor White
    Write-Host "`n🚀 To deploy on target machine:" -ForegroundColor Yellow
    Write-Host "   1. Extract the archive" -ForegroundColor Gray
    Write-Host "   2. Copy .env.template to .env and configure" -ForegroundColor Gray
    Write-Host "   3. Run .\deploy.ps1 (Windows) or ./deploy.sh (Linux/Mac)" -ForegroundColor Gray
    Write-Host "   4. Start with 'bun start' or .\start.ps1" -ForegroundColor Gray
    Write-Host "`n📖 See DEPLOYMENT.md for detailed instructions" -ForegroundColor Cyan

} catch {
    Write-Host "`n❌ Bundle creation failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
