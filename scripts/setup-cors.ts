import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local manually
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  try {
    console.log('Configuring CORS for bucket:', process.env.R2_BUCKET_NAME);
    const command = new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['*'], // Allow all origins for testing/Vercel
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });

    await r2.send(command);
    console.log('Successfully applied CORS policy!');
  } catch (error) {
    console.error('Error applying CORS:', error);
  }
}

main();
