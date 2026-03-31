/* eslint-disable @typescript-eslint/no-explicit-any */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  categorizeAccounts,
  buildReminderMessage,
  executeDebtReminders,
} from './debtReminderService';
import type {Account} from './updateUsersLogic';

const mockPostMessage = vi.fn();

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      postMessage: mockPostMessage,
    },
  })),
}));

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const makeAccount = (
  overrides: Partial<Account> & {
    totalPurchased?: number;
    totalPaid?: number;
    lastPurchaseTimestamp?: number;
    isEmployee?: boolean;
  },
): Account => ({
  id: overrides.id ?? 'account-1',
  slack: {
    id: 'slack-1',
    name: 'Test User',
    username: 'testuser',
    pictureUrl: 'https://example.com/pic.jpg',
    ...overrides.slack,
  },
  activity: {
    totalPurchased: overrides.totalPurchased ?? 0,
    totalPaid: overrides.totalPaid ?? 0,
    lastPurchaseTimestamp: overrides.lastPurchaseTimestamp ?? 0,
    lastPaymentTimestamp: 0,
  },
  isEmployee: overrides.isEmployee ?? true,
});

describe('categorizeAccounts', () => {
  const now = Date.now();

  it('returns high tier for debt above 10€', () => {
    const accounts = [makeAccount({totalPurchased: 15, totalPaid: 0})];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('high');
    expect(result[0].debt).toBe(15);
  });

  it('returns high tier regardless of last purchase date', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 12,
        totalPaid: 0,
        lastPurchaseTimestamp: now,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('high');
  });

  it('returns medium tier for 5-10€ debt inactive 30+ days', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 8,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 31 * MS_PER_DAY,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('medium');
    expect(result[0].debt).toBe(8);
  });

  it('skips medium tier if last purchase was recent', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 8,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 10 * MS_PER_DAY,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(0);
  });

  it('returns low tier for debt ≤5€ inactive 6+ months', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 3,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 181 * MS_PER_DAY,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('low');
    expect(result[0].debt).toBe(3);
  });

  it('skips low tier if last purchase was recent', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 3,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 60 * MS_PER_DAY,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(0);
  });

  it('skips accounts with no debt', () => {
    const accounts = [makeAccount({totalPurchased: 5, totalPaid: 5})];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(0);
  });

  it('skips accounts with negative debt (overpaid)', () => {
    const accounts = [makeAccount({totalPurchased: 5, totalPaid: 10})];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(0);
  });

  it('skips non-employee accounts', () => {
    const accounts = [
      makeAccount({totalPurchased: 20, totalPaid: 0, isEmployee: false}),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(0);
  });

  it('categorizes multiple accounts correctly', () => {
    const accounts = [
      makeAccount({
        id: 'high',
        totalPurchased: 15,
        totalPaid: 0,
        lastPurchaseTimestamp: now,
      }),
      makeAccount({
        id: 'medium',
        totalPurchased: 7,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 35 * MS_PER_DAY,
      }),
      makeAccount({
        id: 'low',
        totalPurchased: 4,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 200 * MS_PER_DAY,
      }),
      makeAccount({
        id: 'no-debt',
        totalPurchased: 5,
        totalPaid: 5,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.tier)).toEqual(['high', 'medium', 'low']);
  });

  it('handles exactly 10€ debt as medium tier (not high)', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 10,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 31 * MS_PER_DAY,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('medium');
  });

  it('handles exactly 5€ debt as low tier (not medium)', () => {
    const accounts = [
      makeAccount({
        totalPurchased: 5,
        totalPaid: 0,
        lastPurchaseTimestamp: now - 200 * MS_PER_DAY,
      }),
    ];
    const result = categorizeAccounts(accounts, now);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('low');
  });
});

const createMockFirestore = (accounts: Account[]) =>
  ({
    collection: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: accounts.map((a) => ({data: () => a})),
      }),
    }),
  }) as any;

describe('executeDebtReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostMessage.mockResolvedValue({ok: true});
  });

  it('returns details without sending messages in dry run', async () => {
    const accounts = [makeAccount({totalPurchased: 15, totalPaid: 0})];
    const firestore = createMockFirestore(accounts);

    const results = await executeDebtReminders({
      slackBotToken: 'fake-token',
      firestore,
      dryRun: true,
    });

    expect(results.dryRun).toBe(true);
    expect(results.summary.total).toBe(1);
    expect(results.summary.sent).toBe(0);
    expect(results.details).toHaveLength(1);
    expect(results.details[0].name).toBe('Test User');
    expect(results.details[0].tier).toBe('high');
    expect(results.details[0].sent).toBe(false);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('sends messages when not in dry run', async () => {
    const accounts = [makeAccount({totalPurchased: 15, totalPaid: 0})];
    const firestore = createMockFirestore(accounts);

    const results = await executeDebtReminders({
      slackBotToken: 'fake-token',
      firestore,
    });

    expect(results.dryRun).toBe(false);
    expect(results.summary.sent).toBe(1);
    expect(results.details[0].sent).toBe(true);
    expect(mockPostMessage).toHaveBeenCalledOnce();
  });

  it('handles send failures gracefully', async () => {
    mockPostMessage.mockRejectedValue(new Error('Slack API error'));
    const accounts = [makeAccount({totalPurchased: 15, totalPaid: 0})];
    const firestore = createMockFirestore(accounts);

    const results = await executeDebtReminders({
      slackBotToken: 'fake-token',
      firestore,
    });

    expect(results.summary.failed).toBe(1);
    expect(results.summary.sent).toBe(0);
    expect(results.details[0].sent).toBe(false);
    expect(results.details[0].error).toBe('Slack API error');
  });

  it('dry run includes correct tier breakdown in summary', async () => {
    const accounts = [
      makeAccount({
        id: 'high',
        totalPurchased: 15,
        totalPaid: 0,
        lastPurchaseTimestamp: Date.now(),
      }),
      makeAccount({
        id: 'medium',
        totalPurchased: 7,
        totalPaid: 0,
        lastPurchaseTimestamp: Date.now() - 35 * MS_PER_DAY,
      }),
      makeAccount({
        id: 'no-debt',
        totalPurchased: 5,
        totalPaid: 5,
      }),
    ];
    const firestore = createMockFirestore(accounts);

    const results = await executeDebtReminders({
      slackBotToken: 'fake-token',
      firestore,
      dryRun: true,
    });

    expect(results.summary.high).toBe(1);
    expect(results.summary.medium).toBe(1);
    expect(results.summary.low).toBe(0);
    expect(results.summary.total).toBe(2);
  });
});

describe('buildReminderMessage', () => {
  const baseAccount = makeAccount({totalPurchased: 15, totalPaid: 0});

  it('builds high tier message with debt amount and threshold', () => {
    const message = buildReminderMessage({
      account: baseAccount,
      debt: 15,
      tier: 'high',
    });

    expect(message).toContain('15.00€');
    expect(message).toContain('10€ threshold');
    expect(message).toContain(':chaquip-cat:');
  });

  it('builds medium tier message mentioning inactivity', () => {
    const message = buildReminderMessage({
      account: baseAccount,
      debt: 7.5,
      tier: 'medium',
    });

    expect(message).toContain('7.50€');
    expect(message).toContain('30 days');
    expect(message).toContain(':chaquip-cat:');
  });

  it('builds low tier message mentioning long absence', () => {
    const message = buildReminderMessage({
      account: baseAccount,
      debt: 3,
      tier: 'low',
    });

    expect(message).toContain('3.00€');
    expect(message).toContain('6 months');
    expect(message).toContain(':chaquip-cat:');
  });
});
