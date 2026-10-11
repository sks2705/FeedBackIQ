import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStorage } from '@/lib/storage';

export async function GET() {
  let databaseStatus: 'ok' | 'down' = 'down';
  let aiServiceStatus: 'ok' | 'down' = 'down';
  let storageStatus: 'ok' | 'down' = 'down';

  // 1. Database check (2s timeout)
  try {
    const dbPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 5000)
    );
    await Promise.race([dbPromise, timeoutPromise]);
    databaseStatus = 'ok';
  } catch {
    databaseStatus = 'down';
  }

  // 2. AI Service readiness check (2s timeout)
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const res = await fetch(`${aiUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const body = (await res.json()) as { models_loaded?: boolean };
      aiServiceStatus = body.models_loaded === true ? 'ok' : 'down';
    }
  } catch {
    aiServiceStatus = 'down';
  }

  // 3. Storage check. EC2 uses the IAM role, so credentials are not expected
  // in environment variables.
  storageStatus = process.env.S3_BUCKET && (await checkStorage()) ? 'ok' : 'down';

  const overallStatus =
    databaseStatus === 'ok' && aiServiceStatus === 'ok' && storageStatus === 'ok'
      ? 'ok'
      : 'down';

  return NextResponse.json(
    {
      status: overallStatus,
      database: databaseStatus,
      aiService: aiServiceStatus,
      storage: storageStatus,
    },
    { status: overallStatus === 'ok' ? 200 : 503 }
  );
}
