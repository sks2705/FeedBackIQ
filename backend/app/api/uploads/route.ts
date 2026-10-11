import { authRateLimit } from '@/lib/rateLimit';
import {
  ALLOWED_CONTENT_TYPES,
  getMaxUploadSizeBytes,
  sanitizeFilename,
  validateMagicBytes,
} from '@/lib/uploadValidation';
import { putObject } from '@/lib/storage';
import { ApiError } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    await authRateLimit(req, 'upload_file', 10, 60 * 1000);

    const maxSizeBytes = getMaxUploadSizeBytes();
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `File size exceeds the maximum limit of ${maxSizeBytes / (1024 * 1024)} MB`,
          },
        },
        { status: 413 }
      );
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid form data payload',
          },
        },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing or invalid "file" field in multipart form-data',
          },
        },
        { status: 400 }
      );
    }

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds limit of ${maxSizeBytes / (1024 * 1024)} MB`,
          },
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const detectedType = validateMagicBytes(buffer, file.type);
    if (!detectedType) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: `Invalid or unsupported file type. Allowed formats: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
          },
        },
        { status: 415 }
      );
    }

    const originalName = sanitizeFilename(file.name);
    let ext = 'png';
    if (detectedType === 'image/jpeg') ext = 'jpg';
    else if (detectedType === 'image/webp') ext = 'webp';

    const objectKey = `uploads/${crypto.randomUUID()}.${ext}`;

    await putObject(objectKey, Buffer.from(buffer), detectedType);

    return NextResponse.json(
      {
        data: {
          objectKey,
          originalName,
          contentType: detectedType,
          sizeBytes: buffer.length,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: `File upload failed: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
