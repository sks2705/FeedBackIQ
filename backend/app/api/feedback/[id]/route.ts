import { ApiError, ok, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseUuidParam } from '@/lib/validation';
import { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest, context) => {
  await requireUser(request);
  const { id } = await context.params;
  const feedbackId = parseUuidParam(id);

  const record = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: { attachments: true },
  });

  if (!record) {
    throw new ApiError('NOT_FOUND', 'Feedback not found', 404);
  }

  const firstAttachment = record.attachments[0];
  const responseData = {
    ...record,
    attachments: undefined,
    attachment: firstAttachment
      ? {
          id: firstAttachment.id,
          originalName: firstAttachment.originalName,
          contentType: firstAttachment.contentType,
          sizeBytes: firstAttachment.sizeBytes,
          url: `/api/attachments/${firstAttachment.id}`,
        }
      : null,
  };

  return ok(responseData);
});
