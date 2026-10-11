import { Category, Priority, Sentiment } from '@prisma/client';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Contract: AI /analyze response shape
// ---------------------------------------------------------------------------
const aiSentimentSchema = z.enum(['positive', 'negative', 'neutral']);
const aiCategorySchema = z.enum(['ui_ux', 'performance', 'bug', 'feature_request', 'security', 'other']);
const aiPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/** Response returned by POST http://localhost:8000/analyze. */
export const aiAnalyzeResponseSchema = z.object({
  sentiment: aiSentimentSchema,
  sentiment_confidence: z.number().min(0).max(1),
  category: aiCategorySchema,
  category_confidence: z.number().min(0).max(1).nullable(),
  priority: aiPrioritySchema,
  summary: z.string().max(500),
  model_version: z.string().max(200),
});

export type AiAnalyzeResponse = z.infer<typeof aiAnalyzeResponseSchema>;

// ---------------------------------------------------------------------------
// Prisma enum mapping — single canonical mapping function
// ---------------------------------------------------------------------------
export type AiMappedEnums = {
  sentiment: Sentiment;
  category: Category;
  priority: Priority;
};

export function mapAiEnumsToPrisma(response: AiAnalyzeResponse): AiMappedEnums {
  const sentimentMap: Record<AiAnalyzeResponse['sentiment'], Sentiment> = {
    positive: Sentiment.POSITIVE,
    negative: Sentiment.NEGATIVE,
    neutral: Sentiment.NEUTRAL,
  };

  const categoryMap: Record<AiAnalyzeResponse['category'], Category> = {
    ui_ux: Category.UI_UX,
    performance: Category.PERFORMANCE,
    bug: Category.BUG,
    feature_request: Category.FEATURE_REQUEST,
    security: Category.SECURITY,
    other: Category.OTHER,
  };

  const priorityMap: Record<AiAnalyzeResponse['priority'], Priority> = {
    low: Priority.LOW,
    medium: Priority.MEDIUM,
    high: Priority.HIGH,
    critical: Priority.CRITICAL,
  };

  return {
    sentiment: sentimentMap[response.sentiment],
    category: categoryMap[response.category],
    priority: priorityMap[response.priority],
  };
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------
export type AiServiceErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'NON_200'
  | 'INVALID_SHAPE'
  | 'CONFIGURATION';

export class AiServiceError extends Error {
  readonly code: AiServiceErrorCode;
  readonly status?: number;
  readonly responseText?: string;

  constructor(
    code: AiServiceErrorCode,
    message: string,
    options?: { status?: number; responseText?: string; cause?: unknown },
  ) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = options?.status;
    this.responseText = options?.responseText;
    if (options?.cause !== undefined && (options.cause as object) instanceof Error) {
      this.cause = options.cause;
    }
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
function getServiceUrl(): string {
  const url = process.env.AI_SERVICE_URL;
  if (!url) {
    throw new AiServiceError('CONFIGURATION', 'AI_SERVICE_URL environment variable is not set');
  }
  return url.replace(/\/$/, '');
}

function getTimeoutMs(): number {
  const raw = process.env.AI_TIMEOUT_MS;
  const parsed = raw === undefined ? 15000 : Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 15000;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// callAnalyze
// ---------------------------------------------------------------------------
export type AnalyzeResult = Omit<AiAnalyzeResponse, 'sentiment' | 'category' | 'priority'> &
  AiMappedEnums;

/**
 * Call the AI service POST /analyze endpoint.
 *
 * Uses AbortController to enforce AI_TIMEOUT_MS. Validates the response
 * against the zod contract. Maps AI lowercase values to Prisma enums via
 * `mapAiEnumsToPrisma` and returns a merged object.
 *
 * Throws AiServiceError on any failure.
 */
export async function callAnalyze(text: string): Promise<AnalyzeResult> {
  const serviceUrl = getServiceUrl();
  const timeoutMs = getTimeoutMs();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(`${serviceUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AiServiceError(
          'TIMEOUT',
          `AI service did not respond within ${timeoutMs}ms`,
          { cause: err },
        );
      }
      throw new AiServiceError(
        'NETWORK_ERROR',
        `Unable to reach AI service at ${serviceUrl}: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok) {
      let textBody: string | undefined;
      try {
        textBody = await response.text();
      } catch {
        /* ignore */
      }
      throw new AiServiceError(
        'NON_200',
        `AI service returned status ${response.status}`,
        { status: response.status, responseText: textBody },
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new AiServiceError(
        'INVALID_SHAPE',
        'AI service returned non-JSON response body',
        { cause: err },
      );
    }

    const parsed = aiAnalyzeResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiServiceError(
        'INVALID_SHAPE',
        `AI response failed schema validation: ${parsed.error.message}`,
        { responseText: JSON.stringify(json).slice(0, 500) },
      );
    }

    const enums = mapAiEnumsToPrisma(parsed.data);
    return { ...parsed.data, ...enums };
  } finally {
    clearTimeout(timeoutId);
  }
}
