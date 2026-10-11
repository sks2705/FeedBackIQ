import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getObjectStream } from '@/lib/storage';
import { ApiError } from '@/lib/api';
import { Readable } from 'stream';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser(req);
    if (!session) {
      return NextResponse.json(
        { data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { data: null, error: { code: 'INVALID_INPUT', message: 'Attachment ID required' } },
        { status: 400 }
      );
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
        { status: 404 }
      );
    }

    const { stream } = await getObjectStream(attachment.objectKey);

    // Convert Node Readable stream to Web ReadableStream for Response
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', attachment.contentType);
    headers.set('Content-Disposition', `inline; filename="${attachment.originalName}"`);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Content-Security-Policy', "default-src 'none'");

    return new Response(webStream, {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to fetch attachment';
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}
