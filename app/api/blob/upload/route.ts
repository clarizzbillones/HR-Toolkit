export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BLOB_MAX_BYTES } from '@/lib/blob';

// Authorizes a direct browser → Vercel Blob upload. The file itself never passes
// through this function (so it isn't bound by Vercel's 4.5 MB request limit);
// we only mint a short-lived, size-capped client token for a signed-in user.
export async function POST(req: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        maximumSizeInBytes: BLOB_MAX_BYTES,
        addRandomSuffix: true,
      }),
      // Metadata (the DB row) is written by the client once upload() resolves,
      // so there's nothing to do here.
      onUploadCompleted: async () => { /* no-op */ },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Upload authorization failed' }, { status: 400 });
  }
}
