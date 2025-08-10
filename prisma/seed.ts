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
  await prisma.block.deleteMany();
  await prisma.room.deleteMany();
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
        type: 'SINGLE',
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
        type: 'DOUBLE',
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
        type: 'SUITE',
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
        type: 'DELUXE',
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
        type: 'SINGLE',
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
        description: 'Guest reports intermittent WiFi connection in room',
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
