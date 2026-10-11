import { ApiError, ok, readJsonBody, withErrorHandling } from '@/lib/api';
import { setSessionCookie, signSession, verifyPassword } from '@/lib/auth';
import { authRateLimit } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/authValidation';
import { NextRequest } from 'next/server';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check rate limit: 5 attempts per minute per IP
  await authRateLimit(request, 'login', 5, 60 * 1000);

  const body = await readJsonBody(request);
  const input = loginSchema.parse(body);

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  // Constant-time style failure check to prevent user enumeration
  const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUU123456';
  const isValid = await verifyPassword(input.password, user ? user.passwordHash : dummyHash);

  if (!user || !isValid) {
    throw new ApiError('UNAUTHENTICATED', 'Invalid email or password', 401);
  }

  const sessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const token = await signSession(sessionPayload);
  await setSessionCookie(token);

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
  });
});
