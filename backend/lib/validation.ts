import { AnalysisStatus, Category, Priority, Sentiment, Status } from '@prisma/client';
import { z } from 'zod';

export const feedbackSourceSchema = z.enum(['web', 'email', 'survey', 'support', 'other']);

export type FeedbackSource = z.infer<typeof feedbackSourceSchema>;

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export const createFeedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, { message: 'Feedback message must be at least 10 characters long' })
    .max(2000, { message: 'Feedback message must not exceed 2000 characters' }),
  productName: z
    .string()
    .trim()
    .min(1, { message: 'Product or service name is required' })
    .max(100, { message: 'Product name must not exceed 100 characters' }),
  userName: z.preprocess(
    blankToUndefined,
    z.string().max(100, { message: 'Name must not exceed 100 characters' }).optional(),
  ),
  userEmail: z.preprocess(
    blankToUndefined,
    z.string().email({ message: 'Please enter a valid email address' }).optional(),
  ),
  source: z.preprocess(blankToUndefined, feedbackSourceSchema.optional()).default('web'),
  attachmentKey: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^uploads\/[a-f0-9-]+\.(png|jpeg|jpg|webp)$/, {
        message: 'Invalid attachment key format',
      })
      .optional()
  ),
  attachmentName: z.preprocess(blankToUndefined, z.string().max(100).optional()),
  attachmentType: z.preprocess(blankToUndefined, z.string().max(100).optional()),
  attachmentSize: z.preprocess(blankToUndefined, z.number().int().positive().optional()),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

const optionalEnum = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

export const listQuerySchema = z.object({
  page: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1, { message: 'page must be at least 1' }).default(1),
  ),
  pageSize: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1, { message: 'pageSize must be at least 1' })
      .max(100, { message: 'pageSize must not exceed 100' })
      .default(20),
  ),
  search: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
  sentiment: optionalEnum(z.nativeEnum(Sentiment)),
  category: optionalEnum(z.nativeEnum(Category)),
  priority: optionalEnum(z.nativeEnum(Priority)),
  status: optionalEnum(z.nativeEnum(Status)),
  analysisStatus: optionalEnum(z.nativeEnum(AnalysisStatus)),
  from: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'from must be a valid ISO date' })
      .optional(),
  ),
  to: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'to must be a valid ISO date' })
      .optional(),
  ),
  sort: z.preprocess(
    blankToUndefined,
    z.enum(['createdAt:desc', 'createdAt:asc', 'priority:desc']).default('createdAt:desc'),
  ),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const updateStatusSchema = z.object({
  status: z.nativeEnum(Status, {
    errorMap: () => ({ message: 'status must be one of NEW, REVIEWING, RESOLVED' }),
  }),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const analyticsQuerySchema = z.object({
  days: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1, { message: 'days must be at least 1' })
      .max(365, { message: 'days must not exceed 365' })
      .default(30),
  ),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export function parseListQuery(searchParams: URLSearchParams): ListQuery {
  return listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

export function parseAnalyticsQuery(searchParams: URLSearchParams): AnalyticsQuery {
  return analyticsQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

export function parseUuidParam(id: string | undefined): string {
  return z.object({ id: uuidSchema }).parse({ id }).id;
}
