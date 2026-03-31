export type ReminderTier = 'high' | 'medium' | 'low';

export type ReminderResult = {
  name: string;
  slackId: string;
  debt: number;
  tier: ReminderTier;
  lastPurchaseTimestamp: number;
  sent: boolean;
  error?: string;
};

export type DebtRemindersResults = {
  summary: {
    high: number;
    medium: number;
    low: number;
    total: number;
    sent: number;
    failed: number;
  };
  details: ReminderResult[];
  dryRun: boolean;
  executedAt: string;
};
