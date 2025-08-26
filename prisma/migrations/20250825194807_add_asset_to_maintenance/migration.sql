/*
  Warnings:

  - A unique constraint covering the columns `[receiptId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PricingPeriod" AS ENUM ('NIGHT', 'DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "public"."AssetCategory" AS ENUM ('FURNITURE', 'ELECTRONICS', 'BATHROOM', 'KITCHEN', 'BEDDING', 'LIGHTING', 'SAFETY', 'DECORATION', 'CLEANING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'BROKEN', 'MISSING');

-- CreateEnum
CREATE TYPE "public"."PaymentAccountType" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_ACCOUNT', 'MOBILE_WALLET', 'DIGITAL_WALLET', 'CRYPTO_WALLET');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'VISA', 'MASTERCARD', 'MTN_MOBILE_MONEY', 'VODAFONE_CASH', 'AIRTELTIGO_MONEY', 'GCB_BANK', 'ECOBANK', 'UBA_BANK', 'BANK_OF_GHANA', 'MANUAL', 'CASH_COUNTER');

-- CreateEnum
CREATE TYPE "public"."ReceiptStatus" AS ENUM ('PENDING', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ReceiptType" AS ENUM ('PAYMENT', 'REFUND', 'DEPOSIT', 'INVOICE', 'CREDIT_NOTE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('PAYMENT', 'REFUND', 'PARTIAL_PAYMENT', 'DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT', 'FEE', 'REVERSAL', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."FeeType" AS ENUM ('FLAT', 'PERCENTAGE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentMethod" ADD VALUE 'MOBILE_MONEY';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'PAYPAL';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'STRIPE';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'VISA';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'MASTERCARD';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."MaintenanceLog" ADD COLUMN     "assetId" TEXT;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "receiptId" TEXT;

-- AlterTable
ALTER TABLE "public"."Room" ADD COLUMN     "basePrice" DOUBLE PRECISION,
ADD COLUMN     "pricingPeriod" "public"."PricingPeriod" NOT NULL DEFAULT 'NIGHT';

-- CreateTable
CREATE TABLE "public"."RoomAsset" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "public"."AssetCategory" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "public"."AssetCondition" NOT NULL DEFAULT 'GOOD',
    "description" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "lastInspected" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."PaymentAccountType" NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "accountNumber" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "bankName" TEXT,
    "accountName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "providerData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" TEXT,
    "transactionId" TEXT,
    "bookingId" TEXT,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "description" TEXT,
    "items" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "status" "public"."ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "receiptType" "public"."ReceiptType" NOT NULL DEFAULT 'PAYMENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "paymentId" TEXT,
    "paymentAccountId" TEXT,
    "bookingId" TEXT,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "type" "public"."TransactionType" NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "method" "public"."PaymentMethod" NOT NULL,
    "provider" "public"."PaymentProvider",
    "providerTxnId" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feeType" "public"."FeeType" NOT NULL DEFAULT 'PERCENTAGE',
    "minAmount" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "currencies" TEXT NOT NULL DEFAULT 'GHS',
    "settings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomAsset_roomId_idx" ON "public"."RoomAsset"("roomId");

-- CreateIndex
CREATE INDEX "RoomAsset_category_idx" ON "public"."RoomAsset"("category");

-- CreateIndex
CREATE INDEX "RoomAsset_condition_idx" ON "public"."RoomAsset"("condition");

-- CreateIndex
CREATE INDEX "RoomAsset_name_idx" ON "public"."RoomAsset"("name");

-- CreateIndex
CREATE INDEX "RoomAsset_lastInspected_idx" ON "public"."RoomAsset"("lastInspected");

-- CreateIndex
CREATE INDEX "RoomAsset_createdAt_idx" ON "public"."RoomAsset"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentAccount_userId_idx" ON "public"."PaymentAccount"("userId");

-- CreateIndex
CREATE INDEX "PaymentAccount_type_idx" ON "public"."PaymentAccount"("type");

-- CreateIndex
CREATE INDEX "PaymentAccount_provider_idx" ON "public"."PaymentAccount"("provider");

-- CreateIndex
CREATE INDEX "PaymentAccount_isDefault_idx" ON "public"."PaymentAccount"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "public"."Receipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "public"."Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_transactionId_key" ON "public"."Receipt"("transactionId");

-- CreateIndex
CREATE INDEX "Receipt_receiptNumber_idx" ON "public"."Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_userId_idx" ON "public"."Receipt"("userId");

-- CreateIndex
CREATE INDEX "Receipt_bookingId_idx" ON "public"."Receipt"("bookingId");

-- CreateIndex
CREATE INDEX "Receipt_status_idx" ON "public"."Receipt"("status");

-- CreateIndex
CREATE INDEX "Receipt_receiptType_idx" ON "public"."Receipt"("receiptType");

-- CreateIndex
CREATE INDEX "Receipt_issuedAt_idx" ON "public"."Receipt"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionNumber_key" ON "public"."Transaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "Transaction_transactionNumber_idx" ON "public"."Transaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "public"."Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_paymentId_idx" ON "public"."Transaction"("paymentId");

-- CreateIndex
CREATE INDEX "Transaction_bookingId_idx" ON "public"."Transaction"("bookingId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "public"."Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "public"."Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_method_idx" ON "public"."Transaction"("method");

-- CreateIndex
CREATE INDEX "Transaction_provider_idx" ON "public"."Transaction"("provider");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "public"."Transaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_method_key" ON "public"."PaymentMethodConfig"("method");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_method_idx" ON "public"."PaymentMethodConfig"("method");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_provider_idx" ON "public"."PaymentMethodConfig"("provider");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_isActive_idx" ON "public"."PaymentMethodConfig"("isActive");

-- CreateIndex
CREATE INDEX "Booking_deletedAt_idx" ON "public"."Booking"("deletedAt");

-- CreateIndex
CREATE INDEX "MaintenanceLog_roomId_idx" ON "public"."MaintenanceLog"("roomId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_assetId_idx" ON "public"."MaintenanceLog"("assetId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_status_idx" ON "public"."MaintenanceLog"("status");

-- CreateIndex
CREATE INDEX "MaintenanceLog_priority_idx" ON "public"."MaintenanceLog"("priority");

-- CreateIndex
CREATE INDEX "MaintenanceLog_createdAt_idx" ON "public"."MaintenanceLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptId_key" ON "public"."Payment"("receiptId");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "public"."Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "public"."Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "public"."Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Room_pricingPeriod_idx" ON "public"."Room"("pricingPeriod");

-- AddForeignKey
ALTER TABLE "public"."RoomAsset" ADD CONSTRAINT "RoomAsset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "public"."PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAccount" ADD CONSTRAINT "PaymentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "public"."PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."RoomAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
