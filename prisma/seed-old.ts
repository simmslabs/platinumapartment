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

  // Create staff user
  const staffPassword = await hash('staff123', 12);
  const staff = await prisma.user.create({
    data: {
      firstName: 'Staff',
      lastName: 'Johnson',
      email: 'staff@apartment.com',
      password: staffPassword,
      role: 'STAFF',
      phone: '+233244123458',
    },
  });

  // Create guest users
  const guestPassword = await hash('guest123', 12);
  const guests = await Promise.all([
    prisma.user.create({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: guestPassword,
        role: 'GUEST',
        phone: '+233244123459',
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: guestPassword,
        role: 'GUEST',
        phone: '+233244123460',
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Mike',
        lastName: 'Wilson',
        email: 'mike.wilson@example.com',
        password: guestPassword,
        role: 'GUEST',
        phone: '+233244123461',
      },
    }),
  ]);

  // Create blocks
  const blocks = await Promise.all([
    prisma.block.create({
      data: {
        name: 'A',
        description: 'Main Building Block A',
        floors: 3,
        location: 'Ground floor entrance on the left',
      },
    }),
    prisma.block.create({
      data: {
        name: 'B',
        description: 'Main Building Block B',
        floors: 3,
        location: 'Ground floor entrance on the right',
      },
    }),
    prisma.block.create({
      data: {
        name: 'C',
        description: 'Annex Building Block C',
        floors: 2,
        location: 'Separate building behind the main structure',
      },
    }),
  ]);

  // Create room types
  const roomTypes = await Promise.all([
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_STANDARD',
        displayName: '1 Bedroom Standard',
        description: 'Standard one-bedroom apartment with basic amenities',
        basePrice: 150.0,
        maxCapacity: 2,
        isActive: true,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_SPECIAL',
        displayName: '1 Bedroom Special',
        description: 'Special one-bedroom apartment with enhanced features',
        basePrice: 180.0,
        maxCapacity: 2,
        isActive: true,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_FURNISHED',
        displayName: '1 Bedroom Furnished',
        description: 'Fully furnished one-bedroom apartment',
        basePrice: 220.0,
        maxCapacity: 2,
        isActive: true,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'ONE_BEDROOM_UNFURNISHED',
        displayName: '1 Bedroom Unfurnished',
        description: 'Unfurnished one-bedroom apartment',
        basePrice: 130.0,
        maxCapacity: 2,
        isActive: true,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'TWO_BEDROOM_STANDARD',
        displayName: '2 Bedroom Standard',
        description: 'Standard two-bedroom apartment',
        basePrice: 280.0,
        maxCapacity: 4,
        isActive: true,
      },
    }),
    prisma.roomType.create({
      data: {
        name: 'TWO_BEDROOM_ENSUITE',
        displayName: '2 Bedroom Ensuite',
        description: 'Two-bedroom apartment with ensuite bathrooms',
        basePrice: 350.0,
        maxCapacity: 4,
        isActive: true,
      },
    }),
  ]);

  // Create payment method configurations
  const paymentMethods = await Promise.all([
    prisma.paymentMethodConfig.create({
      data: {
        method: 'CREDIT_CARD',
        provider: 'STRIPE',
        isActive: true,
        displayName: 'Credit Card',
        description: 'Pay securely with your credit or debit card',
        processingFee: 2.9,
        feeType: 'PERCENTAGE',
        minAmount: 10.0,
        maxAmount: 10000.0,
        currencies: 'GHS,USD',
        settings: JSON.stringify({
          publishableKey: 'pk_test_stripe_key',
          webhookEndpoint: '/webhooks/stripe',
        }),
      },
    }),
    prisma.paymentMethodConfig.create({
      data: {
        method: 'BANK_TRANSFER',
        provider: 'GCB_BANK',
        isActive: true,
        displayName: 'Bank Transfer',
        description: 'Transfer directly from your bank account',
        processingFee: 1.0,
        feeType: 'PERCENTAGE',
        minAmount: 50.0,
        maxAmount: 50000.0,
        currencies: 'GHS',
        settings: JSON.stringify({
          accountNumber: '1234567890',
          sortCode: '030100',
        }),
      },
    }),
    prisma.paymentMethodConfig.create({
      data: {
        method: 'CASH',
        provider: 'CASH_COUNTER',
        isActive: true,
        displayName: 'Cash Payment',
        description: 'Pay in cash at the property',
        processingFee: 0.0,
        feeType: 'FLAT',
        minAmount: 1.0,
        currencies: 'GHS',
      },
    }),
  ]);

  // Create payment accounts
  const paymentAccounts = await Promise.all([
    prisma.paymentAccount.create({
      data: {
        userId: admin.id,
        type: 'CREDIT_CARD',
        provider: 'STRIPE',
        accountNumber: '****1234',
        cardLast4: '1234',
        cardBrand: 'VISA',
        cardExpMonth: 12,
        cardExpYear: 2027,
        accountName: 'Admin User',
        isDefault: true,
        isActive: true,
        providerData: JSON.stringify({
          customerId: 'cus_stripe_customer_id',
          paymentMethodId: 'pm_stripe_payment_method_id',
        }),
      },
    }),
    prisma.paymentAccount.create({
      data: {
        userId: manager.id,
        type: 'BANK_ACCOUNT',
        provider: 'GCB_BANK',
        accountNumber: '****7890',
        bankName: 'Ghana Commercial Bank',
        accountName: 'Manager Smith',
        isDefault: true,
        isActive: true,
      },
    }),
    prisma.paymentAccount.create({
      data: {
        userId: guests[0].id,
        type: 'MOBILE_WALLET',
        provider: 'MTN_MOBILE_MONEY',
        accountNumber: '0244123459',
        accountName: 'John Doe',
        isDefault: true,
        isActive: true,
        providerData: JSON.stringify({
          network: 'MTN',
          verified: true,
        }),
      },
    }),
  ]);

  // Create rooms
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        number: '101',
        typeId: roomTypes[0].id, // ONE_BEDROOM_STANDARD
        status: 'AVAILABLE',
        blockId: blocks[0].id, // Block A
        block: 'A',
        floor: 1,
        capacity: 1,
        pricePerNight: 150.0,
        description: 'Cozy single room with modern amenities',
        amenities: JSON.stringify(['WiFi', 'Air Conditioning', 'Private Bathroom']),
      },
    }),
    prisma.room.create({
      data: {
        number: '102',
        typeId: roomTypes[1].id, // ONE_BEDROOM_SPECIAL
        status: 'AVAILABLE',
        blockId: blocks[0].id, // Block A
        block: 'A',
        floor: 1,
        capacity: 2,
        pricePerNight: 200.0,
        description: 'Spacious double room perfect for couples',
        amenities: JSON.stringify(['WiFi', 'Air Conditioning', 'Private Bathroom', 'Mini Fridge']),
      },
    }),
    prisma.room.create({
      data: {
        number: '103',
        typeId: roomTypes[2].id, // ONE_BEDROOM_FURNISHED
        status: 'AVAILABLE',
        blockId: blocks[0].id, // Block A
        block: 'A',
        floor: 1,
        capacity: 4,
        pricePerNight: 350.0,
        description: 'Luxury suite with living area and kitchenette',
        amenities: JSON.stringify(['WiFi', 'Air Conditioning', 'Private Bathroom', 'Kitchenette', 'Living Area']),
      },
    }),
    prisma.room.create({
      data: {
        number: '201',
        typeId: roomTypes[4].id, // TWO_BEDROOM_STANDARD
        status: 'AVAILABLE',
        blockId: blocks[1].id, // Block B
        block: 'B',
        floor: 2,
        capacity: 6,
        pricePerNight: 400.0,
        description: 'Large deluxe room with multiple beds',
        amenities: JSON.stringify(['WiFi', 'Air Conditioning', 'Private Bathroom', 'Kitchenette', 'Balcony']),
      },
    }),
    prisma.room.create({
      data: {
        number: '202',
        typeId: roomTypes[3].id, // ONE_BEDROOM_UNFURNISHED
        status: 'MAINTENANCE',
        blockId: blocks[1].id, // Block B
        block: 'B',
        floor: 2,
        capacity: 1,
        pricePerNight: 150.0,
        description: 'Comfortable single room on the second floor',
        amenities: JSON.stringify(['WiFi', 'Air Conditioning', 'Private Bathroom']),
      },
    }),
  ]);

  console.log('Created rooms');

  // Create general assets first (new schema approach)
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
  
  // Helper function to find asset by name
  const findAsset = (name: string) => assets.find(asset => asset.name === name);

  // OLD APPROACH - to be replaced with new room asset assignment logic
  // Create room assets
  const roomAssets = [];

  // Standard room assets for each room type
  for (const room of rooms) {
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
    if (roomType.name === 'SINGLE' || room.capacity === 1) {
      roomAssets.push(
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
            quantity: 1,
            condition: 'GOOD',
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            assetId: findAsset('Pillow')!.id,
            quantity: 2,
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
    } else if (roomType.name === 'DOUBLE' || room.capacity === 2) {
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
      // For larger capacity rooms (suite/family)
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
            quantity: 2,
            condition: 'GOOD',
          },
        }),
      );
    }

    // Additional assets for premium rooms (suite/studio)
    if (roomType.name === 'SUITE' || roomType.name === 'STUDIO') {
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

  await Promise.all(roomAssets);
  console.log('Created room asset assignments');
    // Basic furniture
    roomAssets.push(
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'King Size Bed',
          category: 'FURNITURE',
          quantity: Math.ceil(room.capacity / 2), // Base bed count on room capacity
          condition: 'GOOD',
          description: 'Comfortable king size bed with premium mattress',
          purchaseDate: new Date('2023-01-15'),
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Wardrobe',
          category: 'FURNITURE',
          quantity: 1,
          condition: 'EXCELLENT',
          description: 'Large wooden wardrobe with mirrors',
          purchaseDate: new Date('2023-01-15'),
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Study Desk',
          category: 'FURNITURE',
          quantity: 1,
          condition: 'GOOD',
          description: 'Modern wooden desk with chair',
          purchaseDate: new Date('2023-01-15'),
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Bedside Tables',
          category: 'FURNITURE',
          quantity: 2,
          condition: 'GOOD',
          description: 'Matching bedside tables with drawers',
          purchaseDate: new Date('2023-01-15'),
          lastInspected: new Date('2024-12-01'),
        },
      })
    );

    // Electronics
    roomAssets.push(
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: '55" Smart TV',
          category: 'ELECTRONICS',
          quantity: 1,
          condition: 'EXCELLENT',
          description: 'Samsung 55-inch 4K Smart TV',
          serialNumber: `TV-${room.number}-2024`,
          purchaseDate: new Date('2024-03-01'),
          warrantyExpiry: new Date('2027-03-01'),
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Air Conditioner',
          category: 'ELECTRONICS',
          quantity: 1,
          condition: room.status === 'MAINTENANCE' ? 'POOR' : 'GOOD',
          description: 'Split AC unit with remote control',
          serialNumber: `AC-${room.number}-2023`,
          purchaseDate: new Date('2023-06-01'),
          warrantyExpiry: new Date('2026-06-01'),
          lastInspected: new Date('2024-11-15'),
          notes: room.status === 'MAINTENANCE' ? 'Requires maintenance - cooling efficiency reduced' : null,
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Mini Refrigerator',
          category: 'ELECTRONICS',
          quantity: 1,
          condition: 'GOOD',
          description: 'Compact refrigerator with freezer compartment',
          serialNumber: `RF-${room.number}-2023`,
          purchaseDate: new Date('2023-05-01'),
          warrantyExpiry: new Date('2026-05-01'),
          lastInspected: new Date('2024-12-01'),
        },
      })
    );

    // Bathroom assets
    roomAssets.push(
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Shower',
          category: 'BATHROOM',
          quantity: 1,
          condition: 'GOOD',
          description: 'Modern shower with glass enclosure',
          lastInspected: new Date('2024-11-20'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Toilet',
          category: 'BATHROOM',
          quantity: 1,
          condition: 'GOOD',
          description: 'Modern ceramic toilet with soft-close seat',
          lastInspected: new Date('2024-11-20'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Bathroom Mirror',
          category: 'BATHROOM',
          quantity: 1,
          condition: 'EXCELLENT',
          description: 'Large wall-mounted mirror with LED lighting',
          lastInspected: new Date('2024-12-01'),
        },
      })
    );

    // Bedding
    roomAssets.push(
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Mattress',
          category: 'BEDDING',
          quantity: Math.ceil(room.capacity / 2), // Base mattress count on room capacity
          condition: 'GOOD',
          description: 'Premium memory foam mattress',
          purchaseDate: new Date('2023-08-01'),
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Pillows',
          category: 'BEDDING',
          quantity: room.capacity * 2, // 2 pillows per person capacity
          condition: 'GOOD',
          description: 'Premium down pillows',
          purchaseDate: new Date('2024-01-01'),
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Bed Sheets Set',
          category: 'BEDDING',
          quantity: 2,
          condition: 'GOOD',
          description: 'High-quality cotton bed sheets with pillowcases',
          purchaseDate: new Date('2024-02-01'),
          lastInspected: new Date('2024-12-01'),
        },
      })
    );

    // Lighting
    roomAssets.push(
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Ceiling Light',
          category: 'LIGHTING',
          quantity: 1,
          condition: 'EXCELLENT',
          description: 'Modern LED ceiling light with dimmer',
          lastInspected: new Date('2024-12-01'),
        },
      }),
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Bedside Lamps',
          category: 'LIGHTING',
          quantity: 2,
          condition: 'GOOD',
          description: 'Matching bedside table lamps',
          lastInspected: new Date('2024-12-01'),
        },
      })
    );

    // Safety equipment
    roomAssets.push(
      prisma.roomAsset.create({
        data: {
          roomId: room.id,
          name: 'Smoke Detector',
          category: 'SAFETY',
          quantity: 1,
          condition: 'EXCELLENT',
          description: 'Battery-powered smoke detector',
          lastInspected: new Date('2024-12-01'),
        },
      })
    );

    // Add kitchenette items for larger rooms (capacity 4 or more)
    if (room.capacity >= 4) {
      roomAssets.push(
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            name: 'Microwave',
            category: 'KITCHEN',
            quantity: 1,
            condition: 'GOOD',
            description: 'Compact microwave oven',
            serialNumber: `MW-${room.number}-2023`,
            purchaseDate: new Date('2023-09-01'),
            warrantyExpiry: new Date('2025-09-01'),
            lastInspected: new Date('2024-12-01'),
          },
        }),
        prisma.roomAsset.create({
          data: {
            roomId: room.id,
            name: 'Kitchenette Set',
            category: 'KITCHEN',
            quantity: 1,
            condition: 'GOOD',
            description: 'Basic kitchenette with sink, plates, and utensils',
            lastInspected: new Date('2024-12-01'),
          },
        })
      );
    }
  }

  await Promise.all(roomAssets);
  console.log('Created room assets');

  // Create services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: 'Laundry Service',
        description: 'Professional laundry and dry cleaning',
        price: 25.0,
        category: 'LAUNDRY',
        available: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Airport Pickup',
        description: 'Convenient airport transfer service',
        price: 80.0,
        category: 'TRANSPORT',
        available: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Room Service',
        description: '24/7 room service for meals and snacks',
        price: 15.0,
        category: 'FOOD_BEVERAGE',
        available: true,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Spa Treatment',
        description: 'Relaxing spa and wellness services',
        price: 120.0,
        category: 'SPA',
        available: true,
      },
    }),
  ]);

  // Create bookings
  const bookings = await Promise.all([
    // Active booking
    prisma.booking.create({
      data: {
        userId: guests[0].id,
        roomId: rooms[0].id,
        checkIn: new Date('2025-08-12'),
        checkOut: new Date('2025-08-15'),
        guests: 1,
        totalAmount: 450.0, // 3 nights * 150
        status: 'CONFIRMED',
        specialRequests: 'Late check-in requested',
      },
    }),
    // Completed booking
    prisma.booking.create({
      data: {
        userId: guests[1].id,
        roomId: rooms[1].id,
        checkIn: new Date('2025-08-05'),
        checkOut: new Date('2025-08-08'),
        guests: 2,
        totalAmount: 600.0, // 3 nights * 200
        status: 'CHECKED_OUT',
        specialRequests: 'Ground floor room preferred',
      },
    }),
    // Upcoming booking
    prisma.booking.create({
      data: {
        userId: guests[2].id,
        roomId: rooms[2].id,
        checkIn: new Date('2025-08-20'),
        checkOut: new Date('2025-08-25'),
        guests: 3,
        totalAmount: 1750.0, // 5 nights * 350
        status: 'CONFIRMED',
        specialRequests: 'Extra towels and pillows',
      },
    }),
    // Pending booking
    prisma.booking.create({
      data: {
        userId: guests[0].id,
        roomId: rooms[3].id,
        checkIn: new Date('2025-09-01'),
        checkOut: new Date('2025-09-05'),
        guests: 4,
        totalAmount: 1600.0, // 4 nights * 400
        status: 'PENDING',
        specialRequests: 'Deluxe room with connecting beds',
      },
    }),
  ]);

  // Create payments
  const payments = await Promise.all([
    prisma.payment.create({
      data: {
        bookingId: bookings[1].id,
        paymentAccountId: paymentAccounts[0].id,
        amount: 600.0,
        method: 'CREDIT_CARD',
        status: 'COMPLETED',
        transactionId: 'TXN-001-2025080812345',
        paidAt: new Date('2025-08-05'),
      },
    }),
    prisma.payment.create({
      data: {
        bookingId: bookings[0].id,
        paymentAccountId: paymentAccounts[1].id,
        amount: 450.0,
        method: 'BANK_TRANSFER',
        status: 'COMPLETED',
        transactionId: 'TXN-002-2025081015432',
        paidAt: new Date('2025-08-10'),
      },
    }),
  ]);

  // Create receipts
  const receipts = await Promise.all([
    prisma.receipt.create({
      data: {
        paymentId: payments[0].id,
        receiptNumber: 'RCP-2025080801',
        userId: guests[1].id,
        amount: 600.0,
        tax: 0,
        discount: 0,
        totalAmount: 600.0,
        currency: 'GHS',
        description: 'Payment for Room 102 booking - 3 nights',
        items: JSON.stringify([
          { name: 'Room 102', quantity: 3, price: 200.0, total: 600.0 }
        ]),
        issuedAt: new Date('2025-08-05'),
        paidDate: new Date('2025-08-05'),
        status: 'PAID',
        receiptType: 'PAYMENT',
      },
    }),
    prisma.receipt.create({
      data: {
        paymentId: payments[1].id,
        receiptNumber: 'RCP-2025081001',
        userId: guests[0].id,
        amount: 450.0,
        tax: 0,
        discount: 0,
        totalAmount: 450.0,
        currency: 'GHS',
        description: 'Payment for Room 101 booking - 3 nights',
        items: JSON.stringify([
          { name: 'Room 101', quantity: 3, price: 150.0, total: 450.0 }
        ]),
        issuedAt: new Date('2025-08-10'),
        paidDate: new Date('2025-08-10'),
        status: 'PAID',
        receiptType: 'PAYMENT',
      },
    }),
  ]);

  // Create transactions
  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        transactionNumber: 'TXN-001-2025080812345',
        paymentId: payments[0].id,
        paymentAccountId: paymentAccounts[0].id,
        userId: guests[1].id,
        amount: 600.0,
        fee: 17.4, // 2.9% of 600
        netAmount: 582.6, // 600 - 17.4
        currency: 'GHS',
        type: 'PAYMENT',
        status: 'COMPLETED',
        method: 'CREDIT_CARD',
        provider: 'STRIPE',
        providerTxnId: 'pi_1234567890',
        reference: 'TXN-001-2025080812345',
        description: 'Card payment for booking',
        processedAt: new Date('2025-08-05'),
      },
    }),
    prisma.transaction.create({
      data: {
        transactionNumber: 'TXN-002-2025081015432',
        paymentId: payments[1].id,
        paymentAccountId: paymentAccounts[1].id,
        userId: guests[0].id,
        amount: 450.0,
        fee: 6.75, // 1.5% of 450
        netAmount: 443.25, // 450 - 6.75
        currency: 'GHS',
        type: 'PAYMENT',
        status: 'COMPLETED',
        method: 'MOBILE_MONEY',
        provider: 'MTN_MOBILE_MONEY',
        providerTxnId: 'MM-987654321',
        reference: 'TXN-002-2025081015432',
        description: 'Mobile money payment for booking',
        processedAt: new Date('2025-08-10'),
      },
    }),
    // Refund transaction
    prisma.transaction.create({
      data: {
        transactionNumber: 'REF-001-2025081012345',
        paymentAccountId: paymentAccounts[0].id,
        userId: admin.id,
        amount: -50.0,
        fee: 0,
        netAmount: -50.0,
        currency: 'GHS',
        type: 'REFUND',
        status: 'COMPLETED',
        method: 'CREDIT_CARD',
        provider: 'STRIPE',
        providerTxnId: 're_1234567890',
        reference: 'REF-001-2025081012345',
        description: 'Partial refund for service cancellation',
        processedAt: new Date('2025-08-10'),
      },
    }),
  ]);

  // Create security deposits
  const securityDeposits = await Promise.all([
    prisma.securityDeposit.create({
      data: {
        bookingId: bookings[0].id,
        amount: 100.0,
        method: 'CREDIT_CARD',
        status: 'PAID',
        transactionId: 'SEC-001-2025081012345',
        paidAt: new Date('2025-08-10'),
      },
    }),
    prisma.securityDeposit.create({
      data: {
        bookingId: bookings[1].id,
        amount: 100.0,
        method: 'DEBIT_CARD',
        status: 'REFUNDED',
        transactionId: 'SEC-002-2025080512345',
        paidAt: new Date('2025-08-05'),
        refundedAt: new Date('2025-08-08'),
        refundAmount: 100.0,
      },
    }),
  ]);

  // Create service bookings
  const serviceBookings = await Promise.all([
    prisma.bookingService.create({
      data: {
        bookingId: bookings[0].id,
        serviceId: services[0].id,
        quantity: 2,
        totalPrice: 50.0,
      },
    }),
    prisma.bookingService.create({
      data: {
        bookingId: bookings[2].id,
        serviceId: services[1].id,
        quantity: 1,
        totalPrice: 80.0,
      },
    }),
  ]);

  // Create maintenance logs
  const maintenanceLogs = await Promise.all([
    prisma.maintenanceLog.create({
      data: {
        roomId: rooms[4].id,
        type: 'REPAIR',
        description: 'Air Conditioning Repair - AC unit not cooling properly, needs professional repair',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        reportedBy: staff.id,
        startDate: new Date('2025-08-08'),
        cost: 200.0,
        notes: 'Technician scheduled for tomorrow',
      },
    }),
    prisma.maintenanceLog.create({
      data: {
        roomId: rooms[1].id,
        type: 'REPAIR',
        description: 'Bathroom sink faucet has a slow leak',
        priority: 'MEDIUM',
        status: 'COMPLETED',
        reportedBy: guests[1].id,
        startDate: new Date('2025-08-07'),
        endDate: new Date('2025-08-08'),
        cost: 50.0,
        notes: 'Replaced faucet washer, leak fixed',
      },
    }),
    prisma.maintenanceLog.create({
      data: {
        roomId: rooms[0].id,
        type: 'REPAIR',
        description: 'Tenant reports intermittent WiFi connection in room',
        priority: 'LOW',
        status: 'PENDING',
        reportedBy: admin.id,
        notes: 'Need to check router settings',
      },
    }),
  ]);

  // Create reviews
  const reviews = await Promise.all([
    prisma.review.create({
      data: {
        userId: guests[1].id,
        rating: 5,
        title: 'Excellent Stay!',
        comment: 'Excellent stay! The room was clean and comfortable. Staff was very helpful.',
        category: 'OVERALL',
      },
    }),
    prisma.review.create({
      data: {
        userId: guests[0].id,
        rating: 4,
        title: 'Great Location',
        comment: 'Great location and amenities. Only minor issue was the late check-in process.',
        category: 'ROOM',
      },
    }),
  ]);

  console.log('Seed completed successfully!');
  console.log(`Created:`);
  console.log(`- ${await prisma.user.count()} users`);
  console.log(`- ${await prisma.block.count()} blocks`);
  console.log(`- ${await prisma.room.count()} rooms`);
  console.log(`- ${await prisma.booking.count()} bookings`);
  console.log(`- ${await prisma.payment.count()} payments`);
  console.log(`- ${await prisma.paymentAccount.count()} payment accounts`);
  console.log(`- ${await prisma.receipt.count()} receipts`);
  console.log(`- ${await prisma.transaction.count()} transactions`);
  console.log(`- ${await prisma.securityDeposit.count()} security deposits`);
  console.log(`- ${await prisma.service.count()} services`);
  console.log(`- ${await prisma.bookingService.count()} service bookings`);
  console.log(`- ${await prisma.maintenanceLog.count()} maintenance logs`);
  console.log(`- ${await prisma.review.count()} reviews`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect(); 
  });
