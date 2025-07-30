# Node.js Alternative Deployment Script
# For environments where Bun is not available

param(
    [string]$OutputDir = "apartment-bundle-node",
    [switch]$Clean = $false
)

Write-Host "🏠 Creating Node.js Bundle for Apartment Management..." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan

if ($Clean -and (Test-Path $OutputDir)) {
    Write-Host "📦 Cleaning previous bundle..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $OutputDir
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Install dependencies with npm
Write-Host "📦 Installing dependencies with npm..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Generate Prisma client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

# Build application
Write-Host "🏗️ Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build application" -ForegroundColor Red
    exit 1
}

# Copy files
Write-Host "📁 Copying files..." -ForegroundColor Yellow
Copy-Item "build" -Destination "$OutputDir\build" -Recurse
Copy-Item "prisma" -Destination "$OutputDir\prisma" -Recurse
Copy-Item "public" -Destination "$OutputDir\public" -Recurse

# Create Node.js specific package.json
Write-Host "📄 Creating Node.js package.json..." -ForegroundColor Yellow
$nodePackage = @{
    name = "apartment-management"
    version = "1.0.0"
    type = "module"
    scripts = @{
        start = "node build/server/index.js"
        "db:migrate" = "prisma migrate deploy"
        "db:generate" = "prisma generate"
        "db:seed" = "node --loader tsx/esm prisma/seed.ts"
    }
    dependencies = @{
        "@prisma/client" = "^6.13.0"
        "@remix-run/node" = "*"
        "@remix-run/serve" = "*"
        "prisma" = "^6.13.0"
        "tsx" = "^4.20.3"
    }
    engines = @{
        node = ">=20.0.0"
    }
}

$nodePackage | ConvertTo-Json -Depth 10 | Out-File -FilePath "$OutputDir\package.json" -Encoding UTF8

# Create Node.js deployment script for Linux/macOS
Write-Host "📄 Creating deployment scripts..." -ForegroundColor Yellow
$bashScript = @'
#!/bin/bash
echo "🏠 Deploying Apartment Management (Node.js)..."

if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please copy .env.template to .env and configure it."
    exit 1
fi

echo "📦 Installing Node.js dependencies..."
npm install --production

mkdir -p data

echo "🗄️ Setting up database..."
npx prisma migrate deploy

echo "🌱 Seed database? (y/N)"
read -r seed
if [ "$seed" = "y" ] || [ "$seed" = "Y" ]; then
    npx tsx prisma/seed.ts
fi

echo "✅ Deployment complete!"
echo "🚀 Start with: npm start"
'@
$bashScript | Out-File -FilePath "$OutputDir\deploy-node.sh" -Encoding UTF8

# Create PowerShell deployment script
$powershellScript = @'
# PowerShell Node.js Deployment Script
Write-Host "🏠 Deploying Apartment Management (Node.js)..." -ForegroundColor Green

if (!(Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please copy .env.template to .env and configure it." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Yellow
npm install --production

New-Item -ItemType Directory -Force -Path "data" | Out-Null

Write-Host "🗄️ Setting up database..." -ForegroundColor Yellow
npx prisma migrate deploy

Write-Host "🌱 Seed database? (y/N)" -ForegroundColor Cyan
$seed = Read-Host
if ($seed -eq "y" -or $seed -eq "Y") {
    npx tsx prisma/seed.ts
}

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🚀 Start with: npm start" -ForegroundColor Cyan
'@
$powershellScript | Out-File -FilePath "$OutputDir\deploy-node.ps1" -Encoding UTF8

# Copy remaining files
Copy-Item ".env.template" -Destination "$OutputDir\.env.template" -ErrorAction SilentlyContinue
Copy-Item "README.md" -Destination "$OutputDir\README.md" -ErrorAction SilentlyContinue
Copy-Item "EMAIL_SETUP.md" -Destination "$OutputDir\EMAIL_SETUP.md" -ErrorAction SilentlyContinue

# Create Node.js README
$readmeContent = @'
# Apartment Management System - Node.js Deployment

This bundle is configured for Node.js environments.

## Requirements
- Node.js >= 20.0.0
- npm >= 9.0.0

## Quick Start

1. Configure environment:
   ```
   cp .env.template .env
   # Edit .env with your values
   ```

2. Deploy:
   ```bash
   # Linux/macOS
   chmod +x deploy-node.sh
   ./deploy-node.sh
   
   # Windows
   .\deploy-node.ps1
   ```

3. Start:
   ```bash
   npm start
   ```

## Commands

- `npm start` - Start the application
- `npx prisma migrate deploy` - Run database migrations
- `npx prisma generate` - Generate Prisma client
- `npx tsx prisma/seed.ts` - Seed database

The application will be available at http://localhost:3000
'@
$readmeContent | Out-File -FilePath "$OutputDir\README-NODE.md" -Encoding UTF8

Write-Host "`n✅ Node.js bundle created successfully!" -ForegroundColor Green
Write-Host "📁 Location: $OutputDir" -ForegroundColor White
Write-Host "📖 See README-NODE.md for deployment instructions" -ForegroundColor Cyan
