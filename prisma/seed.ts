import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clean existing data
  await prisma.transaction.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.securityDeposit.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bookingService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.roomAsset.deleteMany(); // Delete room asset assignments before assets
  await prisma.asset.deleteMany(); // Delete assets
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany(); // Delete room types before blocks
  await prisma.block.deleteMany();
  await prisma.paymentMethodConfig.deleteMany();
  await prisma.paymentAccount.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminPassword = await hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@apartment.com',
      password: adminPassword,
      role: 'ADMIN',
      phone: '+233244123456',
    },
  });

  // Create manager user
  const managerPassword = await hash('manager123', 12);
  const manager = await prisma.user.create({
    data: {
      firstName: 'Manager',
      lastName: 'Smith',
      email: 'manager@apartment.com',
      password: managerPassword,
      role: 'MANAGER',
      phone: '+233244123457',
    },
  });

  console.log('Created users');

  // Create payment method configurations
  const paymentMethods = await Promise.all([
    prisma.paymentMethodConfig.create({
      data: {
        method: 'MOBILE_MONEY',
        provider: 'MTN_MOBILE_MONEY',
        displayName: 'MTN MoMo',
        description: 'MTN Mobile Money payments',
        isActive: true,
        processingFee: 1.5,
        feeType: 'PERCENTAGE',
        minAmount: 1.0,
        maxAmount: 5000.0,
        settings: JSON.stringify({
          provider: 'MTN',
          apiUrl: 'https://sandbox.momodeveloper.mtn.com',
          environment: 'sandbox'
        })
      }
    }),
    prisma.paymentMethodConfig.create({
      data: {
        method: 'DEBIT_CARD',
        provider: 'VODAFONE_CASH',
        displayName: 'Vodafone Cash',
        description: 'Vodafone Cash mobile payments',
        isActive: true,
        processingFee: 1.5,
        feeType: 'PERCENTAGE',
        minAmount: 1.0,
        maxAmount: 5000.0,
        settings: JSON.stringify({
          provider: 'VODAFONE',
          apiUrl: 'https://api.vodafone.com.gh',
          environment: 'sandbox'
        })
      }
    }),
    prisma.paymentMethodConfig.create({
      data: {
        method: 'CREDIT_CARD',
        provider: 'STRIPE',
        displayName: 'Credit/Debit Card',
        description: 'Visa and Mastercard payments via Stripe',
        isActive: true,
        processingFee: 2.9,
        feeType: 'PERCENTAGE',
        minAmount: 1.0,
        maxAmount: 10000.0,
        settings: JSON.stringify({
          provider: 'STRIPE',
          publishableKey: 'pk_test_...',
          environment: 'test'
        })
      }
    }),
    prisma.paymentMethodConfig.create({
      data: {
        method: 'BANK_TRANSFER',
        provider: 'GCB_BANK',
        displayName: 'Bank Transfer',
        description: 'Direct bank transfer payments',
        isActive: true,
        processingFee: 0.0,
        feeType: 'FLAT',
        minAmount: 10.0,
        maxAmount: 50000.0,
        settings: JSON.stringify({
          bankName: 'Ghana Commercial Bank',
          accountNumber: '1234567890',
          accountName: 'Platinum Apartments Ltd'
        })
      }
    }),
    prisma.paymentMethodConfig.create({
      data: {
        method: 'CASH',
        provider: 'CASH_COUNTER',
        displayName: 'Cash Payment',
        description: 'Cash payments at reception',
        isActive: true,
        processingFee: 0.0,
        feeType: 'FLAT',
        minAmount: 1.0,
        maxAmount: 10000.0,
        settings: JSON.stringify({})
      }
    })
  ]);

  console.log('Created payment methods');

  // Create blocks
  const blocks = await Promise.all([
    prisma.block.create({
      data: {
        name: 'Block A',
        description: 'Main residential block with premium amenities',
        floors: 5,
        location: 'Front section of the complex',
      },
    }),
    prisma.block.create({
      data: {
        name: 'Block B',
        description: 'Family-oriented block with larger units',
        floors: 4,
        location: 'East wing of the complex',
      },
    }),
    prisma.block.create({
      data: {
        name: 'Block C',
        description: 'Budget-friendly accommodation',
        floors: 3,
        location: 'West wing of the complex',
      },
    }),
  ]);

  console.log('Created blocks');

  // Create room types
  const roomTypes = await Promise.all([
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_FURNISHED',
        displayName: '1 Bedroom Furnished',
        description: 'Fully furnished one-bedroom apartment with all amenities',
        maxCapacity: 2,
        basePrice: 150.00,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_UNFURNISHED',
        displayName: '1 Bedroom Unfurnished',
        description: 'Unfurnished one-bedroom apartment ready for your personal touch',
        maxCapacity: 2,
        basePrice: 120.00,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'TWO_BEDROOM_STANDARD',
        displayName: '2 Bedroom Standard',
        description: 'Standard two-bedroom apartment perfect for families',
        maxCapacity: 4,
        basePrice: 200.00,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_SPECIAL',
        displayName: '1 Bedroom Special',
        description: 'Special one-bedroom apartment with premium features',
        maxCapacity: 2,
        basePrice: 180.00,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_STANDARD',
        displayName: '1 Bedroom Standard',
        description: 'Standard one-bedroom apartment with essential amenities',
        maxCapacity: 2,
        basePrice: 130.00,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'TWO_BEDROOM_ENSUITE',
        displayName: '2 Bedroom Ensuite',
        description: 'Two-bedroom apartment with ensuite bathrooms',
        maxCapacity: 4,
        basePrice: 250.00,
      },
    }),
  ]);

  console.log('Created room types');

  // Create rooms
  const rooms = [];
  
  // Block A - Premium rooms (floors 1-5)
  for (let floor = 1; floor <= 5; floor++) {
    for (let roomNum = 1; roomNum <= 8; roomNum++) {
      const roomNumber = `A${floor}${roomNum.toString().padStart(2, '0')}`;
      // Assign premium room types: 2BR Ensuite for top floors, 1BR Special for mid floors, 1BR Furnished for lower floors
      let roomType;
      if (floor >= 4) {
        roomType = roomTypes[5]; // 2 Bedroom Ensuite
      } else if (floor >= 2) {
        roomType = roomTypes[3]; // 1 Bedroom Special
      } else {
        roomType = roomTypes[0]; // 1 Bedroom Furnished
      }
      
      rooms.push(
        prisma.room.create({
          data: {
            number: roomNumber,
            typeId: roomType.id,
            blockId: blocks[0].id,
            floor: floor,
            capacity: roomType.maxCapacity || 2,
            pricePerNight: (roomType.basePrice || 150) + (floor * 10), // Higher floors cost more
            status: Math.random() > 0.9 ? 'MAINTENANCE' : 'AVAILABLE',
            description: `${roomType.displayName} on floor ${floor} with ${floor >= 3 ? 'city' : 'garden'} view`,
          },
        })
      );
    }
  }

  // Block B - Family rooms (floors 1-4)
  for (let floor = 1; floor <= 4; floor++) {
    for (let roomNum = 1; roomNum <= 6; roomNum++) {
      const roomNumber = `B${floor}${roomNum.toString().padStart(2, '0')}`;
      // Family-oriented: 2BR Standard for most, 1BR Standard for some variety
      const roomType = roomNum <= 4 ? roomTypes[2] : roomTypes[4]; // 2BR Standard or 1BR Standard
      
      rooms.push(
        prisma.room.create({
          data: {
            number: roomNumber,
            typeId: roomType.id,
            blockId: blocks[1].id,
            floor: floor,
            capacity: roomType.maxCapacity || 2,
            pricePerNight: (roomType.basePrice || 130) + (floor * 8),
            status: Math.random() > 0.85 ? 'MAINTENANCE' : 'AVAILABLE',
            description: `${roomType.displayName} on floor ${floor} with family-friendly amenities`,
          },
        })
      );
    }
  }

  // Block C - Budget rooms (floors 1-3)
  for (let floor = 1; floor <= 3; floor++) {
    for (let roomNum = 1; roomNum <= 10; roomNum++) {
      const roomNumber = `C${floor}${roomNum.toString().padStart(2, '0')}`;
      // Budget options: 1BR Unfurnished for most, 1BR Standard for some
      const roomType = roomNum <= 7 ? roomTypes[1] : roomTypes[4]; // 1BR Unfurnished or 1BR Standard
      
      rooms.push(
        prisma.room.create({
          data: {
            number: roomNumber,
            typeId: roomType.id,
            blockId: blocks[2].id,
            floor: floor,
            capacity: roomType.maxCapacity || 2,
            pricePerNight: (roomType.basePrice || 120) + (floor * 5),
            status: 'AVAILABLE',
            description: `${roomType.displayName} on floor ${floor} - budget-friendly option`,
          },
        })
      );
    }
  }

  const resolvedRooms = await Promise.all(rooms);
  console.log('Created rooms');

  // Create general assets first
  console.log('Creating assets...');
  
  const assets = await Promise.all([
    // Furniture
    prisma.asset.create({
      data: {
        name: 'King Size Bed',
        category: 'FURNITURE',
        description: 'Comfortable king size bed with premium mattress',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Queen Size Bed',
        category: 'FURNITURE',
        description: 'Comfortable queen size bed with quality mattress',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Single Bed',
        category: 'FURNITURE',
        description: 'Single bed with comfortable mattress',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Wardrobe',
        category: 'FURNITURE',
        description: 'Large wooden wardrobe with mirrors',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Study Desk',
        category: 'FURNITURE',
        description: 'Modern wooden desk with chair',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Bedside Table',
        category: 'FURNITURE',
        description: 'Wooden bedside table with drawer',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    
    // Electronics
    prisma.asset.create({
      data: {
        name: '55" Smart TV',
        category: 'ELECTRONICS',
        description: 'Samsung 55-inch Smart TV with streaming capabilities',
        serialNumber: 'SM-TV-001',
        purchaseDate: new Date('2023-02-01'),
        warrantyExpiry: new Date('2026-02-01'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Air Conditioner',
        category: 'ELECTRONICS',
        description: 'Energy-efficient split AC unit',
        serialNumber: 'AC-001',
        purchaseDate: new Date('2023-01-20'),
        warrantyExpiry: new Date('2028-01-20'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Mini Refrigerator',
        category: 'ELECTRONICS',
        description: 'Compact refrigerator for room use',
        serialNumber: 'RF-001',
        purchaseDate: new Date('2023-02-10'),
        warrantyExpiry: new Date('2026-02-10'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    
    // Bathroom
    prisma.asset.create({
      data: {
        name: 'Shower Head',
        category: 'BATHROOM',
        description: 'High-pressure rain shower head',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Toilet',
        category: 'BATHROOM',
        description: 'Modern water-efficient toilet',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Bathroom Mirror',
        category: 'BATHROOM',
        description: 'Large bathroom mirror with LED lighting',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    
    // Bedding
    prisma.asset.create({
      data: {
        name: 'Mattress',
        category: 'BEDDING',
        description: 'Premium memory foam mattress',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Pillow',
        category: 'BEDDING',
        description: 'Hypoallergenic pillow',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Bed Sheet Set',
        category: 'BEDDING',
        description: 'Premium cotton bed sheet set',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    
    // Lighting
    prisma.asset.create({
      data: {
        name: 'Ceiling Light',
        category: 'LIGHTING',
        description: 'LED ceiling light with dimmer',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Bedside Lamp',
        category: 'LIGHTING',
        description: 'Modern bedside reading lamp',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    
    // Safety
    prisma.asset.create({
      data: {
        name: 'Smoke Detector',
        category: 'SAFETY',
        description: 'Battery-powered smoke detector',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    
    // Kitchen (for studio/suite rooms)
    prisma.asset.create({
      data: {
        name: 'Microwave',
        category: 'KITCHEN',
        description: 'Compact microwave oven',
        serialNumber: 'MW-001',
        purchaseDate: new Date('2023-02-15'),
        warrantyExpiry: new Date('2026-02-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
    prisma.asset.create({
      data: {
        name: 'Kitchenette Set',
        category: 'KITCHEN',
        description: 'Basic kitchenette with sink and counter',
        purchaseDate: new Date('2023-01-15'),
        lastInspected: new Date('2024-12-01'),
      },
    }),
  ]);

  console.log('Created assets');

  // Now create room asset assignments
  console.log('Creating room asset assignments...');
  
  const roomAssets = [];

  // Helper function to find asset by name
  const findAsset = (name: string) => assets.find(asset => asset.name === name);

  // Standard room assets for each room type
  for (const room of resolvedRooms) {
    const roomType = await prisma.roomType.findUnique({
      where: { id: room.typeId }
    });

    if (!roomType) continue;

    // Common assets for all rooms
    roomAssets.push(
      // Furniture
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Wardrobe')!.id,
          quantity: 1,
          condition: 'EXCELLENT',
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Study Desk')!.id,
          quantity: 1,
          condition: 'GOOD',
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Bedside Table')!.id,
          quantity: 2,
          condition: 'GOOD',
        },
      }),
      // Electronics
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('55" Smart TV')!.id,
          quantity: 1,
          condition: 'EXCELLENT',
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Air Conditioner')!.id,
          quantity: 1,
          condition: 'GOOD',
        },
      }),
      // Bathroom
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Shower Head')!.id,
          quantity: 1,
          condition: 'GOOD',
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Toilet')!.id,
          quantity: 1,
          condition: 'EXCELLENT',
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Bathroom Mirror')!.id,
          quantity: 1,
          condition: 'EXCELLENT',
        },
      }),
      // Lighting
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Ceiling Light')!.id,
          quantity: 1,
          condition: 'EXCELLENT',
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Bedside Lamp')!.id,
          quantity: 2,
          condition: 'GOOD',
        },
      }),
      // Safety
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          assetId: findAsset('Smoke Detector')!.id,
          quantity: 1,
          condition: 'EXCELLENT',
        },
      }),
    );

    // Bed based on room capacity and type
    if (room.capacity <= 2) {
      // For 1-2 person rooms (all 1BR types)
      roomAssets.push(
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Queen Size Bed')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Mattress')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Pillow')!.id,
            quantity: 4,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Bed Sheet Set')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
      );
    } else {
      // For larger capacity rooms (2BR types)
      roomAssets.push(
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('King Size Bed')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Single Bed')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Mattress')!.id,
            quantity: 2,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Pillow')!.id,
            quantity: 6,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Bed Sheet Set')!.id,
            quantity: 2,
            condition: 'GOOD',
          },
        }),
      );
    }

    // Additional assets for premium and furnished rooms
    if (roomType.name === 'ONE_BEDROOM_FURNISHED' || 
        roomType.name === 'ONE_BEDROOM_SPECIAL' || 
        roomType.name === 'TWO_BEDROOM_ENSUITE') {
      roomAssets.push(
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Mini Refrigerator')!.id,
            quantity: 1,
            condition: 'EXCELLENT',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Microwave')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Kitchenette Set')!.id,
            quantity: 1,
            condition: 'GOOD',
          },
        }),
      );
    }
  }

  // Process room assets in batches to avoid connection pool exhaustion
  const batchSize = 10; // Process 10 room assets at a time
  console.log(`Processing ${roomAssets.length} room assets in batches of ${batchSize}...`);
  
  for (let i = 0; i < roomAssets.length; i += batchSize) {
    const batch = roomAssets.slice(i, i + batchSize);
    await Promise.all(batch);
    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(roomAssets.length / batchSize)}`);
  }
  console.log('Created room asset assignments');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
