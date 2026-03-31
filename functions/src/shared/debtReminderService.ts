import {WebClient} from '@slack/web-api';
import type {Firestore} from 'firebase-admin/firestore';
import type {Account} from './updateUsersLogic.js';

const HIGH_DEBT_THRESHOLD = 10;
const MEDIUM_DEBT_THRESHOLD = 5;
const DAYS_INACTIVE_FOR_MEDIUM_DEBT = 30;
const MONTHS_INACTIVE_FOR_LOW_DEBT = 6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReminderTier = 'high' | 'medium' | 'low';

export interface AccountWithDebt {
  account: Account;
  debt: number;
  tier: ReminderTier;
}

const getDebt = (account: Account): number =>
  account.activity.totalPurchased - account.activity.totalPaid;

const daysSince = (timestamp: number, now: number): number =>
  (now - timestamp) / MS_PER_DAY;

export const categorizeAccounts = (
  accounts: Account[],
  now: number,
): AccountWithDebt[] => {
  const results: AccountWithDebt[] = [];

  for (const account of accounts) {
    if (!account.isEmployee) continue;

    const debt = getDebt(account);
    if (debt <= 0) continue;

    const lastPurchase = account.activity.lastPurchaseTimestamp;
    const inactiveDays = daysSince(lastPurchase, now);

    if (debt > HIGH_DEBT_THRESHOLD) {
      results.push({account, debt, tier: 'high'});
    } else if (
      debt > MEDIUM_DEBT_THRESHOLD &&
      inactiveDays >= DAYS_INACTIVE_FOR_MEDIUM_DEBT
    ) {
      results.push({account, debt, tier: 'medium'});
    } else if (
      debt <= MEDIUM_DEBT_THRESHOLD &&
      inactiveDays >= MONTHS_INACTIVE_FOR_LOW_DEBT * 30
    ) {
      results.push({account, debt, tier: 'low'});
    }
  }

  return results;
};

export interface ReminderResult {
  name: string;
  slackId: string;
  debt: number;
  tier: ReminderTier;
  sent: boolean;
  error?: string;
}

export interface DebtRemindersResults {
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
}

export interface DebtRemindersOptions {
  firestore: Firestore;
  slackBotToken?: string;
  dryRun?: boolean;
}

export const executeDebtReminders = async (
  options: DebtRemindersOptions,
): Promise<DebtRemindersResults> => {
  const {slackBotToken, firestore, dryRun = false} = options;

  const snapshot = await firestore.collection('accounts').get();
  const accounts = snapshot.docs.map((doc) => doc.data() as Account);

  const now = Date.now();
  const reminders = categorizeAccounts(accounts, now);

  const results: DebtRemindersResults = {
    summary: {
      high: reminders.filter((r) => r.tier === 'high').length,
      medium: reminders.filter((r) => r.tier === 'medium').length,
      low: reminders.filter((r) => r.tier === 'low').length,
      total: reminders.length,
      sent: 0,
      failed: 0,
    },
    details: [],
    dryRun,
    executedAt: new Date().toISOString(),
  };

  if (dryRun) {
    results.details = reminders.map((entry) => ({
      name: entry.account.slack.name,
      slackId: entry.account.slack.id,
      debt: entry.debt,
      tier: entry.tier,
      sent: false,
    }));
    return results;
  }

  if (!slackBotToken) {
    throw new Error('slackBotToken is required when dryRun is false');
  }

  const slackClient = new WebClient(slackBotToken);

  for (const entry of reminders) {
    const result: ReminderResult = {
      name: entry.account.slack.name,
      slackId: entry.account.slack.id,
      debt: entry.debt,
      tier: entry.tier,
      sent: false,
    };

    try {
      await slackClient.chat.postMessage({
        channel: entry.account.slack.id,
        text: buildReminderMessage(entry),
        unfurl_links: false,
      });
      result.sent = true;
      results.summary.sent++;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      results.summary.failed++;
    }

    results.details.push(result);
  }

  return results;
};

export const buildReminderMessage = (entry: AccountWithDebt): string => {
  const debtFormatted = entry.debt.toFixed(2);

  switch (entry.tier) {
    case 'high':
      return `:chaquip-cat: Hey dear Chaquiper! :chaquip-cat:
:warning: Your Chaquip tab is at *${debtFormatted}€*.
That's above our ${String(HIGH_DEBT_THRESHOLD)}€ threshold — could you settle up when you get a chance?
Bisous :money_with_wings:`;

    case 'medium':
      return `:chaquip-cat: Hey dear Chaquiper! :chaquip-cat:
:eyes: We noticed you haven't grabbed anything from the Chaquip in a while, but you still have an open tab of *${debtFormatted}€*.
Since it's been over ${String(DAYS_INACTIVE_FOR_MEDIUM_DEBT)} days since your last purchase, this is a friendly nudge to settle up!
Bisous :money_with_wings:`;

    case 'low':
      return `:chaquip-cat: Hey dear Chaquiper! :chaquip-cat:
:wave: Long time no see! You still have a small tab of *${debtFormatted}€* on the Chaquip.
It's been over ${String(MONTHS_INACTIVE_FOR_LOW_DEBT)} months since your last visit — just a gentle reminder to clear it when you can.
Bisous :money_with_wings:`;
  }
};
