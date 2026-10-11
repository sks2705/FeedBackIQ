import { describe, expect, it } from 'vitest';
import { createFeedbackSchema, listQuerySchema } from '../lib/validation';
import { loginSchema } from '../lib/authValidation';
import { toCsv } from '../lib/csv';
import { checkRateLimit } from '../lib/rateLimit';

describe('Validation Schemas', () => {
  it('validates feedback creation schema', () => {
    const valid = createFeedbackSchema.safeParse({
      message: 'This is a valid test feedback message longer than 10 chars.',
      productName: 'Checkout',
      source: 'web',
    });
    expect(valid.success).toBe(true);

    const tooShort = createFeedbackSchema.safeParse({
      message: 'Short',
      productName: 'Checkout',
    });
    expect(tooShort.success).toBe(false);
  });

  it('validates login schema', () => {
    const valid = loginSchema.safeParse({
      email: 'admin@feedbackiq.local',
      password: 'AdminPassword123!',
    });
    expect(valid.success).toBe(true);

    const invalidEmail = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password',
    });
    expect(invalidEmail.success).toBe(false);
  });

  it('validates list query params schema', () => {
    const parsed = listQuerySchema.parse({
      page: '2',
      pageSize: '10',
      sentiment: 'POSITIVE',
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(10);
    expect(parsed.sentiment).toBe('POSITIVE');
  });
});

describe('CSV Formula Sanitization', () => {
  it('escapes leading formula characters (=, +, -, @, tab, cr)', () => {
    const headers = ['id', 'message'];
    const rows = [
      ['1', '=1+1 calculation'],
      ['2', '+cmd test'],
      ['3', '-minus formula'],
      ['4', '@mention test'],
      ['5', 'Normal message'],
    ];

    const result = toCsv(headers, rows);
    expect(result).toContain("'=1+1 calculation");
    expect(result).toContain("'+cmd test");
    expect(result).toContain("'-minus formula");
    expect(result).toContain("'@mention test");
    expect(result).toContain('"Normal message"');
  });
});

describe('In-memory Rate Limiter', () => {
  it('allows requests within limit and blocks excess requests', async () => {
    const ip = '192.168.1.100';
    const prefix = 'test_limit';
    const max = 3;
    const windowMs = 60000;

    const r1 = await checkRateLimit(ip, prefix, max, windowMs);
    const r2 = await checkRateLimit(ip, prefix, max, windowMs);
    const r3 = await checkRateLimit(ip, prefix, max, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);

    const r4 = await checkRateLimit(ip, prefix, max, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });
});
