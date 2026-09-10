import { put, del } from '@vercel/blob';
import type { ObjectStore } from '../domain/ports.js';
/** Vercel Blob behind the storage port. Objects are public-unguessable; the API
 *  still gates every read by session and never hands the URL to the client. */
export interface BlobConfig { token: string; baseUrl: string }
export class BlobObjectStore implements ObjectStore {
  constructor(private config: BlobConfig) {}
  private url(key: string) { return `${this.config.baseUrl.replace(/\/$/, '')}/${key}`; }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    await put(key, Buffer.from(bytes), { access: 'public', addRandomSuffix: false, contentType,
      cacheControlMaxAge: 0, token: this.config.token, allowOverwrite: true });
  }
  async get(key: string) {
    const response = await fetch(this.url(key), { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Object fetch failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, contentType: response.headers.get('content-type') ?? 'application/octet-stream', length: bytes.length };
  }
  async getRange(key: string, start?: number, end?: number) {
    const range = start === undefined && end === undefined ? undefined
      : start === undefined ? `bytes=-${end}` : end === undefined ? `bytes=${start}-` : `bytes=${start}-${end}`;
    const response = await fetch(this.url(key), { headers: range ? { Range: range } : {}, signal: AbortSignal.timeout(60000) });
    if (!response.ok && response.status !== 206) throw new Error(`Object range fetch failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const total = response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
    return { bytes, contentType: response.headers.get('content-type') ?? 'application/octet-stream', length: total ? Number(total) : bytes.length };
  }
  async delete(key: string) { await del(this.url(key), { token: this.config.token }); }
}
