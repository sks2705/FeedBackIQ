import { describe, expect, it, vi } from 'vitest';
import { analyzeFeedbackRecord } from '../lib/analysisService';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
  prisma: {
    feedback: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('AI Service Failure Handling', () => {
  it('sets analysisStatus to FAILED when fetch times out or fails', async () => {
    const fakeFeedback = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      message: 'Test message when AI service is down',
    };

    vi.mocked(prisma.feedback.findUnique).mockResolvedValue(fakeFeedback as any);
    vi.mocked(prisma.feedback.update).mockResolvedValue({} as any);

    // Mock global fetch to simulate network error/timeout
    global.fetch = vi.fn().mockRejectedValue(new Error('AI service unreachable'));

    await analyzeFeedbackRecord(fakeFeedback.id);

    expect(prisma.feedback.update).toHaveBeenLastCalledWith({
      where: { id: fakeFeedback.id },
      data: expect.objectContaining({
        analysisStatus: 'FAILED',
        analysisError: expect.stringContaining('AI service unreachable'),
      }),
    });
  });
});
