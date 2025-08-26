# Cloudflare R2 Integration Setup Guide

This guide explains how to set up Cloudflare R2 Object Storage for image uploads in the apartment management system.

## What is Cloudflare R2?

Cloudflare R2 is an S3-compatible object storage service with zero egress fees, making it cost-effective for storing and serving images, documents, and other files.

## Benefits of R2 Integration

- **Cost-effective**: No egress fees for data transfer
- **Fast**: Global edge network for fast image delivery
- **Scalable**: Handle unlimited image uploads
- **S3-compatible**: Works with existing AWS SDK tools
- **Automatic optimization**: Can be paired with Cloudflare Images for automatic optimization

## Setup Instructions

### 1. Create Cloudflare R2 Bucket

1. Login to your Cloudflare dashboard
2. Navigate to **R2 Object Storage**
3. Click **"Create bucket"**
4. Choose a bucket name (e.g., `apartment-images`)
5. Select a region close to your users
6. Configure public access settings

### 2. Get R2 API Credentials

1. In the Cloudflare dashboard, go to **R2 Object Storage**
2. Click **"Manage R2 API tokens"**
3. Click **"Create API token"**
4. Configure permissions:
   - **Permissions**: Object Read & Write
   - **Bucket Resources**: Include your bucket
5. Save the **Access Key ID** and **Secret Access Key**

### 3. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-custom-domain.com  # Optional: Your custom domain
```

### 4. Find Your Account ID

1. In Cloudflare dashboard, look at the right sidebar
2. Copy the **Account ID** under your account name
3. Use this as `R2_ACCOUNT_ID`

### 5. Custom Domain (Optional but Recommended)

For better performance and branding:

1. In R2 bucket settings, go to **Custom Domains**
2. Add your custom domain (e.g., `images.yourdomain.com`)
3. Configure DNS records as instructed
4. Update `R2_PUBLIC_URL` with your custom domain

## Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Your Cloudflare account ID | `abc123def456...` |
| `R2_ACCESS_KEY_ID` | R2 API access key ID | `a1b2c3d4e5f6...` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret access key | `secretkey123...` |
| `R2_BUCKET_NAME` | Name of your R2 bucket | `apartment-images` |
| `R2_PUBLIC_URL` | Custom domain for serving images (optional) | `https://images.yourdomain.com` |

## Features Enabled

When R2 is properly configured, the following features are enabled:

### Profile Pictures
- ✅ Automatic image upload to R2
- ✅ Image compression and optimization
- ✅ Secure storage with public access
- ✅ Fallback to base64 storage if R2 fails

### Room Images
- ✅ Gallery image uploads
- ✅ Multiple image variants (thumbnail, medium, large)
- ✅ Organized folder structure
- ✅ Automatic cleanup of old images

### Benefits Over Base64 Storage
- **Better Performance**: Images load faster from CDN
- **Database Efficiency**: Smaller database size
- **Scalability**: No storage limits
- **Cost Effective**: Pay only for storage, not bandwidth

## Fallback Behavior

If R2 is not configured or fails:
- Images are stored as base64 in the database
- All functionality continues to work
- No user-facing errors
- Admin sees warnings in logs

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Bucket Permissions**: Configure least-privilege access
3. **CORS**: Set up CORS policies if needed for direct uploads
4. **Content Policy**: Consider implementing content moderation

## Monitoring and Maintenance

### Usage Monitoring
- Check R2 dashboard for storage usage
- Monitor API request counts
- Set up billing alerts

### Image Cleanup
- Old profile pictures are automatically deleted when updated
- Consider implementing cleanup for unused images
- Set up lifecycle rules for automatic deletion

## Troubleshooting

### Common Issues

**Images not uploading**
- Check environment variables are set correctly
- Verify API token permissions
- Check network connectivity

**Images not displaying**
- Verify bucket public access settings
- Check custom domain configuration
- Ensure CORS settings allow your domain

**High costs**
- Monitor request patterns
- Consider implementing image caching
- Optimize image sizes before upload

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

This will show detailed R2 operation logs in the console.

## Production Deployment

### Docker
When deploying with Docker, ensure all R2 environment variables are passed:

```bash
docker run -d \
  -e R2_ACCOUNT_ID=your_account_id \
  -e R2_ACCESS_KEY_ID=your_access_key \
  -e R2_SECRET_ACCESS_KEY=your_secret_key \
  -e R2_BUCKET_NAME=your_bucket \
  -e R2_PUBLIC_URL=https://your-domain.com \
  your-app:latest
```

### Railway/Render/Vercel
Add all R2 environment variables in your platform's environment settings.

## Cost Estimation

Cloudflare R2 pricing (as of 2024):
- **Storage**: $0.015 per GB per month
- **Class A Operations** (write): $4.50 per million requests
- **Class B Operations** (read): $0.36 per million requests
- **Egress**: $0.00 (free!)

Example monthly cost for small apartment system:
- 10GB images: $0.15
- 100,000 image views: $0.04
- 1,000 uploads: $0.0045
- **Total**: ~$0.20/month

## Support

For issues with this integration:
1. Check Cloudflare R2 documentation
2. Verify environment variable configuration
3. Check application logs for error details
4. Contact Cloudflare support for R2-specific issues
