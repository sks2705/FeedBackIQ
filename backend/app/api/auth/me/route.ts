import { ok, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export const GET = withErrorHandling(async () => {
  const session = await requireUser();
  return ok({
    id: session.userId,
    email: session.email,
    role: session.role,
  });
});
