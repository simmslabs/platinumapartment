-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "blockId" TEXT,
    "block" TEXT NOT NULL DEFAULT 'A',
    "floor" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "pricePerNight" REAL NOT NULL,
    "description" TEXT,
    "amenities" TEXT,
    "images" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("amenities", "block", "blockId", "capacity", "createdAt", "description", "floor", "id", "images", "number", "pricePerNight", "status", "type", "updatedAt") SELECT "amenities", "block", "blockId", "capacity", "createdAt", "description", "floor", "id", "images", "number", "pricePerNight", "status", "type", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_number_blockId_key" ON "Room"("number", "blockId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
