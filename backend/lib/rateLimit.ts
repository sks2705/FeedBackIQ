import { ApiError } from './api';
import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate limiter store for local single-instance deployment
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Checks in-memory rate limit for request IP.
 * NOTE: This in-memory limiter is designed for single-instance local use.
 */
export async function checkRateLimit(
  ip: string,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const key = `${keyPrefix}:${ip}`;
  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function authRateLimit(
  request: NextRequest,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number
): Promise<void> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, keyPrefix, maxRequests, windowMs);

  if (!allowed) {
    throw new ApiError(
      'TOO_MANY_REQUESTS',
      `Too many requests. Please try again after ${retryAfterSeconds} seconds.`,
      429,
      { retryAfterSeconds }
    );
  }
}
