const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupBadImageUrls() {
  try {
    console.log('=== Cleaning up bad image URLs ===');
    
    // Find guests with bad image URLs (file paths instead of proper URLs or base64)
    const guestsWithBadUrls = await prisma.user.findMany({
      where: {
        role: 'GUEST',
        profilePicture: {
          not: null,
          AND: [
            { not: { startsWith: 'data:' } }, // Not base64
            { not: { startsWith: 'https://' } }, // Not proper URL
            { not: { startsWith: 'http://' } }, // Not proper URL
          ]
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      }
    });

    console.log(`Found ${guestsWithBadUrls.length} guests with bad image URLs:`);
    
    for (const guest of guestsWithBadUrls) {
      console.log(`  - ${guest.firstName} ${guest.lastName}: ${guest.profilePicture}`);
    }

    if (guestsWithBadUrls.length > 0) {
      console.log('\nClearing bad URLs...');
      
      const updateResult = await prisma.user.updateMany({
        where: {
          id: { in: guestsWithBadUrls.map(g => g.id) }
        },
        data: {
          profilePicture: null
        }
      });

      console.log(`Updated ${updateResult.count} guest records.`);
      console.log('Bad image URLs have been cleared. Guests can now upload new profile pictures.');
    } else {
      console.log('No bad URLs found.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupBadImageUrls();
