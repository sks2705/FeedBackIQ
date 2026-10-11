import { analyzeFeedbackRecord } from '@/lib/analysisService';
import { ApiError, ok, readJsonBody, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { queryFeedbackPage } from '@/lib/feedbackQuery';
import { prisma } from '@/lib/prisma';
import { authRateLimit } from '@/lib/rateLimit';
import { headObject } from '@/lib/storage';
import { createFeedbackSchema, parseListQuery } from '@/lib/validation';
import { NextRequest } from 'next/server';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Rate limit public feedback submission: 10 per minute per IP
  await authRateLimit(request, 'create_feedback', 10, 60 * 1000);

  const body = await readJsonBody(request);
  const input = createFeedbackSchema.parse(body);

  if (input.attachmentKey) {
    const existsInS3 = await headObject(input.attachmentKey);
    if (!existsInS3) {
      throw new ApiError('INVALID_INPUT', 'Attachment file not found in storage', 400);
    }

    const alreadyLinked = await prisma.attachment.findUnique({
      where: { objectKey: input.attachmentKey },
    });

    if (alreadyLinked) {
      throw new ApiError('INVALID_INPUT', 'Attachment key is already linked to another feedback item', 400);
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const fb = await tx.feedback.create({
      data: {
        message: input.message,
        productName: input.productName,
        userName: input.userName,
        userEmail: input.userEmail,
        source: input.source,
        analysisStatus: 'PENDING',
        isSeed: false,
      },
    });

    if (input.attachmentKey) {
      await tx.attachment.create({
        data: {
          feedbackId: fb.id,
          objectKey: input.attachmentKey,
          originalName: input.attachmentName || 'screenshot.png',
          contentType: input.attachmentType || 'image/png',
          sizeBytes: input.attachmentSize || 100,
        },
      });
    }

    return fb;
  });

  await analyzeFeedbackRecord(created.id);

  const record = await prisma.feedback.findUniqueOrThrow({
    where: { id: created.id },
    include: { attachments: true },
  });

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

  return ok(responseData, undefined, 201);
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireUser(request);
  const query = parseListQuery(request.nextUrl.searchParams);
  const { data, total } = await queryFeedbackPage(query);

  const formattedData = data.map((item) => {
    const rawAttachments = (item as unknown as { attachments?: Array<{ id: string; originalName: string; contentType: string; sizeBytes: number }> }).attachments;
    const first = rawAttachments && rawAttachments.length > 0 ? rawAttachments[0] : null;
    return {
      ...item,
      attachments: undefined,
      attachment: first
        ? {
            id: first.id,
            originalName: first.originalName,
            contentType: first.contentType,
            sizeBytes: first.sizeBytes,
            url: `/api/attachments/${first.id}`,
          }
        : null,
    };
  });

  return ok(formattedData, {
    page: query.page,
    pageSize: query.pageSize,
    total,
  });
});
