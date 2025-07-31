# Apartment Management System - PKG Executable Bundle

## No Node.js Required!
This bundle contains a standalone executable that does NOT require Node.js installation.

## Quick Start
1. Copy .env.template to .env and edit with your settings
2. Run: .\deploy.ps1
3. Run: .\start.ps1 or .\apartment-management.exe
4. Open browser to: http://localhost:3000

## Default Admin Login
- Email: admin@apartment.com
- Password: admin123

**IMPORTANT: Change password after first login!**

## Features
- Complete apartment management system
- Real-time monitoring with duration displays
- Guest and booking management
- Payment tracking and analytics
- Email notifications
- Role-based access control
- Self-contained executable - no Node.js needed!

## Environment Configuration
Edit .env file with your specific settings:
- DATABASE_URL: SQLite database location
- JWT_SECRET: Change to a secure random string
- SESSION_SECRET: Change to a secure random string
- RESEND_API_KEY: For email notifications (optional)
- APP_URL: Your application URL
