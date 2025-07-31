# PostgreSQL Setup Guide

This guide will help you set up PostgreSQL for your apartment management system.

## Option 1: Local PostgreSQL Installation

### Windows (using PostgreSQL installer)
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Default port is usually 5432

### Windows (using Chocolatey)
```powershell
choco install postgresql
```

### macOS (using Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### After Installation
1. Create a database for your application:
```sql
-- Connect to PostgreSQL as postgres user
psql -U postgres

-- Create database
CREATE DATABASE apartment_db;

-- Create a new user (optional)
CREATE USER apartment_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE apartment_db TO apartment_user;

-- Exit psql
\q
```

2. Update your `.env` file with the correct credentials:
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/apartment_db?schema=public"
```

## Option 2: Docker PostgreSQL

### Using Docker Compose (Recommended for Development)
Create a `docker-compose.dev.yml` file:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: apartment_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

Update your `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/apartment_db?schema=public"
```

## Option 3: Cloud PostgreSQL

### Neon (Recommended for production)
1. Go to https://neon.tech/
2. Sign up and create a new project
3. Copy the connection string to your `.env` file

### Supabase
1. Go to https://supabase.com/
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string to your `.env` file

### Railway
1. Go to https://railway.app/
2. Create a new project
3. Add PostgreSQL service
4. Copy the connection string to your `.env` file

## Option 4: Prisma Postgres (Cloud)

Use Prisma's managed PostgreSQL service:

1. Install Prisma CLI globally:
```bash
npm install -g prisma
```

2. Login to Prisma:
```bash
prisma platform login
```

3. Create a new database:
```bash
prisma postgres create
```

4. Copy the connection string to your `.env` file

## Database Migration

After setting up PostgreSQL, run the following commands:

1. Generate Prisma client:
```bash
npm run db:generate
```

2. Create and apply migrations:
```bash
npm run db:migrate
```

3. (Optional) Seed the database:
```bash
npm run db:seed
```

## Verification

Test your connection:
```bash
npm run db:studio
```

This will open Prisma Studio in your browser to view your database.

## Troubleshooting

### Connection Issues
- Make sure PostgreSQL is running
- Check your credentials in the `.env` file
- Verify the database exists
- Check firewall settings for the PostgreSQL port (5432)

### Migration Issues
- If you have existing SQLite data, you'll need to export and import it
- Use `npm run db:reset` to start fresh (WARNING: This deletes all data)

### Performance Tips
- Create indexes for frequently queried fields
- Use connection pooling for production
- Monitor query performance with `EXPLAIN ANALYZE`

## Environment Variables Reference

```env
# Local PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"

# Cloud PostgreSQL with SSL
DATABASE_URL="postgresql://username:password@hostname:5432/database_name?sslmode=require"

# Prisma Postgres
DATABASE_URL="prisma://aws-us-east-1.prisma-data.com/?api_key=your-api-key"
```

## Next Steps

1. Set up your PostgreSQL database using one of the options above
2. Update your `.env` file with the correct `DATABASE_URL`
3. Run `npm run db:migrate` to create the database schema
4. Run `npm run db:seed` to populate initial data
5. Start your application with `npm run dev`
