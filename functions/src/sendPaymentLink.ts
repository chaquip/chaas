import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {WebClient} from '@slack/web-api';
import {randomUUID} from 'crypto';
import {defineSecret} from 'firebase-functions/params';
import {createCheckout} from './shared/sumupService.js';

interface SendPaymentLinkRequest {
  accountId: string;
  amount: number;
}

// Define secrets
const slackBotToken = defineSecret('SLACK_BOT_TOKEN');
const sumupApiKey = defineSecret('SUMUP_API_KEY');
const sumupMerchantCode = defineSecret('SUMUP_MERCHANT_CODE');

export const sendPaymentLink = onCall(
  {
    secrets: [slackBotToken, sumupApiKey, sumupMerchantCode],
  },
  async (request) => {
    // Authentication check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const data = request.data as SendPaymentLinkRequest;

    // Validate inputs
    if (!data.accountId || typeof data.accountId !== 'string') {
      throw new HttpsError('invalid-argument', 'accountId is required');
    }

    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
      throw new HttpsError(
        'invalid-argument',
        'amount must be a positive number',
      );
    }

    // Get secret and config values
    const merchantCode = sumupMerchantCode.value();
    const token = slackBotToken.value();

    if (!merchantCode) {
      throw new HttpsError(
        'failed-precondition',
        'SUMUP_MERCHANT_CODE not configured',
      );
    }

    if (!token) {
      throw new HttpsError(
        'failed-precondition',
        'SLACK_BOT_TOKEN not configured',
      );
    }

    try {
      // Fetch account from Firestore
      const firestore = getFirestore();
      const accountDoc = await firestore
        .collection('accounts')
        .doc(data.accountId)
        .get();

      if (!accountDoc.exists) {
        throw new HttpsError('not-found', 'Account not found');
      }

      const account = accountDoc.data() as {
        slack: {
          id: string;
          name: string;
        };
      };

      // Generate a unique transaction ID
      const transactionId = randomUUID();

      // Use transactionId as checkout_reference
      const checkoutReference = transactionId;

      // Build webhook return URL with accountId as query parameter
      // SumUp will POST to this URL with checkout status changes
      const functionUrl =
        process.env.SUMUP_WEBHOOK_URL ??
        `https://us-central1-${process.env.GCLOUD_PROJECT ?? 'unknown-project'}.cloudfunctions.net/handleSumUpWebhook`;
      const returnUrl = `${functionUrl}?accountId=${encodeURIComponent(data.accountId)}`;

      // Create SumUp checkout
      const checkout = await createCheckout({
        amount: data.amount,
        currency: 'EUR',
        checkoutReference,
        description: `Chaquip payment for ${account.slack.name}`,
        merchantCode: merchantCode,
        returnUrl,
        apiKey: sumupApiKey.value(),
      });

      console.log('Created SumUp checkout:', returnUrl);

      // Send Slack DM
      const slackClient = new WebClient(token);
      await slackClient.chat.postMessage({
        channel: account.slack.id,
        text: `:chaquip-cat: Hey dear Chaquiper! :chaquip-cat:
:money_with_wings: Time to settle your Chaquip tab!
You owe ${data.amount.toFixed(2)}€ to the Chaquip.
You can pay using <${checkout.checkoutUrl}|this link>.
Bisous`,
        unfurl_links: false,
      });

      return {
        success: true,
        checkoutId: checkout.checkoutId,
      };
    } catch (error) {
      console.error('Error sending payment link:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new HttpsError(
          'internal',
          `Failed to send payment link: ${error.message}`,
        );
      }

      throw new HttpsError('internal', 'An unknown error occurred');
    }
  },
);
