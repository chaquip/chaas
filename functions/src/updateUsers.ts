import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {executeUpdateUsers} from './shared/updateUsersLogic.js';

// Define secrets
const slackBotToken = defineSecret('SLACK_BOT_TOKEN');

export const updateUsers = onCall(
  {
    secrets: [slackBotToken],
  },
  async (request) => {
    // Authentication check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // Get token from secret
    const token = slackBotToken.value();
    if (!token) {
      throw new HttpsError(
        'failed-precondition',
        'SLACK_BOT_TOKEN not configured. Please set it as a secret.',
      );
    }

    try {
      // Execute the sync logic with DRY_RUN=false
      const results = await executeUpdateUsers({
        slackBotToken: token,
        firestore: getFirestore(),
        dryRun: false,
      });

      // Return detailed results
      return results;
    } catch (error) {
      // Log error for debugging
      console.error('Error executing user sync:', error);

      // Return user-friendly error message
      if (error instanceof Error) {
        throw new HttpsError(
          'internal',
          `Failed to sync users: ${error.message}`,
        );
      }

      throw new HttpsError('internal', 'An unknown error occurred during sync');
    }
  },
);
