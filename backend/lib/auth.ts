import bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { ApiError } from './api';

export interface UserSessionPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

const JWT_COOKIE_NAME = 'feedbackiq_session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'super-secret-jwt-token-at-least-32-chars-long';
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJwtSecret());
}

export async function verifySession(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      (payload.role === 'ADMIN' || payload.role === 'VIEWER')
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role as 'ADMIN' | 'VIEWER',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(JWT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSession(req?: Request): Promise<UserSessionPayload | null> {
  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${JWT_COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) {
      return verifySession(match[1]);
    }
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(JWT_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
  } catch {
    return null;
  }
}

export async function requireUser(req?: Request): Promise<UserSessionPayload> {
  const session = await getSession(req);
  if (!session) {
    throw new ApiError('UNAUTHENTICATED', 'Authentication required', 401);
  }
  return session;
}

export async function requireAdmin(req?: Request): Promise<UserSessionPayload> {
  const session = await requireUser(req);
  if (session.role !== 'ADMIN') {
    throw new ApiError('FORBIDDEN', 'Admin access required', 403);
  }
  return session;
}
