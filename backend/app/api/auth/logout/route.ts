import { clearSessionCookie } from '@/lib/auth';
import { ok, withErrorHandling } from '@/lib/api';

export const POST = withErrorHandling(async () => {
  await clearSessionCookie();
  return ok({ message: 'Logged out successfully' });
});
