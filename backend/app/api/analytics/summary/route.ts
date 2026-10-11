import { Category } from '@prisma/client';
import { ok, withErrorHandling } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseAnalyticsQuery } from '@/lib/validation';
import { NextRequest } from 'next/server';

type TrendRow = {
  date: string;
  count: number | bigint;
  positive: number | bigint;
  negative: number | bigint;
  neutral: number | bigint;
};

function asNumber(value: number | bigint | undefined): number {
  if (value === undefined) {
    return 0;
  }
  return typeof value === 'bigint' ? Number(value) : value;
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireUser(request);
  const { days } = parseAnalyticsQuery(request.nextUrl.searchParams);

  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  const where = { createdAt: { gte: start, lte: end } };

  const [
    total,
    sentimentGroups,
    priorityGroups,
    statusGroups,
    analysisGroups,
    categoryGroups,
    trendRows,
  ] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.groupBy({
      by: ['sentiment'],
      where,
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ['priority'],
      where,
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ['analysisStatus'],
      where,
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ['category'],
      where,
      _count: { _all: true },
    }),
    prisma.$queryRaw<TrendRow[]>`
      SELECT
        to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE sentiment = 'POSITIVE')::int AS positive,
        COUNT(*) FILTER (WHERE sentiment = 'NEGATIVE')::int AS negative,
        COUNT(*) FILTER (WHERE sentiment = 'NEUTRAL')::int AS neutral
      FROM feedback
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const sentimentCount = (value: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null) =>
    sentimentGroups.find((group) => group.sentiment === value)?._count._all ?? 0;

  const priorityCount = (value: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null) =>
    priorityGroups.find((group) => group.priority === value)?._count._all ?? 0;

  const statusCount = (value: 'NEW' | 'REVIEWING' | 'RESOLVED') =>
    statusGroups.find((group) => group.status === value)?._count._all ?? 0;

  const analysisCount = (value: 'PENDING' | 'COMPLETED' | 'FAILED') =>
    analysisGroups.find((group) => group.analysisStatus === value)?._count._all ?? 0;

  const highPriorityCount = priorityCount('HIGH') + priorityCount('CRITICAL');
  const criticalCount = priorityCount('CRITICAL');
  const resolvedCount = statusCount('RESOLVED');
  const unresolvedCount = statusCount('NEW') + statusCount('REVIEWING');

  const categoryCountByName = new Map(
    categoryGroups
      .filter((group) => group.category !== null)
      .map((group) => [group.category as Category, group._count._all]),
  );

  const categoryDistribution = (Object.values(Category) as Category[]).map((category) => ({
    category,
    count: categoryCountByName.get(category) ?? 0,
  }));

  const trendByDate = new Map(trendRows.map((row) => [row.date, row]));
  const trend = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);
    const date = toUtcDateKey(day);
    const row = trendByDate.get(date);
    trend.push({
      date,
      count: asNumber(row?.count),
      positive: asNumber(row?.positive),
      negative: asNumber(row?.negative),
      neutral: asNumber(row?.neutral),
    });
  }

  return ok({
    total,
    sentiment: {
      positive: sentimentCount('POSITIVE'),
      negative: sentimentCount('NEGATIVE'),
      neutral: sentimentCount('NEUTRAL'),
      unanalyzed: sentimentCount(null),
    },
    priority: {
      low: priorityCount('LOW'),
      medium: priorityCount('MEDIUM'),
      high: priorityCount('HIGH'),
      critical: priorityCount('CRITICAL'),
    },
    highPriorityCount,
    criticalCount,
    resolvedCount,
    unresolvedCount,
    pendingAnalysisCount: analysisCount('PENDING'),
    failedAnalysisCount: analysisCount('FAILED'),
    categoryDistribution,
    trend,
  });
});
