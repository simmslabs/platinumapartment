import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@apartment.com" },
    update: {},
    create: {
      email: "admin@apartment.com",
      password: adminPassword,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      phone: "+1234567890",
      address: "Apartment Main Office",
    },
  });

  // Create manager user
  const managerPassword = await bcrypt.hash("manager123", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@apartment.com" },
    update: {},
    create: {
      email: "manager@apartment.com",
      password: managerPassword,
      firstName: "Apartment",
      lastName: "Manager",
      role: "MANAGER",
      phone: "+1234567891",
      address: "Apartment Main Office",
    },
  });

  // Create staff user
  const staffPassword = await bcrypt.hash("staff123", 10);
  const staff = await prisma.user.upsert({
    where: { email: "staff@apartment.com" },
    update: {},
    create: {
      email: "staff@apartment.com",
      password: staffPassword,
      firstName: "Apartment",
      lastName: "Staff",
      role: "STAFF",
      phone: "+1234567892",
      address: "Apartment Main Office",
    },
  });

  // Create guest user
  const guestPassword = await bcrypt.hash("guest123", 10);
  const guest = await prisma.user.upsert({
    where: { email: "guest@apartment.com" },
    update: {},
    create: {
      email: "guest@apartment.com",
      password: guestPassword,
      firstName: "John",
      lastName: "Doe",
      role: "TENANT",
      phone: "+1234567893",
      address: "123 Tenant Street, City",
    },
  });

  console.log("👥 Created users");

  // Create rooms
  const rooms = [
    // Single rooms
    { number: "101", type: "SINGLE" as const, floor: 1, capacity: 1, pricePerNight: 80, description: "Cozy single room with city view" },
    { number: "102", type: "SINGLE" as const, floor: 1, capacity: 1, pricePerNight: 80, description: "Comfortable single room" },
    { number: "103", type: "SINGLE" as const, floor: 1, capacity: 1, pricePerNight: 80, description: "Single room with garden view" },
    
    // Double rooms
    { number: "201", type: "DOUBLE" as const, floor: 2, capacity: 2, pricePerNight: 120, description: "Spacious double room with balcony" },
    { number: "202", type: "DOUBLE" as const, floor: 2, capacity: 2, pricePerNight: 120, description: "Double room with mountain view" },
    { number: "203", type: "DOUBLE" as const, floor: 2, capacity: 2, pricePerNight: 120, description: "Elegant double room" },
    { number: "204", type: "DOUBLE" as const, floor: 2, capacity: 2, pricePerNight: 120, description: "Double room with city view" },
    
    // Suites
    { number: "301", type: "SUITE" as const, floor: 3, capacity: 4, pricePerNight: 250, description: "Luxury suite with separate living area" },
    { number: "302", type: "SUITE" as const, floor: 3, capacity: 4, pricePerNight: 250, description: "Executive suite with office space" },
    
    // Deluxe rooms
    { number: "401", type: "DELUXE" as const, floor: 4, capacity: 3, pricePerNight: 180, description: "Deluxe room with premium amenities" },
    { number: "402", type: "DELUXE" as const, floor: 4, capacity: 3, pricePerNight: 180, description: "Deluxe room with spa access" },
    
    // Presidential suite
    { number: "501", type: "PRESIDENTIAL" as const, floor: 5, capacity: 6, pricePerNight: 500, description: "Presidential suite with panoramic views and private butler service" },
  ];

  for (const roomData of rooms) {
    await prisma.room.upsert({
      where: { number: roomData.number },
      update: {},
      create: roomData,
    });
  }

  console.log("🏨 Created rooms");

  // Create services
  const services = [
    { name: "Room Service", description: "24/7 room service", price: 15, category: "FOOD_BEVERAGE" as const },
    { name: "Laundry Service", description: "Professional laundry and dry cleaning", price: 25, category: "LAUNDRY" as const },
    { name: "Spa Massage", description: "Relaxing full body massage", price: 120, category: "SPA" as const },
    { name: "Airport Transfer", description: "Private airport transfer service", price: 50, category: "TRANSPORT" as const },
    { name: "Business Center", description: "Access to business facilities", price: 30, category: "BUSINESS" as const },
    { name: "Gym Access", description: "24/7 fitness center access", price: 20, category: "ENTERTAINMENT" as const },
  ];

  for (const serviceData of services) {
    await prisma.service.create({
      data: serviceData,
    });
  }

  console.log("🛎️ Created services");

  // Create some sample bookings
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const room201 = await prisma.room.findUnique({ where: { number: "201" } });
  const room301 = await prisma.room.findUnique({ where: { number: "301" } });

  if (room201 && room301) {
    await prisma.booking.upsert({
      where: { id: "booking1" },
      update: {},
      create: {
        id: "booking1",
        userId: guest.id,
        roomId: room201.id,
        checkIn: tomorrow,
        checkOut: nextWeek,
        guests: 2,
        totalAmount: 840, // 7 nights * 120
        status: "CONFIRMED",
        specialRequests: "Late check-in requested",
      },
    });

    await prisma.booking.upsert({
      where: { id: "booking2" },
      update: {},
      create: {
        id: "booking2",
        userId: guest.id,
        roomId: room301.id,
        checkIn: new Date(tomorrow.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        checkOut: new Date(tomorrow.getTime() + 17 * 24 * 60 * 60 * 1000), // 3 days later
        guests: 3,
        totalAmount: 750, // 3 nights * 250
        status: "PENDING",
        specialRequests: "Flowers and champagne for anniversary",
      },
    });
  }

  console.log("📅 Created sample bookings");

  // Update room status for occupied rooms
  await prisma.room.update({
    where: { number: "201" },
    data: { status: "OCCUPIED" },
  });

  await prisma.room.update({
    where: { number: "102" },
    data: { status: "MAINTENANCE" },
  });

  console.log("✅ Database seeded successfully!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
