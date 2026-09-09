import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { ObjectStore } from '../domain/ports.js';
export interface S3Config { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; forcePathStyle?: boolean }
export class S3ObjectStore implements ObjectStore {
  private client: S3Client;
  constructor(private config: S3Config) {
    this.client = new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: config.forcePathStyle ?? true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, maxAttempts: 2 });
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: bytes, ContentType: contentType }), { abortSignal: AbortSignal.timeout(60000) });
  }
  async get(key: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), { abortSignal: AbortSignal.timeout(60000) });
    if (!result.Body) throw new Error('Object response has no body');
    return { bytes: await result.Body.transformToByteArray(), contentType: result.ContentType ?? 'application/octet-stream' };
  }
  async delete(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }), { abortSignal: AbortSignal.timeout(60000) }); }
}
