// Browser-side helper: upload a file straight to the private Vercel Blob store
// via a short-lived token from /api/blob/upload, bypassing the 4.5 MB serverless
// body limit. Returns the stored pathname to persist on the document row.
import { upload } from '@vercel/blob/client';

// Inlined at build time; true once the Blob store is provisioned.
export const BLOB_ENABLED = process.env.NEXT_PUBLIC_BLOB_ENABLED === '1';
export const BLOB_MAX_BYTES = 50 * 1024 * 1024;

export async function uploadToBlob(file: File, prefix: string): Promise<{ pathname: string; url: string; mime: string; size: number }> {
  const safe = (file.name || 'file').replace(/[^\w.\-]+/g, '_');
  const res = await upload(`${prefix}/${Date.now()}-${safe}`, file, {
    access: 'private',
    handleUploadUrl: '/api/blob/upload',
    contentType: file.type || undefined,
    multipart: file.size > 8 * 1024 * 1024, // chunked + parallel for big files
  });
  return { pathname: res.pathname, url: res.url, mime: file.type || 'application/octet-stream', size: file.size };
}
