# Asset Management System

## Overview

The Asset Management System allows you to track, manage, and maintain all assets within rooms in your apartment complex. This includes furniture, electronics, bathroom fixtures, kitchen equipment, and more.

## Features

### 1. Comprehensive Asset Tracking
- **Categories**: Furniture, Electronics, Bathroom, Kitchen, Bedding, Lighting, Safety, Decoration, Cleaning, Other
- **Conditions**: Excellent, Good, Fair, Poor, Damaged, Broken, Missing
- **Asset Details**: Name, description, quantity, serial number, purchase date, warranty expiry
- **Inspection Tracking**: Last inspection date with ability to mark as inspected

### 2. Asset Management Dashboard
- **Overview Statistics**: Total assets, assets needing attention, inspection overdue
- **Asset Health Metrics**: Progress bar showing percentage of assets in good/excellent condition
- **Search and Filtering**: Filter by category, condition, or search by name/room/description
- **Asset Cards**: Visual representation with condition badges and quick actions

### 3. Room Integration
- **Room-Specific Assets**: View all assets for a specific room from the room detail page
- **Asset Addition**: Add new assets directly to rooms
- **Room Information**: Each asset shows which room it belongs to with room type and block

### 4. Asset Detail Management
- **Edit Asset Information**: Update name, category, condition, quantity, description, notes
- **Inspection Management**: Mark assets as inspected with automatic date tracking
- **Maintenance Integration**: Create maintenance tasks for specific assets
- **Asset History**: Track changes and maintenance history (coming soon)

## Database Schema

### RoomAsset Model
```prisma
model RoomAsset {
  id          String        @id @default(cuid())
  roomId      String        // Foreign key to Room
  name        String        // Asset name (e.g., "Bed", "TV", "Chair")
  category    AssetCategory // Category of the asset
  quantity    Int           @default(1) // Number of this asset in the room
  condition   AssetCondition @default(GOOD) // Current condition
  description String?       // Additional details about the asset
  serialNumber String?      // Serial number or identifier for tracked items
  purchaseDate DateTime?    // When the asset was purchased
  warrantyExpiry DateTime?  // Warranty expiration date
  lastInspected DateTime?   // Last inspection date
  notes       String?       // Maintenance notes or observations
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Relations
  room        Room            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  maintenance MaintenanceLog[] // Maintenance tasks for this asset
}
```

### Asset Categories
- **FURNITURE**: Beds, chairs, tables, wardrobes, etc.
- **ELECTRONICS**: TV, AC, refrigerator, microwave, etc.
- **BATHROOM**: Shower, toilet, sink, mirror, etc.
- **KITCHEN**: Stove, oven, utensils, dishes, etc.
- **BEDDING**: Mattress, pillows, blankets, sheets, etc.
- **LIGHTING**: Lamps, ceiling lights, etc.
- **SAFETY**: Smoke detectors, fire extinguisher, etc.
- **DECORATION**: Artwork, plants, curtains, etc.
- **CLEANING**: Vacuum, cleaning supplies, etc.
- **OTHER**: Miscellaneous items

### Asset Conditions
- **EXCELLENT**: Like new, perfect condition
- **GOOD**: Good condition, minor wear
- **FAIR**: Shows wear but functional
- **POOR**: Significant wear, needs attention
- **DAMAGED**: Damaged but repairable
- **BROKEN**: Not functional, needs replacement
- **MISSING**: Asset is missing/lost

## Routes and Navigation

### Main Routes
- `/dashboard/assets` - Asset management dashboard with overview and filtering
- `/dashboard/assets/[assetId]` - Individual asset detail and edit page
- `/dashboard/rooms/[roomId]/assets/new` - Add new asset to a specific room
- `/dashboard/rooms/[roomId]` - Room detail page showing all room assets

### Navigation Access
The Assets menu is available in the Property Management section of the sidebar navigation. Access levels:
- **ADMIN/MANAGER**: Full access to all asset management features
- **STAFF**: View and edit access to assets
- **GUEST**: No access to asset management

## Usage Instructions

### Adding New Assets
1. Navigate to a specific room detail page
2. Click "Add Asset" in the Assets section
3. Fill in asset details:
   - Name (required)
   - Category (required)
   - Condition (required)
   - Quantity (required, minimum 1)
   - Description (optional)
   - Serial Number (optional for tracking)
   - Notes (optional)
4. Submit to create the asset

### Managing Existing Assets
1. Go to `/dashboard/assets` for overview of all assets
2. Use search and filters to find specific assets
3. Click on an asset card to view details
4. Edit asset information as needed
5. Mark assets as inspected when maintenance checks are completed
6. Create maintenance tasks for assets needing repair

### Asset Inspection Workflow
1. Regular inspections should be performed every 6 months
2. Assets with no inspection date or inspections older than 6 months appear in "Need Inspection"
3. Use the "Mark as Inspected Today" button to update inspection date
4. Add notes about asset condition during inspection

### Maintenance Integration
1. Assets can be linked to maintenance tasks
2. Create maintenance tasks for specific assets from the asset detail page
3. Track maintenance history for each asset (coming soon)
4. Monitor asset condition changes over time

## Alerts and Monitoring

### Asset Health Alerts
- **Red Alert**: Assets in poor, damaged, broken, or missing condition requiring immediate attention
- **Orange Alert**: Assets needing inspection (over 6 months since last inspection)
- **Health Percentage**: Shows percentage of assets in good/excellent condition

### Asset Statistics
- Total asset count across all rooms
- Assets by condition breakdown
- Assets by category breakdown
- Assets requiring attention count
- Assets requiring inspection count

## Best Practices

### Asset Naming
- Use descriptive names: "Queen Size Bed" instead of just "Bed"
- Include brand/model when relevant: "Samsung 32inch Smart TV"
- Be consistent with naming conventions

### Serial Number Tracking
- Record serial numbers for valuable electronics
- Use format: "TV-001-2024" for internal tracking
- Include purchase year in serial numbers

### Condition Assessment
- **Excellent**: New or like-new condition, no visible wear
- **Good**: Minor wear but fully functional, good appearance
- **Fair**: Visible wear but still functional, may need minor attention
- **Poor**: Significant wear, functionality compromised, needs attention
- **Damaged**: Broken but repairable, safety not compromised
- **Broken**: Not functional, needs replacement
- **Missing**: Asset cannot be located, may be lost or stolen

### Inspection Schedule
- High-value electronics: Every 3 months
- Furniture: Every 6 months
- Safety equipment: Every 3 months
- Lighting: Every 6 months
- Bathroom fixtures: Every 3 months

## Reporting and Analytics

### Current Reports Available
- Asset health overview with condition breakdown
- Assets needing attention list
- Assets requiring inspection list
- Asset distribution by category
- Room-wise asset summary

### Future Enhancements
- Asset depreciation tracking
- Maintenance cost analysis
- Asset replacement scheduling
- QR code generation for easy scanning
- Mobile asset inspection app
- Asset warranty tracking and alerts
- Bulk asset import/export
- Asset photo uploads
- Asset location tracking within rooms

## API Integration

### Asset CRUD Operations
- `GET /dashboard/assets` - List all assets with filtering
- `GET /dashboard/assets/[id]` - Get specific asset details
- `POST /dashboard/assets/[id]` - Update asset information
- `POST /dashboard/rooms/[roomId]/assets/new` - Create new asset

### Maintenance Integration
- Assets can be linked to maintenance tasks via `assetId` field
- Maintenance history tracked per asset
- Automatic maintenance task creation for poor condition assets

## Seeding Sample Data

To populate your database with sample assets for testing:

```bash
bun tsx prisma/seed-assets.ts
```

This will create sample assets across your existing rooms with various conditions and categories.

## Support and Troubleshooting

### Common Issues
1. **Assets not showing**: Ensure rooms exist before creating assets
2. **Permission errors**: Check user role permissions for asset management
3. **Search not working**: Clear search filters and try again

### Data Integrity
- Assets are automatically deleted when their associated room is deleted (CASCADE)
- Asset conditions should be updated regularly during inspections
- Serial numbers should be unique where applicable

### Performance Considerations
- Asset queries are indexed on room, category, condition, and inspection date
- Large asset inventories benefit from category and condition filtering
- Regular database maintenance recommended for optimal performance
