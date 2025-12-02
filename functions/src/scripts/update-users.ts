import {exit} from 'process';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeUpdateUsers} from '../shared/updateUsersLogic.js';

// Validate token
const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error('Error: SLACK_BOT_TOKEN environment variable required');
  console.error('Set it with: export SLACK_BOT_TOKEN=xoxb-your-token-here');
  exit(1);
}

// Dry-run mode (default: true for safety)
const isDryRun = process.env.DRY_RUN !== 'false';

// Initialize Firebase Admin with emulator
const app = initializeApp({
  projectId: 'chaas-dev',
});

const firestore = getFirestore(app);

// Connect to emulators
firestore.settings({
  host: 'localhost:8080',
  ssl: false,
});

const main = async () => {
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied');
    console.log('   Set DRY_RUN=false to apply changes\n');
  }

  console.log('Fetching data...');

  try {
    // Execute the sync using shared logic
    const results = await executeUpdateUsers({
      slackBotToken: token,
      firestore,
      dryRun: isDryRun,
    });

    console.log(`✓ Found ${results.slackWorkspace} workspace\n`);
    console.log('Processing accounts...');
    console.log(
      `→ ${String(results.summary.created)} accounts to create (new employees)`,
    );
    console.log(
      `→ ${String(results.summary.deleted)} accounts to delete (no Slack + no purchases)`,
    );
    console.log(`→ ${String(results.summary.updated)} accounts to update`);
    console.log(`→ ${String(results.summary.total)} total changes\n`);

    if (results.summary.total === 0) {
      console.log('No changes needed.');
    } else if (isDryRun) {
      console.log('🔍 DRY RUN - Changes identified but not applied:');
      console.log(
        `   ${String(results.summary.total)} total operations would be performed`,
      );
      console.log(`   Run with DRY_RUN=false to apply changes`);
    } else {
      console.log('Applying changes...\n');

      // Log details of changes
      for (const created of results.details.created) {
        console.log(`+ Created: ${created.name} (${created.id})`);
      }

      for (const updated of results.details.updated) {
        const changeParts = updated.changes.map((change) => {
          if (change === 'isEmployee') {
            return `isEmployee→${String(updated.after.isEmployee)}`;
          }
          return change;
        });
        console.log(
          `✓ Updated ${changeParts.join(', ')}: ${updated.name} (${updated.id})`,
        );
      }

      for (const deleted of results.details.deleted) {
        console.log(`✗ Deleted: ${deleted.name} (${deleted.id})`);
      }

      console.log(
        `\n✓ Complete! ${String(results.summary.total)} changes applied.`,
      );
    }
  } catch (error) {
    console.error('Error:', error);
    exit(1);
  }

  exit(0);
};

main().catch((error: unknown) => {
  console.error('Error:', error);
  exit(1);
});
