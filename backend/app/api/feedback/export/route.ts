import { withErrorHandling } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { queryFeedbackExport } from '@/lib/feedbackQuery';
import { parseListQuery } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

const CSV_HEADERS = [
  'id',
  'createdAt',
  'updatedAt',
  'productName',
  'userName',
  'userEmail',
  'source',
  'message',
  'sentiment',
  'category',
  'priority',
  'status',
  'analysisStatus',
  'summary',
  'confidence',
  'modelVersion',
  'analyzedAt',
  'isSeed',
];

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireUser(request);
  const query = parseListQuery(request.nextUrl.searchParams);
  const rows = await queryFeedbackExport(query);

  const csv = toCsv(
    CSV_HEADERS,
    rows.map((row) => [
      row.id,
      row.createdAt.toISOString(),
      row.updatedAt.toISOString(),
      row.productName,
      row.userName,
      row.userEmail,
      row.source,
      row.message,
      row.sentiment,
      row.category,
      row.priority,
      row.status,
      row.analysisStatus,
      row.summary,
      row.confidence,
      row.modelVersion,
      row.analyzedAt ? row.analyzedAt.toISOString() : '',
      row.isSeed,
    ]),
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="feedback-export.csv"',
      'Cache-Control': 'no-store',
    },
  });
});
