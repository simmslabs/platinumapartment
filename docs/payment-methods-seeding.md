# Payment Methods Seeding

This document describes the payment methods and related data that has been seeded into the apartment management system.

## Overview

The payment system includes comprehensive seeding for:
- **Payment Methods**: All supported payment types
- **Services**: Various hotel services across categories
- **Sample Payments**: Real payment transactions with different statuses
- **Security Deposits**: Guest security deposit records
- **Booking Services**: Services attached to bookings
- **Payment Settings**: System configuration for payment processing

## Payment Methods Available

The system supports the following payment methods (defined in Prisma enum):

### 1. **CASH** 💵
- Traditional cash payments
- Used for: Walk-in payments, tips, small services
- Status: Available but no sample data yet

### 2. **CREDIT_CARD** 💳
- Visa, MasterCard, American Express, etc.
- Most common payment method
- Status: **2 sample payments** ($750 pending, $840 completed)

### 3. **DEBIT_CARD** 🏧
- Direct bank account payments
- Lower processing fees than credit cards
- Status: Available but no sample data yet

### 4. **ONLINE** 🌐
- PayPal, Stripe, Square, etc.
- Digital payment platforms
- Status: Available but no sample data yet

### 5. **BANK_TRANSFER** 🏦
- Wire transfers, ACH payments
- Used for: Large bookings, corporate accounts
- Status: Available but no sample data yet

## Services by Category

### 🍽️ **FOOD_BEVERAGE**
- **Mini Bar** - $15.00
- **Room Service - Breakfast** - $25.00
- **Room Service - Dinner** - $45.00
- **Room Service** (Legacy) - $15.00

### 🧘 **SPA**
- **Full Body Massage** - $80.00
- **Facial Treatment** - $60.00  
- **Spa Massage** (Legacy) - $120.00

### 🧺 **LAUNDRY**
- **Laundry Service** - $20.00
- **Express Laundry** - $35.00
- **Professional Laundry** (Legacy) - $25.00

### 🚗 **TRANSPORT**
- **Airport Transfer** - $50.00
- **City Tour** - $75.00

### 🎬 **ENTERTAINMENT**
- **Movie Night Package** - $30.00
- **Gym Access** (Legacy) - $20.00

### 💼 **BUSINESS**
- **Business Center Access** - $10.00
- **Conference Room Rental** - $40.00
- **Business Center** (Legacy) - $30.00

## Sample Payment Data

### Payment Records
1. **John Doe - Room A-201**
   - Amount: $840.00
   - Method: CREDIT_CARD
   - Status: COMPLETED
   - Transaction ID: TXN47DKI1XAG

2. **John Doe - Room A-301**
   - Amount: $750.00
   - Method: CREDIT_CARD
   - Status: PENDING

### Security Deposits
1. **John Doe**
   - Amount: $100.00
   - Method: CREDIT_CARD
   - Status: PAID
   - Transaction ID: DEPX70EK64RH

### Booking Services
1. **Room Service - Breakfast**
   - Guest: John Doe
   - Quantity: 2
   - Total: $50.00

2. **Full Body Massage**
   - Guest: John Doe
   - Quantity: 1
   - Total: $80.00

## Payment Settings

The system includes these payment configuration settings:

### 💳 **Payment Processing**
- **CREDIT_CARD_PROCESSING_FEE**: 2.9%
- **PAYMENT_METHODS_ENABLED**: All 5 methods enabled
- **PAYMENT_DUE_DAYS**: 3 days before check-in

### 🔒 **Security & Deposits**
- **SECURITY_DEPOSIT_AMOUNT**: $100.00
- **AUTO_REFUND_ENABLED**: true

## Payment Statistics

- **Total Payments**: 2 records
- **Total Amount**: $1,590.00
- **Completed**: $840.00 (1 payment)
- **Pending**: $750.00 (1 payment)
- **Security Deposits**: $100.00 (1 deposit)

## Database Commands

### Run Seeding
```bash
bun run db:seed
```

### Check Payment Data
```bash
bun run payment:check
```

### Reset and Re-seed
```bash
bun run db:reset
bun run db:seed
```

## API Integration

### Payment Methods Enum Usage
```typescript
import { PaymentMethod } from "@prisma/client";

// Create payment
const payment = await prisma.payment.create({
  data: {
    method: PaymentMethod.CREDIT_CARD,
    status: PaymentStatus.COMPLETED,
    // ... other fields
  }
});
```

### Querying Payment Data
```typescript
// Get all payments by method
const creditCardPayments = await prisma.payment.findMany({
  where: { method: "CREDIT_CARD" },
  include: { booking: { include: { user: true } } }
});

// Get payment statistics
const stats = await prisma.payment.groupBy({
  by: ['method', 'status'],
  _count: { id: true },
  _sum: { amount: true }
});
```

## Frontend Integration

Payment methods can be displayed in forms:

```tsx
const paymentMethods = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "ONLINE", label: "Online Payment" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];
```

## Security Considerations

- **Payment Data**: All payment records include transaction IDs
- **PCI Compliance**: No actual card numbers stored
- **Audit Trail**: Complete payment history tracking
- **Encryption**: Sensitive data properly protected

## Future Enhancements

- **Partial Payments**: Support for payment installments
- **Refund Processing**: Automated refund workflows
- **Payment Webhooks**: Real-time payment status updates
- **Multi-Currency**: Support for different currencies
- **Payment Analytics**: Advanced reporting and insights

This seeding provides a solid foundation for testing and developing payment-related features in the apartment management system.
