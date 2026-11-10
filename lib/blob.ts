// Vercel Blob storage helpers. Large documents are uploaded directly from the
// browser to a PRIVATE Blob store (bypassing the 4.5 MB serverless body limit),
// and we keep only a small reference in the database. Downloads are served
// through short-lived signed URLs so the files are never publicly reachable.
// (Server-only module — imported solely by API route handlers.)
import { issueSignedToken, presignUrl, del } from '@vercel/blob';

// Max upload size (also enforced when the client token is minted).
export const BLOB_MAX_BYTES = 50 * 1024 * 1024;

export function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// A stored reference packs the blob pathname + mime + original filename into a
// single TEXT column, marked with a "blob:" sentinel so it never collides with
// the legacy base64 / data-URL values already in those columns.
export interface BlobRef { p: string; m: string; n?: string }
export function makeBlobRef(pathname: string, mime: string, name?: string): string {
  return 'blob:' + JSON.stringify({ p: pathname, m: mime || 'application/octet-stream', n: name });
}
export function isBlobRef(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('blob:');
}
export function parseBlobRef(v: string): BlobRef | null {
  try { const o = JSON.parse(v.slice(5)); return o && typeof o.p === 'string' ? o : null; } catch { return null; }
}

// A time-limited GET URL for a private blob, for a redirect download.
export async function signedDownloadUrl(pathname: string, ttlMs = 5 * 60 * 1000): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('Blob storage not configured');
  const signed = await issueSignedToken({ pathname, operations: ['get'], token });
  const { presignedUrl } = await presignUrl(signed, {
    access: 'private', operation: 'get', pathname, validUntil: Date.now() + ttlMs,
  });
  return presignedUrl;
}

// Best-effort delete of a stored blob when its DB row is removed (keeps storage
// from accumulating orphans). Never throws.
export async function deleteBlobQuietly(pathname: string): Promise<void> {
  try { if (process.env.BLOB_READ_WRITE_TOKEN) await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* ignore */ }
}
