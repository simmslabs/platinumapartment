# Migrating to Cloudflare R2 for Existing Projects

This guide explains how to migrate from base64 image storage to Cloudflare R2 for existing apartment management systems.

## Migration Strategy

The R2 integration is designed to be backward compatible. When R2 is not configured, the system automatically falls back to base64 storage in the database.

## Step 1: Set Up Cloudflare R2

Follow the setup instructions in `R2_SETUP.md` to:
1. Create an R2 bucket
2. Generate API credentials
3. Configure environment variables

## Step 2: Test R2 Configuration

Before migrating data, test that R2 is working:

```bash
# Check if R2 is configured
curl -X POST http://localhost:3000/api/images \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "intent=status"
```

Expected response:
```json
{
  "r2Configured": true,
  "message": "R2 storage is available"
}
```

## Step 3: Migration Options

You have several options for migrating existing base64 images:

### Option A: Gradual Migration (Recommended)
- Keep existing base64 images as-is
- New uploads automatically use R2
- Migrate images individually when users update their profiles

### Option B: Bulk Migration Script
- Create a script to migrate all images at once
- More complex but faster for large datasets

### Option C: Hybrid Approach
- Migrate profile pictures first (smaller, fewer)
- Keep room images as base64 initially
- Migrate room images during scheduled maintenance

## Step 4: Gradual Migration Implementation

The system is already set up for gradual migration. When a user uploads a new profile picture:

1. **New Image**: Uploaded to R2, URL stored in database
2. **Image Update**: Old base64 data replaced with R2 URL
3. **Image Deletion**: R2 images are automatically cleaned up

No additional code changes needed for gradual migration.

## Step 5: Bulk Migration Script (Optional)

If you want to migrate all images immediately, create this migration script:

```javascript
// scripts/migrate-to-r2.js
import { PrismaClient } from '@prisma/client';
import { processAndStoreImage } from '../app/utils/image.server.js';

const db = new PrismaClient();

async function migrateProfilePictures() {
  console.log('Starting profile picture migration...');
  
  const usersWithImages = await db.user.findMany({
    where: {
      profilePicture: {
        startsWith: 'data:image/'
      }
    },
    select: {
      id: true,
      profilePicture: true,
      firstName: true,
      lastName: true
    }
  });

  console.log(`Found ${usersWithImages.length} users with base64 images`);

  for (const user of usersWithImages) {
    try {
      console.log(`Migrating image for ${user.firstName} ${user.lastName}...`);
      
      const result = await processAndStoreImage(
        user.profilePicture,
        'profile.jpg',
        'profile-pictures',
        user.id
      );

      if (result.success && result.imageUrl && result.isR2) {
        await db.user.update({
          where: { id: user.id },
          data: { profilePicture: result.imageUrl }
        });
        
        console.log(`✓ Migrated ${user.firstName} ${user.lastName}`);
      } else {
        console.error(`✗ Failed to migrate ${user.firstName} ${user.lastName}:`, result.error);
      }
    } catch (error) {
      console.error(`✗ Error migrating ${user.firstName} ${user.lastName}:`, error);
    }
  }

  console.log('Profile picture migration completed!');
}

// Run the migration
migrateProfilePictures()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

Run the migration:
```bash
bun scripts/migrate-to-r2.js
```

## Step 6: Monitor Storage Usage

After migration, monitor your storage usage:

### Database Size Reduction
Check database size before and after migration:
```sql
SELECT pg_size_pretty(pg_database_size('your_database_name'));
```

### R2 Usage
Monitor R2 usage in the Cloudflare dashboard:
- Storage used
- Requests per day
- Costs

## Step 7: Cleanup (Optional)

After successful migration and verification:

### Clean up base64 data
```sql
-- Verify all images are migrated
SELECT COUNT(*) FROM users WHERE profile_picture LIKE 'data:image/%';

-- If count is 0, migration is complete
```

### Update application for R2-only mode
If you want to disable base64 fallback after migration:

```typescript
// In r2.server.ts, remove fallback logic
export async function uploadToR2(imageData: string | Buffer, fileName: string, folder: string = 'uploads'): Promise<UploadResult> {
  if (!r2Client) {
    throw new Error("R2 is required but not configured");
  }
  // ... rest of function
}
```

## Rollback Plan

If you need to rollback to base64 storage:

1. **Stop new uploads**: Comment out R2 configuration
2. **Verify fallback**: New uploads should use base64
3. **Data integrity**: Existing R2 URLs will still work
4. **Re-migration**: You can always migrate to R2 again later

## Performance Considerations

### Before Migration (Base64)
- ✗ Large database size
- ✗ Slower queries with image data
- ✗ Memory usage for image serving
- ✓ Simple setup

### After Migration (R2)
- ✓ Smaller database size
- ✓ Faster queries
- ✓ CDN-powered image delivery
- ✓ Unlimited storage scalability
- ✓ Cost-effective (no egress fees)

## Troubleshooting

### Migration Issues

**"R2 client not configured" error**
- Check environment variables
- Verify API token permissions
- Test R2 connectivity

**Images not displaying after migration**
- Check bucket public access settings
- Verify custom domain configuration
- Check CORS settings if needed

**High migration failure rate**
- Check image data integrity
- Verify network connectivity
- Consider smaller batch sizes

### Performance Issues

**Slow migration**
- Process images in smaller batches
- Add delays between uploads
- Run during off-peak hours

**Database locked during migration**
- Use transactions for batch updates
- Consider read replicas for large datasets

## Best Practices

1. **Test thoroughly**: Always test in staging first
2. **Backup first**: Create database backup before migration
3. **Monitor closely**: Watch for errors during migration
4. **Gradual rollout**: Consider migrating user groups gradually
5. **Have rollback plan**: Know how to revert if needed

## Cost Estimation

Migration costs are minimal with Cloudflare R2:

**One-time migration costs:**
- Upload operations: ~$0.0045 per 1,000 images
- Storage: $0.015 per GB per month

**Example:** Migrating 1,000 profile pictures (average 100KB each):
- Storage cost: ~$0.0015/month
- Upload cost: ~$0.0045 one-time
- **Total first month**: ~$0.006

Compare this to potential database hosting savings from smaller database size.

## Support

For migration assistance:
1. Test in development environment first
2. Check application logs for detailed error messages
3. Monitor Cloudflare R2 dashboard for usage patterns
4. Contact support if you encounter persistent issues
