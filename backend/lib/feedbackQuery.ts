import { Prisma, Priority } from '@prisma/client';
import type { Feedback } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ListQuery } from '@/lib/validation';

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseFromInclusive(value: string): Date {
  if (isDateOnly(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
  return new Date(value);
}

export function parseToInclusiveEndOfDay(value: string): Date {
  if (isDateOnly(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

export function buildFeedbackWhere(query: ListQuery): Prisma.FeedbackWhereInput {
  const where: Prisma.FeedbackWhereInput = {};
  const and: Prisma.FeedbackWhereInput[] = [];

  if (query.search) {
    and.push({
      OR: [
        { message: { contains: query.search, mode: 'insensitive' } },
        { productName: { contains: query.search, mode: 'insensitive' } },
        { summary: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (query.sentiment) {
    where.sentiment = query.sentiment;
  }
  if (query.category) {
    where.category = query.category;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.analysisStatus) {
    where.analysisStatus = query.analysisStatus;
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = parseFromInclusive(query.from);
    }
    if (query.to) {
      where.createdAt.lte = parseToInclusiveEndOfDay(query.to);
    }
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export function compareFeedbackSort(
  a: { priority: Priority | null; createdAt: Date },
  b: { priority: Priority | null; createdAt: Date },
  sort: ListQuery['sort'],
): number {
  if (sort === 'createdAt:asc') {
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  if (sort === 'createdAt:desc') {
    return b.createdAt.getTime() - a.createdAt.getTime();
  }

  const rankDelta = (PRIORITY_RANK[b.priority ?? ''] ?? 0) - (PRIORITY_RANK[a.priority ?? ''] ?? 0);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export async function queryFeedbackPage(
  query: ListQuery,
): Promise<{ data: Feedback[]; total: number }> {
  const where = buildFeedbackWhere(query);
  const total = await prisma.feedback.count({ where });
  const skip = (query.page - 1) * query.pageSize;

  if (query.sort === 'priority:desc') {
    const all = await prisma.feedback.findMany({ where, include: { attachments: true } });
    all.sort((left, right) => compareFeedbackSort(left, right, query.sort));
    return { data: all.slice(skip, skip + query.pageSize), total };
  }

  const data = await prisma.feedback.findMany({
    where,
    include: { attachments: true },
    orderBy: { createdAt: query.sort === 'createdAt:asc' ? 'asc' : 'desc' },
    skip,
    take: query.pageSize,
  });

  return { data, total };
}

export async function queryFeedbackExport(query: ListQuery): Promise<Feedback[]> {
  const where = buildFeedbackWhere(query);
  const rows = await prisma.feedback.findMany({ where });
  rows.sort((left, right) => compareFeedbackSort(left, right, query.sort));
  return rows;
}
