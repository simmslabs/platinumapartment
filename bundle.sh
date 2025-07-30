#!/bin/bash
# Bash script to bundle the Remix.js Apartment Management application for deployment
# This script creates a production-ready bundle for deployment on a different machine

set -e  # Exit on any error

# Default values
OUTPUT_DIR="apartment-bundle"
INCLUDE_SOURCE=false
CLEAN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --include-source)
            INCLUDE_SOURCE=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --output-dir DIR     Output directory (default: apartment-bundle)"
            echo "  --include-source     Include source code in bundle"
            echo "  --clean             Clean previous bundle"
            echo "  -h, --help          Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🏠 Bundling Apartment Management Application..."
echo "====================================================="

# Function to show progress
progress_step() {
    echo "📦 $1"
}

# Clean previous bundle if requested
if [ "$CLEAN" = true ] && [ -d "$OUTPUT_DIR" ]; then
    progress_step "Cleaning previous bundle..."
    rm -rf "$OUTPUT_DIR"
fi

# Create output directory
progress_step "Creating bundle directory: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Step 1: Install dependencies
progress_step "Installing production dependencies..."
bun install --frozen-lockfile

# Step 2: Generate Prisma client
progress_step "Generating Prisma client..."
bunx prisma generate

# Step 3: Build the application
progress_step "Building application for production..."
bun run build

# Step 4: Copy essential files
progress_step "Copying essential files..."

# Core application files
cp -r build "$OUTPUT_DIR/"
cp -r prisma "$OUTPUT_DIR/"
cp -r public "$OUTPUT_DIR/"
cp package.json "$OUTPUT_DIR/"
cp bun.lockb "$OUTPUT_DIR/"

# Configuration files
[ -f vite.config.ts ] && cp vite.config.ts "$OUTPUT_DIR/"
[ -f tsconfig.json ] && cp tsconfig.json "$OUTPUT_DIR/"
[ -f tailwind.config.ts ] && cp tailwind.config.ts "$OUTPUT_DIR/"
[ -f postcss.config.js ] && cp postcss.config.js "$OUTPUT_DIR/"

# Documentation
[ -f README.md ] && cp README.md "$OUTPUT_DIR/"
[ -f EMAIL_SETUP.md ] && cp EMAIL_SETUP.md "$OUTPUT_DIR/"

# Copy source code if requested
if [ "$INCLUDE_SOURCE" = true ]; then
    progress_step "Including source code..."
    cp -r app "$OUTPUT_DIR/"
fi

# Step 5: Create environment template
progress_step "Creating environment template..."
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

cat > "$OUTPUT_DIR/.env.template" << EOF
# Environment variables for production deployment
# Copy this file to .env and update the values

# Database
DATABASE_URL="file:./data/production.db"

# Authentication (CHANGE THESE IN PRODUCTION!)
JWT_SECRET="$JWT_SECRET"
SESSION_SECRET="$SESSION_SECRET"

# Email Service (Get your API key from https://resend.com)
RESEND_API_KEY="your-resend-api-key-here"

# Application URL (Update to your domain)
APP_URL="http://localhost:3000"

# Node Environment
NODE_ENV="production"
EOF

# Step 6: Create deployment scripts
progress_step "Creating deployment scripts..."

# Bash deployment script
cat > "$OUTPUT_DIR/deploy.sh" << 'EOF'
#!/bin/bash
# Bash Deployment Script for Apartment Management System
set -e

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
if [ "$seed" = "y" ] || [ "$seed" = "Y" ]; then
    bunx tsx prisma/seed.ts
fi

echo "✅ Deployment complete!"
echo "🚀 Start the application with: bun start"
echo "🌐 The application will be available at the URL specified in your .env file"
EOF

chmod +x "$OUTPUT_DIR/deploy.sh"

# PowerShell deployment script
cat > "$OUTPUT_DIR/deploy.ps1" << 'EOF'
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
$seed = Read-Host
if ($seed -eq "y" -or $seed -eq "Y") {
    bunx tsx prisma/seed.ts
}

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🚀 Start the application with: bun start" -ForegroundColor Cyan
Write-Host "🌐 The application will be available at the URL specified in your .env file" -ForegroundColor Cyan
EOF

# Step 7: Create start scripts
cat > "$OUTPUT_DIR/start.sh" << 'EOF'
#!/bin/bash
# Start script for Apartment Management System
echo "🚀 Starting Apartment Management System..."

# Check if build exists
if [ ! -d "build" ]; then
    echo "❌ Build directory not found. Please run deployment first."
    exit 1
fi

# Start the application
echo "🌐 Starting server on port 3000..."
bun start
EOF

chmod +x "$OUTPUT_DIR/start.sh"

cat > "$OUTPUT_DIR/start.ps1" << 'EOF'
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
EOF

# Step 8: Create production package.json
progress_step "Creating production package.json..."
node -e "
const pkg = require('./package.json');
const production = {
    name: pkg.name,
    private: pkg.private,
    sideEffects: pkg.sideEffects,
    type: pkg.type,
    scripts: {
        start: pkg.scripts.start,
        'db:migrate': pkg.scripts['db:migrate'],
        'db:generate': pkg.scripts['db:generate'],
        'db:seed': pkg.scripts['db:seed']
    },
    dependencies: pkg.dependencies,
    engines: pkg.engines
};
require('fs').writeFileSync('$OUTPUT_DIR/package.json', JSON.stringify(production, null, 2));
"

# Step 9: Create deployment README
progress_step "Creating deployment README..."
cat > "$OUTPUT_DIR/DEPLOYMENT.md" << 'EOF'
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
   ```bash
   ./start.sh        # Linux/macOS
   .\start.ps1       # Windows
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
EOF

# Step 10: Create bundle info
progress_step "Creating bundle info..."
BUNDLE_SIZE=$(du -sm "$OUTPUT_DIR" | cut -f1)

cat > "$OUTPUT_DIR/bundle-info.json" << EOF
{
  "name": "Apartment Management System",
  "version": "1.0.0",
  "bundled_at": "$(date -u '+%Y-%m-%d %H:%M:%S UTC')",
  "node_version": "$(node --version 2>/dev/null || echo 'not available')",
  "bun_version": "$(bun --version 2>/dev/null || echo 'not available')",
  "platform": "$(uname -s)",
  "includes_source": $INCLUDE_SOURCE,
  "size_mb": $BUNDLE_SIZE
}
EOF

# Step 11: Create archive
progress_step "Creating deployment archive..."
ARCHIVE_NAME="apartment-management-$(date '+%Y%m%d-%H%M%S').tar.gz"
tar -czf "$ARCHIVE_NAME" -C "$OUTPUT_DIR" .

# Summary
echo ""
echo "✅ Bundle created successfully!"
echo "====================================================="
echo "📁 Bundle directory: $OUTPUT_DIR"
echo "📦 Archive created: $ARCHIVE_NAME"
echo "💾 Bundle size: ${BUNDLE_SIZE}MB"
echo ""
echo "🚀 To deploy on target machine:"
echo "   1. Extract the archive"
echo "   2. Copy .env.template to .env and configure"
echo "   3. Run ./deploy.sh (Linux/Mac) or .\deploy.ps1 (Windows)"
echo "   4. Start with 'bun start' or ./start.sh"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
