import { ApiResponse } from './types';

export class ApiFetchError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiFetchError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const body: ApiResponse<T> = await response.json().catch(() => {
    throw new ApiFetchError(
      'INVALID_RESPONSE',
      `Server returned invalid JSON response (Status ${response.status})`,
      response.status
    );
  });

  if (!response.ok || body.error) {
    const error = body.error;
    throw new ApiFetchError(
      error?.code || 'HTTP_ERROR',
      error?.message || `Request failed with status ${response.status}`,
      response.status,
      error?.details
    );
  }

  return {
    data: body.data,
    meta: body.meta,
  };
}
