import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {WebClient} from '@slack/web-api';
import {randomUUID} from 'crypto';
import {createCheckout} from './shared/sumupService.js';

interface SendPaymentLinkRequest {
  accountId: string;
  amount: number;
}

export const sendPaymentLink = onCall(async (request) => {
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

  // Get environment variables
  const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE;
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  if (!sumupMerchantCode) {
    throw new HttpsError(
      'failed-precondition',
      'SUMUP_MERCHANT_CODE not configured',
    );
  }

  if (!slackBotToken) {
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
      process.env.VALIDATE_PAYMENT_URL ||
      `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/validatePayment`;
    const returnUrl = `${functionUrl}?accountId=${encodeURIComponent(data.accountId)}`;

    // Create SumUp checkout
    const checkout = await createCheckout({
      amount: data.amount,
      currency: 'EUR',
      checkoutReference,
      description: `Chaquip payment for ${account.slack.name}`,
      merchantCode: sumupMerchantCode,
      returnUrl,
    });

    console.log('Created SumUp checkout:', returnUrl);

    // Send Slack DM
    const slackClient = new WebClient(slackBotToken);
    await slackClient.chat.postMessage({
      channel: account.slack.id,
      text: `Hi ${account.slack.name}! Please pay €${data.amount.toFixed(2)} for your Chaquip balance: ${checkout.checkoutUrl}`,
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
});
