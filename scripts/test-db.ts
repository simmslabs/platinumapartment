import { db } from "~/utils/db.server";

async function testConnection() {
  try {
    console.log("Testing PostgreSQL connection...");
    
    // Test basic connection
    await db.$connect();
    console.log("✅ Connected to PostgreSQL successfully!");
    
    // Test a simple query
    const result = await db.$queryRaw`SELECT NOW() as current_time, version() as postgres_version`;
    console.log("✅ Database query successful:");
    console.log(result);
    
    // Check if tables exist
    const tables = await db.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log("✅ Available tables:", tables);
    
    // Test Prisma client
    const userCount = await db.user.count();
    console.log(`✅ Found ${userCount} users in the database`);
    
    console.log("🎉 All database tests passed!");
    
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error);
    
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        console.log("\n💡 Make sure PostgreSQL is running:");
        console.log("   - If using Docker: docker-compose -f docker-compose.dev.yml up postgres -d");
        console.log("   - If local install: Check if PostgreSQL service is started");
      } else if (error.message.includes("authentication failed")) {
        console.log("\n💡 Check your DATABASE_URL credentials in .env file");
      } else if (error.message.includes("database") && error.message.includes("does not exist")) {
        console.log("\n💡 Create the database first:");
        console.log("   psql -U postgres -c 'CREATE DATABASE apartment_db;'");
      }
    }
    
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

testConnection();
