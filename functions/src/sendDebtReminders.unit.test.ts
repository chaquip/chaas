import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockExecuteDebtReminders = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => 'mock-firestore'),
}));

vi.mock('./shared/debtReminderService.js', () => ({
  executeDebtReminders: (...args: unknown[]) =>
    mockExecuteDebtReminders(...args),
}));

vi.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    HttpsError,
    onCall: (handler: (request: unknown) => unknown) => handler,
  };
});

import {HttpsError} from 'firebase-functions/v2/https';
import {sendDebtRemindersDryRun} from './sendDebtReminders';

describe('sendDebtRemindersDryRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws unauthenticated error when not logged in', async () => {
    const request = {auth: null};

    await expect(
      (sendDebtRemindersDryRun as (req: typeof request) => Promise<unknown>)(
        request,
      ),
    ).rejects.toThrow(HttpsError);
  });

  it('calls executeDebtReminders with dryRun true', async () => {
    const mockResults = {
      summary: {high: 1, medium: 0, low: 0, total: 1, sent: 0, failed: 0},
      details: [],
      dryRun: true,
      executedAt: '2026-04-01T00:00:00.000Z',
    };
    mockExecuteDebtReminders.mockResolvedValue(mockResults);

    const request = {auth: {uid: 'user-1'}};
    const result = await (
      sendDebtRemindersDryRun as (req: typeof request) => Promise<unknown>
    )(request);

    expect(result).toEqual(mockResults);
    expect(mockExecuteDebtReminders).toHaveBeenCalledWith({
      firestore: 'mock-firestore',
      dryRun: true,
    });
  });

  it('throws internal error when executeDebtReminders fails', async () => {
    mockExecuteDebtReminders.mockRejectedValue(
      new Error('Firestore unavailable'),
    );

    const request = {auth: {uid: 'user-1'}};

    await expect(
      (sendDebtRemindersDryRun as (req: typeof request) => Promise<unknown>)(
        request,
      ),
    ).rejects.toThrow(HttpsError);
  });
});
