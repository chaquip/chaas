import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {executeDebtReminders} from './shared/debtReminderService.js';

export const sendDebtRemindersDryRun = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  try {
    const results = await executeDebtReminders({
      firestore: getFirestore(),
      dryRun: true,
    });

    return results;
  } catch (error) {
    console.error('Error executing debt reminders dry run:', error);

    if (error instanceof Error) {
      throw new HttpsError(
        'internal',
        `Failed to run debt reminders: ${error.message}`,
      );
    }

    throw new HttpsError('internal', 'An unknown error occurred');
  }
});
