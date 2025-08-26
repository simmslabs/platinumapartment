const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGuestProfilePictures() {
  try {
    const guests = await prisma.user.findMany({
      where: { role: 'GUEST' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
      take: 5
    });
    
    console.log('=== Guest Profile Pictures ===');
    if (guests.length === 0) {
      console.log('No guests found in database');
      return;
    }
    
    guests.forEach((guest, index) => {
      console.log(`\n${index + 1}. ${guest.firstName} ${guest.lastName} (${guest.id}):`);
      if (!guest.profilePicture) {
        console.log('   Profile Picture: NULL');
      } else {
        console.log(`   Profile Picture Length: ${guest.profilePicture.length} characters`);
        console.log(`   Starts with: ${guest.profilePicture.substring(0, 50)}...`);
        console.log(`   Is base64: ${guest.profilePicture.startsWith('data:')}`);
        console.log(`   Is URL: ${guest.profilePicture.startsWith('http')}`);
        console.log(`   Contains blob: ${guest.profilePicture.includes('blob:')}`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGuestProfilePictures();
