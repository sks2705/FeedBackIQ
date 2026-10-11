import { describe, expect, it, vi } from 'vitest';
import { GET as getFeedbackList, POST as createFeedback } from '../app/api/feedback/route';
import { PATCH as updateStatus } from '../app/api/feedback/[id]/status/route';
import { prisma } from '../lib/prisma';
import * as auth from '../lib/auth';
import { NextRequest } from 'next/server';

vi.mock('../lib/prisma', () => ({
  prisma: {
    feedback: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Route Handler Authorization & Error Responses', () => {
  it('returns 401 UNAUTHENTICATED when accessing protected list while logged out', async () => {
    vi.spyOn(auth, 'getSession').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/feedback');
    const res = await getFeedbackList(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 FORBIDDEN when VIEWER attempts PATCH status update', async () => {
    const sessionCookie = await auth.signSession({
      userId: 'user-viewer',
      email: 'viewer@feedbackiq.local',
      role: 'VIEWER',
    });

    const req = new NextRequest('http://localhost:3000/api/feedback/123e4567-e89b-12d3-a456-426614174000/status', {
      method: 'PATCH',
      headers: {
        cookie: `feedbackiq_session=${sessionCookie}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });

    const res = await updateStatus(req, {
      params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 VALIDATION_ERROR on invalid payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ message: 'Short' }),
    });

    const res = await createFeedback(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND when updating status of non-existent item', async () => {
    const sessionCookie = await auth.signSession({
      userId: 'user-admin',
      email: 'admin@feedbackiq.local',
      role: 'ADMIN',
    });

    vi.mocked(prisma.feedback.findUnique).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/feedback/123e4567-e89b-12d3-a456-426614174000/status', {
      method: 'PATCH',
      headers: {
        cookie: `feedbackiq_session=${sessionCookie}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });

    const res = await updateStatus(req, {
      params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});
