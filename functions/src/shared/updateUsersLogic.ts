import {WebClient} from '@slack/web-api';
import type {Firestore} from 'firebase-admin/firestore';

// Minimal Slack Member type definition for our needs
interface Member {
  id?: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    email?: string;
    image_192?: string;
  };
}

// Account model matching the Firestore structure
export interface Account {
  id: string;
  slack: {
    id: string;
    name: string;
    username: string;
    pictureUrl: string;
  };
  activity: {
    totalPurchased: number;
    totalPaid: number;
    lastPurchaseTimestamp: number;
    lastPaymentTimestamp: number;
  };
  isEmployee: boolean;
}

type AccountAction =
  | {type: 'DELETE'; reason: string; account: Account}
  | {
      type: 'UPDATE';
      account: Account;
      changes: {isEmployee?: boolean; pictureUrl?: string};
    }
  | {type: 'CREATE'; slackUser: Member}
  | {type: 'NO_CHANGE'};

// Results structure returned by the function
export interface SyncResults {
  summary: {
    created: number;
    updated: number;
    deleted: number;
    total: number;
  };
  details: {
    created: {
      id: string;
      name: string;
      email: string;
      reason: string;
    }[];
    updated: {
      id: string;
      name: string;
      changes: string[];
      before: {isEmployee?: boolean; profilePicture?: string};
      after: {isEmployee?: boolean; profilePicture?: string};
    }[];
    deleted: {
      id: string;
      name: string;
      reason: string;
    }[];
  };
  executedAt: string;
  slackWorkspace: string;
}

const isActiveEmployee = (slackUser: Member | undefined): boolean => {
  if (!slackUser || slackUser.deleted) return false;

  const email = slackUser.profile?.email;
  if (!email) return false;

  return email.endsWith('@akeneo.com') || email.endsWith('@getakeneo.com');
};

const determineAction = (
  account: Account,
  slackUser: Member | undefined,
): AccountAction => {
  const isEmployee = isActiveEmployee(slackUser);
  const slackPictureUrl = slackUser?.profile?.image_192;

  // Deletion case: not in Slack + no purchase history
  if (!slackUser || slackUser.deleted) {
    if (account.activity.totalPurchased === 0) {
      return {
        type: 'DELETE',
        reason: 'no-slack-no-purchases',
        account,
      };
    }
  }

  const changes: {isEmployee?: boolean; pictureUrl?: string} = {};

  if (account.isEmployee !== isEmployee) {
    changes.isEmployee = isEmployee;
  }

  if (slackPictureUrl && account.slack.pictureUrl !== slackPictureUrl) {
    changes.pictureUrl = slackPictureUrl;
  }

  return Object.keys(changes).length > 0
    ? {type: 'UPDATE', account, changes}
    : {type: 'NO_CHANGE'};
};

export interface UpdateUsersOptions {
  slackBotToken: string;
  firestore: Firestore;
  dryRun?: boolean;
}

export const executeUpdateUsers = async (
  options: UpdateUsersOptions,
): Promise<SyncResults> => {
  const {slackBotToken, firestore, dryRun = false} = options;

  // Initialize Slack client
  const slack = new WebClient(slackBotToken);

  // Fetch all Slack users with pagination support
  const allSlackMembers: Member[] = [];
  let cursor: string | undefined;

  do {
    const response = await slack.users.list({
      cursor,
      limit: 1000, // Max allowed by Slack API
    });

    if (!response.members) {
      throw new Error('Failed to fetch Slack users');
    }

    allSlackMembers.push(...response.members);
    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  // Fetch Firestore accounts
  const accountsSnapshot = await firestore.collection('accounts').get();

  // Index Slack users by ID
  const slackUserMap = new Map<string, Member>();
  for (const member of allSlackMembers) {
    // Skip bots
    if (member.is_bot) continue;

    if (member.id) {
      slackUserMap.set(member.id, member);
    }
  }

  // Process all accounts
  const actions: AccountAction[] = [];

  // Track existing account Slack IDs
  const existingSlackIds = new Set<string>();

  for (const accountDoc of accountsSnapshot.docs) {
    const account = accountDoc.data() as Account;
    existingSlackIds.add(account.slack.id);
    const slackUser = slackUserMap.get(account.slack.id);
    const action = determineAction(account, slackUser);
    actions.push(action);
  }

  // Find new employees to create accounts for
  for (const [slackId, slackUser] of slackUserMap) {
    if (!existingSlackIds.has(slackId) && isActiveEmployee(slackUser)) {
      actions.push({type: 'CREATE', slackUser});
    }
  }

  // Filter out NO_CHANGE actions
  const operationalActions = actions.filter((a) => a.type !== 'NO_CHANGE');

  // Initialize results structure
  const results: SyncResults = {
    summary: {
      created: 0,
      updated: 0,
      deleted: 0,
      total: 0,
    },
    details: {
      created: [],
      updated: [],
      deleted: [],
    },
    executedAt: new Date().toISOString(),
    slackWorkspace: 'Akeneo',
  };

  // If dry run or no changes, return early
  if (dryRun || operationalActions.length === 0) {
    // Count the actions for summary
    results.summary.created = actions.filter((a) => a.type === 'CREATE').length;
    results.summary.updated = actions.filter((a) => a.type === 'UPDATE').length;
    results.summary.deleted = actions.filter((a) => a.type === 'DELETE').length;
    results.summary.total = operationalActions.length;
    return results;
  }

  // Apply changes in batches
  const batchSize = 500;
  const batches = Math.ceil(operationalActions.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const batchOps = operationalActions.slice(
      i * batchSize,
      (i + 1) * batchSize,
    );
    const batch = firestore.batch();

    for (const op of batchOps) {
      if (op.type === 'CREATE') {
        // Generate account ID using Firestore auto-ID
        const accountRef = firestore.collection('accounts').doc();
        const accountId = accountRef.id;

        const fullName =
          op.slackUser.profile?.email?.split('@')[0]?.replace(/[._]/g, ' ') ??
          op.slackUser.name ??
          'Unknown';

        const newAccount: Account = {
          id: accountId,
          slack: {
            id: op.slackUser.id ?? '',
            name: fullName,
            username: op.slackUser.name ?? '',
            pictureUrl:
              op.slackUser.profile?.image_192 ?? 'https://placehold.co/150',
          },
          activity: {
            totalPurchased: 0,
            totalPaid: 0,
            lastPurchaseTimestamp: 0,
            lastPaymentTimestamp: 0,
          },
          isEmployee: true,
        };

        batch.set(accountRef, newAccount);

        // Add to results
        results.details.created.push({
          id: newAccount.slack.id,
          name: newAccount.slack.name,
          email: op.slackUser.profile?.email ?? '',
          reason: 'New Slack member',
        });
        results.summary.created++;
      } else if (op.type === 'UPDATE') {
        const accountRef = firestore.collection('accounts').doc(op.account.id);
        const updateData: Record<string, string | boolean> = {};

        if (op.changes.isEmployee !== undefined) {
          updateData.isEmployee = op.changes.isEmployee;
        }

        if (op.changes.pictureUrl) {
          updateData['slack.pictureUrl'] = op.changes.pictureUrl;
        }

        batch.update(accountRef, updateData);

        // Add to results
        const changesList: string[] = [];
        const before: {isEmployee?: boolean; profilePicture?: string} = {};
        const after: {isEmployee?: boolean; profilePicture?: string} = {};

        if (op.changes.isEmployee !== undefined) {
          changesList.push('isEmployee');
          before.isEmployee = op.account.isEmployee;
          after.isEmployee = op.changes.isEmployee;
        }
        if (op.changes.pictureUrl) {
          changesList.push('profile_picture');
          before.profilePicture = op.account.slack.pictureUrl;
          after.profilePicture = op.changes.pictureUrl;
        }

        results.details.updated.push({
          id: op.account.slack.id,
          name: op.account.slack.name,
          changes: changesList,
          before,
          after,
        });
        results.summary.updated++;
      } else {
        // DELETE case
        const accountRef = firestore.collection('accounts').doc(op.account.id);
        batch.delete(accountRef);

        // Add to results
        results.details.deleted.push({
          id: op.account.slack.id,
          name: op.account.slack.name,
          reason:
            op.reason === 'no-slack-no-purchases'
              ? 'Not in Slack workspace, no purchases'
              : op.reason,
        });
        results.summary.deleted++;
      }
    }

    await batch.commit();
  }

  results.summary.total =
    results.summary.created + results.summary.updated + results.summary.deleted;

  return results;
};
