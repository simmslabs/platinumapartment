# Soft Deletion Implementation

This document describes the soft deletion implementation for the apartment management booking system.

## Overview

Soft deletion allows bookings to be marked as deleted without permanently removing them from the database. This provides safety against accidental deletions and maintains data integrity for reporting and auditing purposes.

## Database Changes

### Schema Updates
- Added `deletedAt` field to the `Booking` model as an optional DateTime
- Added index on `deletedAt` for efficient queries
- The field is `null` for active bookings and contains a timestamp when soft deleted

## Features

### 1. Soft Delete
- **Who**: Admin, Manager, Staff roles can soft delete bookings
- **When**: Only PENDING or CANCELLED bookings can be soft deleted
- **How**: Sets `deletedAt` timestamp and changes status to CANCELLED
- **Visual**: Deleted bookings appear with red background and reduced opacity
- **Safety**: Asks for confirmation before deleting

### 2. Restore
- **Who**: Admin, Manager, Staff roles can restore bookings
- **What**: Clears the `deletedAt` field and resets status to PENDING
- **Access**: Only available for soft deleted bookings

### 3. Hard Delete (Permanent)
- **Who**: Only ADMIN role can permanently delete
- **Requirement**: Booking must be soft deleted first
- **Warning**: Requires double confirmation as it's irreversible
- **Effect**: Permanently removes booking from database

### 4. View Management
- **Default**: Shows only active (non-deleted) bookings
- **Toggle**: "Show Deleted" / "Hide Deleted" button for Admin/Manager
- **Filter**: Deleted bookings are visually distinguished with:
  - Red background
  - Reduced opacity (60%)
  - "DELETED" badge
  - Different action buttons (Restore/Hard Delete)

## User Interface

### Booking List
- **Active bookings**: Normal appearance with standard actions
- **Deleted bookings**: Red background, "DELETED" badge, restore/hard delete actions
- **Toggle button**: Switch between showing/hiding deleted bookings

### Action Buttons
- **Soft Delete**: Orange trash icon with tooltip "Soft Delete (can be restored)"
- **Restore**: Green "Restore" button
- **Hard Delete**: Red trash icon with tooltip "Permanently Delete (cannot be restored)"

## API Endpoints

### Query Parameters
- `?showDeleted=true` - Include soft deleted bookings in results
- `?showDeleted=false` or default - Exclude soft deleted bookings

### Form Actions
- `intent=delete` - Soft delete a booking
- `intent=restore` - Restore a soft deleted booking  
- `intent=hard-delete` - Permanently delete a booking

## Utility Functions

The `soft-delete.server.ts` utility provides:

- `getBookings()` - Get bookings with deletion filtering options
- `softDeleteBooking()` - Safely soft delete a booking
- `restoreBooking()` - Restore a soft deleted booking
- `hardDeleteBooking()` - Permanently delete a booking
- `getSoftDeleteStats()` - Get deletion statistics
- `cleanupOldDeletedBookings()` - Clean up old deleted bookings (background job)

## Best Practices

### For Users
1. Use soft delete for most deletion needs
2. Only use hard delete when absolutely necessary
3. Regularly review deleted bookings for potential cleanup
4. Double-check before hard deleting (it's permanent)

### For Developers
1. Always use soft deletion by default in queries (`deletedAt: null`)
2. Use utility functions for consistent behavior
3. Consider implementing automatic cleanup of old deleted records
4. Maintain audit trails for deletion actions

## Security Considerations

- Only authorized roles can perform deletions
- Hard delete requires highest privilege level (ADMIN)
- All deletion actions are logged
- Confirmation required for both soft and hard deletes
- Room availability is updated when bookings are deleted/restored

## Future Enhancements

- Audit log for all deletion/restoration actions
- Bulk operations for managing deleted bookings
- Automated cleanup of old deleted bookings
- Recovery statistics and reporting
- Email notifications for booking deletions/restorations
