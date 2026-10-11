import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ApiErrorDetail = {
  field: string;
  message: string;
};

export type ApiSuccessBody<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200): NextResponse<ApiSuccessBody<T>> {
  const body: ApiSuccessBody<T> = meta ? { data, meta } : { data };
  return NextResponse.json(body, { status });
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const error: ApiErrorBody['error'] = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return NextResponse.json({ error }, { status });
}

export function zodDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'root',
    message: issue.message,
  }));
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Invalid JSON body', 400);
  }
}

type RouteContext = {
  params: Promise<Record<string, string>>;
};

type RouteHandler = (request: NextRequest, context: RouteContext) => Promise<Response> | Response;

function isNextInternalError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string'
  );
}

export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (isNextInternalError(error)) {
        throw error;
      }

      if (error instanceof ApiError) {
        return fail(error.code, error.message, error.status, error.details);
      }

      if (error instanceof ZodError) {
        return fail('VALIDATION_ERROR', 'Request validation failed', 400, zodDetails(error));
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return fail('NOT_FOUND', 'Resource not found', 404);
        }
        if (error.code === 'P2023') {
          return fail('VALIDATION_ERROR', 'Invalid identifier', 400, [
            { field: 'id', message: 'Must be a valid UUID' },
          ]);
        }
        console.error('[api] Prisma error', error.code, error.message);
        return fail('INTERNAL_ERROR', 'An unexpected error occurred', 500);
      }

      console.error('[api] Unhandled error', error);
      return fail('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
  };
}
