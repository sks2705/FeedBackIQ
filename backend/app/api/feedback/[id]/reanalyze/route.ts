import { analyzeFeedbackRecord } from '@/lib/analysisService';
import { ApiError, ok, withErrorHandling } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseUuidParam } from '@/lib/validation';
import { NextRequest } from 'next/server';

export const POST = withErrorHandling(async (request: NextRequest, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const feedbackId = parseUuidParam(id);

  const existing = await prisma.feedback.findUnique({
    where: { id: feedbackId },
  });

  if (!existing) {
    throw new ApiError('NOT_FOUND', 'Feedback not found', 404);
  }

  await analyzeFeedbackRecord(feedbackId);

  const record = await prisma.feedback.findUniqueOrThrow({
    where: { id: feedbackId },
  });

  return ok(record);
});
