-- CreateTable
CREATE TABLE "SecurityDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    "refundAmount" REAL,
    "deductionAmount" REAL DEFAULT 0,
    "deductionReason" TEXT,
    "damageReport" TEXT,
    "processedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityDeposit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDeposit_bookingId_key" ON "SecurityDeposit"("bookingId");
