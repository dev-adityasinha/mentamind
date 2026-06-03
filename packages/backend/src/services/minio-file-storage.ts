import { FileStorage, UploadResult } from '@mentamind/shared';
import * as Minio from 'minio';

export interface MinioFileStorageConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

/**
 * FileStorage implementation backed by MinIO (S3-compatible).
 * Auto-creates the configured bucket on first operation if it doesn't exist.
 */
export class MinioFileStorage implements FileStorage {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private bucketEnsured = false;

  constructor(storageConfig: MinioFileStorageConfig) {
    this.client = new Minio.Client({
      endPoint: storageConfig.endPoint,
      port: storageConfig.port,
      useSSL: storageConfig.useSSL,
      accessKey: storageConfig.accessKey,
      secretKey: storageConfig.secretKey,
    });
    this.bucket = storageConfig.bucket;
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    await this.ensureBucket();

    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    const url = await this.getObjectUrl(key);

    return {
      key,
      url,
      size: buffer.length,
    };
  }

  async download(key: string): Promise<Buffer> {
    await this.ensureBucket();

    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err: Error) => reject(err));
    });
  }

  async delete(key: string): Promise<void> {
    await this.ensureBucket();
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    await this.ensureBucket();
    return this.client.presignedGetObject(
      this.bucket,
      key,
      expiresInSeconds,
    );
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureBucket();

    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch (error: unknown) {
      const minioError = error as { code?: string };
      if (
        minioError.code === 'NotFound' ||
        minioError.code === 'NoSuchKey'
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Ensures the configured bucket exists, creating it if necessary.
   * Only runs once per instance lifetime.
   */
  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) {
      return;
    }

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        console.log(`[MINIO] Created bucket: ${this.bucket}`);
      }
      this.bucketEnsured = true;
    } catch (error) {
      console.error(`[MINIO] Failed to ensure bucket "${this.bucket}":`, error);
      throw error;
    }
  }

  /**
   * Constructs a non-signed URL for the object.
   * This URL may not be publicly accessible depending on bucket policy.
   */
  private async getObjectUrl(key: string): Promise<string> {
    // For local development, construct the URL manually
    const protocol = (this.client as unknown as Record<string, unknown>).port === 443 ? 'https' : 'http';
    const endpoint = (this.client as unknown as Record<string, { host: string; port: number }>).options?.host ??
      'localhost';
    const port = (this.client as unknown as Record<string, { host: string; port: number }>).options?.port ?? 9000;
    return `${protocol}://${endpoint}:${port}/${this.bucket}/${key}`;
  }
}
