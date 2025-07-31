-- Database initialization script for PostgreSQL
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional databases if needed
-- CREATE DATABASE apartment_test;
-- CREATE DATABASE apartment_prod;

-- Create additional users if needed
-- CREATE USER apartment_user WITH PASSWORD 'apartment_password';
-- GRANT ALL PRIVILEGES ON DATABASE apartment_db TO apartment_user;

-- Enable useful PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Set default timezone
SET timezone = 'UTC';

-- Performance optimizations
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Log slow queries (optional for development)
ALTER SYSTEM SET log_min_duration_statement = '1000ms';
ALTER SYSTEM SET log_statement = 'all';

-- Restart PostgreSQL to apply system settings
-- (Docker will handle this automatically)

-- Create schema if needed (Prisma will handle this)
-- CREATE SCHEMA IF NOT EXISTS apartment;
