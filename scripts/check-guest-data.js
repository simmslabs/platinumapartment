const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGuestData() {
  try {
    const guests = await prisma.guest.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
      take: 10
    });
    
    console.log('Guest data:');
    guests.forEach((guest) => {
      console.log(`Guest ${guest.firstName} ${guest.lastName} (${guest.id}):`);
      console.log(`  Profile Picture: ${guest.profilePicture || 'NULL'}`);
      console.log(`  Picture type: ${typeof guest.profilePicture}`);
      console.log(`  Is base64: ${guest.profilePicture?.startsWith('data:') || false}`);
      console.log(`  Is URL: ${guest.profilePicture?.startsWith('http') || false}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGuestData();
