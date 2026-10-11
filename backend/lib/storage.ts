import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    s3ClientInstance = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  } else {
    // Uses standard AWS SDK default credential chain (IAM roles, env vars, etc.)
    s3ClientInstance = new S3Client({ region });
  }

  return s3ClientInstance;
}

export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not configured');
  }
  return bucket;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function headObject(key: string): Promise<boolean> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getObjectStream(
  key: string
): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  const client = getS3Client();
  const bucket = getBucketName();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`S3 object body is empty for key: ${key}`);
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

export async function checkStorage(): Promise<boolean> {
  try {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      return false;
    }

    const client = getS3Client();
    // Check the bucket itself instead of probing a fake object key.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      await client.send(
        new HeadBucketCommand({
          Bucket: bucket,
        }),
        { abortSignal: controller.signal }
      );
      return true;
    } catch (err: unknown) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}
