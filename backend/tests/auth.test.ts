import { describe, expect, it } from 'vitest';
import { hashPassword, signSession, verifyPassword, verifySession } from '../lib/auth';

describe('Auth Helpers', () => {
  it('hashes and verifies passwords correctly', async () => {
    const raw = 'SecretPassword123!';
    const hash = await hashPassword(raw);
    expect(hash).not.toBe(raw);

    const valid = await verifyPassword(raw, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('WrongPassword', hash);
    expect(invalid).toBe(false);
  });

  it('signs and verifies JWT sessions correctly', async () => {
    const payload = {
      userId: 'user-123',
      email: 'admin@feedbackiq.local',
      role: 'ADMIN' as const,
    };

    const token = await signSession(payload);
    expect(typeof token).toBe('string');

    const verified = await verifySession(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('user-123');
    expect(verified?.email).toBe('admin@feedbackiq.local');
    expect(verified?.role).toBe('ADMIN');
  });

  it('returns null for tampered JWT token', async () => {
    const payload = {
      userId: 'user-123',
      email: 'admin@feedbackiq.local',
      role: 'ADMIN' as const,
    };

    const token = await signSession(payload);
    const tampered = token.slice(0, -5) + 'xxxxx';

    const verified = await verifySession(tampered);
    expect(verified).toBeNull();
  });
});
