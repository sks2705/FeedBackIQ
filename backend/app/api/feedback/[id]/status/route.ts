import { ApiError, ok, readJsonBody, withErrorHandling } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseUuidParam, updateStatusSchema } from '@/lib/validation';
import { NextRequest } from 'next/server';

export const PATCH = withErrorHandling(async (request: NextRequest, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const feedbackId = parseUuidParam(id);
  const body = await readJsonBody(request);
  const { status } = updateStatusSchema.parse(body);

  const existing = await prisma.feedback.findUnique({
    where: { id: feedbackId },
  });

  if (!existing) {
    throw new ApiError('NOT_FOUND', 'Feedback not found', 404);
  }

  const record = await prisma.feedback.update({
    where: { id: feedbackId },
    data: { status },
  });

  return ok(record);
});
