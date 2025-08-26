# Image Storage - Base64 Only

This application now uses **base64-only image storage**. Cloudflare R2 integration has been removed for simplicity.

## How It Works

- All images are stored as base64 data URLs directly in the database
- No external cloud storage is required
- Images are automatically validated for size and format
- Maximum image size: 5MB (configurable)

## Supported Image Formats

- JPEG
- PNG
- GIF
- WebP
- All formats supported by browsers with `data:` URLs

## Configuration

No environment variables or external services are required. The system works out of the box.

## API Compatibility

All existing image upload APIs continue to work. The following functions maintain their interfaces but now use base64 storage:

- `uploadToR2()` - Now uploads to base64 storage
- `deleteFromR2()` - Now a no-op (deletion handled by database)
- `isR2Configured()` - Always returns `false`
- `getR2Stats()` - Returns base64 storage mode information

## Migration from R2

If you previously used Cloudflare R2:

1. All new images will automatically use base64 storage
2. Existing R2 images will continue to work if they're still accessible
3. The system will fallback gracefully for any missing R2 images
4. No manual migration is required

## Performance Considerations

- Base64 images are approximately 33% larger than binary data
- Images are stored directly in the database
- Consider implementing image optimization for better performance
- Large images (>1MB) may impact database performance

## Development

To test image uploads:

```bash
bun -e "
import { uploadToR2, isR2Configured } from './app/utils/r2.server.ts';
console.log('Base64 mode:', !isR2Configured());
"
```

## Legacy Files

The following files are kept for reference but are no longer used:
- `R2_SETUP.md` - Original R2 setup instructions
- `R2_MIGRATION.md` - R2 migration guide
- `app/routes/api.debug.r2.tsx` - R2 debug endpoint (now shows base64 mode)
