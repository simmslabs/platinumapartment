#!/usr/bin/env node
/**
 * Display payment methods and related data from the database
 * Usage: bun run scripts/check-payment-data.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPaymentData() {
  console.log('🔍 Checking Payment Methods and Related Data...\n');

  try {
    // Check Services
    const services = await prisma.service.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    console.log('🏨 Services by Category:');
    const servicesByCategory = services.reduce((acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    }, {});

    Object.entries(servicesByCategory).forEach(([category, services]) => {
      console.log(`\n  📋 ${category}:`);
      services.forEach(service => {
        console.log(`    • ${service.name} - $${service.price}`);
        if (service.description) {
          console.log(`      ${service.description}`);
        }
      });
    });

    // Check Payments
    const payments = await prisma.payment.findMany({
      include: {
        booking: {
          include: {
            user: true,
            room: {
              include: {
                blockRelation: true
              }
            }
          }
        }
      }
    });

    console.log(`\n💳 Payment Records (${payments.length} total):`);
    payments.forEach(payment => {
      const room = `${payment.booking.room.blockRelation?.name || payment.booking.room.block}-${payment.booking.room.number}`;
      console.log(`  • ${payment.booking.user.firstName} ${payment.booking.user.lastName}`);
      console.log(`    Room: ${room} | Amount: $${payment.amount} | Method: ${payment.method} | Status: ${payment.status}`);
      if (payment.transactionId) {
        console.log(`    Transaction ID: ${payment.transactionId}`);
      }
    });

    // Check Security Deposits
    const deposits = await prisma.securityDeposit.findMany({
      include: {
        booking: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`\n🔒 Security Deposits (${deposits.length} total):`);
    deposits.forEach(deposit => {
      console.log(`  • ${deposit.booking.user.firstName} ${deposit.booking.user.lastName}`);
      console.log(`    Amount: $${deposit.amount} | Method: ${deposit.method} | Status: ${deposit.status}`);
      if (deposit.transactionId) {
        console.log(`    Transaction ID: ${deposit.transactionId}`);
      }
    });

    // Check Booking Services
    const bookingServices = await prisma.bookingService.findMany({
      include: {
        booking: {
          include: {
            user: true
          }
        },
        service: true
      }
    });

    console.log(`\n🛎️ Booking Services (${bookingServices.length} total):`);
    bookingServices.forEach(bs => {
      console.log(`  • ${bs.booking.user.firstName} ${bs.booking.user.lastName}`);
      console.log(`    Service: ${bs.service.name} | Quantity: ${bs.quantity} | Total: $${bs.totalPrice}`);
    });

    // Check Payment Settings
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'PAYMENT_METHODS_ENABLED',
            'CREDIT_CARD_PROCESSING_FEE',
            'SECURITY_DEPOSIT_AMOUNT',
            'PAYMENT_DUE_DAYS',
            'AUTO_REFUND_ENABLED'
          ]
        }
      },
      orderBy: { key: 'asc' }
    });

    console.log(`\n⚙️ Payment Settings (${settings.length} total):`);
    settings.forEach(setting => {
      console.log(`  • ${setting.key}: ${setting.value}`);
      if (setting.description) {
        console.log(`    ${setting.description}`);
      }
    });

    // Payment Method Statistics
    const paymentStats = await prisma.payment.groupBy({
      by: ['method', 'status'],
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    console.log('\n📊 Payment Statistics:');
    paymentStats.forEach(stat => {
      console.log(`  • ${stat.method} (${stat.status}): ${stat._count.id} payments, $${stat._sum.amount || 0} total`);
    });

    // Available Payment Methods from Enum
    console.log('\n💰 Available Payment Methods:');
    const paymentMethods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE', 'BANK_TRANSFER'];
    paymentMethods.forEach(method => {
      const count = payments.filter(p => p.method === method).length;
      console.log(`  • ${method}: ${count > 0 ? `${count} payments` : 'No payments yet'}`);
    });

    console.log('\n✅ Payment data check completed!');

  } catch (error) {
    console.error('❌ Error checking payment data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkPaymentData();
