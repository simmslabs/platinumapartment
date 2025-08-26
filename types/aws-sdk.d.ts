// Type declarations for AWS SDK modules
declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: {
      region: string;
      endpoint: string;
      credentials: {
        accessKeyId: string;
        secretAccessKey: string;
      };
      forcePathStyle?: boolean;
      apiVersion?: string;
    });
    send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
  }
  export class PutObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
      Body?: Buffer | string;
      ContentType?: string;
      ACL?: string;
      CacheControl?: string;
    });
  }
  export class DeleteObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
    });
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(
    client: import('@aws-sdk/client-s3').S3Client, 
    command: import('@aws-sdk/client-s3').PutObjectCommand, 
    options?: { expiresIn: number }
  ): Promise<string>;
}
