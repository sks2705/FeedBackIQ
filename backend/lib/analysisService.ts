import { callAnalyze, AiServiceError } from '@/lib/aiClient';
import { prisma } from '@/lib/prisma';

const MAX_ERROR_CHARS = 250;

function shortError(err: unknown): string {
  let message: string;
  if (err instanceof AiServiceError) {
    message = `${err.code}: ${err.message}`;
    if (err.status) {
      message = `${err.code}(${err.status}): ${err.message}`;
    }
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }
  const trimmed = message.trim() || 'Unknown AI analysis failure';
  if (trimmed.length > MAX_ERROR_CHARS) {
    return trimmed.slice(0, MAX_ERROR_CHARS - 3) + '...';
  }
  return trimmed;
}

/**
 * Run AI analysis on a feedback record.
 *
 * Calls the FastAPI /analyze endpoint with the record's message. On success,
 * persists sentiment, category, priority, summary, confidence (sentiment),
 * modelVersion, analyzedAt and sets analysisStatus=COMPLETED. On any failure
 * (network, timeout, bad status, invalid shape, unexpected error), keeps the
 * original feedback row intact except for analysisStatus=FAILED and a short
 * analysisError message.
 *
 * This function MUST never throw — callers rely on the returned Promise<void>
 * always resolving so that the REST endpoints always return the saved record.
 */
export async function analyzeFeedbackRecord(id: string): Promise<void> {
  try {
    // 1. Mark the record PENDING and load its message.
    const record = await prisma.feedback.update({
      where: { id },
      data: {
        analysisStatus: 'PENDING',
        analysisError: null,
      },
      select: { message: true },
    });

    // 2. Call the AI service.
    const result = await callAnalyze(record.message);

    // 3. Persist analysis on success.
    await prisma.feedback.update({
      where: { id },
      data: {
        sentiment: result.sentiment,
        category: result.category,
        priority: result.priority,
        summary: result.summary,
        confidence: result.sentiment_confidence,
        modelVersion: result.model_version,
        analyzedAt: new Date(),
        analysisStatus: 'COMPLETED',
        analysisError: null,
      },
    });
  } catch (err) {
    // 4. Never throw — mark FAILED and store a short error.
    try {
      await prisma.feedback.update({
        where: { id },
        data: {
          analysisStatus: 'FAILED',
          analysisError: shortError(err),
          // NOTE: we deliberately keep any previously stored sentiment/category
          // fields from an earlier successful run, as per "keep the original
          // message" rule. New rows will have these null, which is correct.
        },
      });
    } catch (persistErr) {
      // Even the failure-write failed (e.g. DB is down). Log and swallow.
      console.error(
        '[analysisService] Failed to persist analysisStatus=FAILED for feedback',
        id,
        persistErr instanceof Error ? persistErr.message : persistErr,
      );
    }
  }
}
