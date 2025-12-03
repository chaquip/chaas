import {onRequest} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {randomUUID} from 'crypto';
import {createCheckout} from './shared/sumupService.js';

interface AccountData {
  slack: {
    id: string;
    name: string;
  };
  activity: {
    totalPurchased: number;
    totalPaid: number;
  };
}

export const getPaymentLinkForSlackUser = onRequest(async (req, res) => {
  // Only accept GET requests
  if (req.method !== 'GET') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  // Authenticate using Bearer token
  const authHeader = req.headers.authorization;
  const apiKey = process.env.CHAQUIP_API_KEY;

  if (!apiKey) {
    console.error('CHAQUIP_API_KEY not configured');
    res.status(500).json({error: 'Internal server error'});
    return;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (token !== apiKey) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  // Validate slackUserId parameter
  const slackUserId = req.query.slackUserId;
  if (!slackUserId || typeof slackUserId !== 'string') {
    res.status(400).json({error: 'Missing or invalid slackUserId parameter'});
    return;
  }

  try {
    // Look up account by slack.id
    const firestore = getFirestore();
    const accountsSnapshot = await firestore
      .collection('accounts')
      .where('slack.id', '==', slackUserId)
      .limit(1)
      .get();

    if (accountsSnapshot.empty) {
      res.status(404).json({error: 'No account found with that Slack user ID'});
      return;
    }

    const accountDoc = accountsSnapshot.docs[0];
    const account = accountDoc.data() as AccountData;
    const accountId = accountDoc.id;

    // Calculate balance: totalPurchased - totalPaid
    // Negative balance means user owes money
    const balance =
      account.activity.totalPaid - account.activity.totalPurchased;

    // If user is paid up (balance >= 0), return just the balance
    if (balance >= 0) {
      res.status(200).json({balance});
      return;
    }

    // User owes money (balance < 0) - generate payment link
    const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE;
    if (!sumupMerchantCode) {
      console.error('SUMUP_MERCHANT_CODE not configured');
      res.status(500).json({error: 'Internal server error'});
      return;
    }

    // Generate unique checkout reference
    const checkoutReference = randomUUID();

    // Build webhook return URL with accountId
    const functionUrl =
      process.env.SUMUP_WEBHOOK_URL ??
      `https://us-central1-${process.env.GCLOUD_PROJECT ?? 'unknown-project'}.cloudfunctions.net/handleSumUpWebhook`;
    const returnUrl = `${functionUrl}?accountId=${encodeURIComponent(accountId)}`;

    // Create SumUp checkout for the amount owed (absolute value of balance)
    const checkout = await createCheckout({
      amount: Math.abs(balance),
      currency: 'EUR',
      checkoutReference,
      description: `Chaquip payment for ${account.slack.name}`,
      merchantCode: sumupMerchantCode,
      returnUrl,
    });

    console.log(
      `Created SumUp checkout for user ${slackUserId}:`,
      checkout.checkoutId,
    );

    res.status(200).json({
      balance,
      paymentLink: checkout.checkoutUrl,
    });
  } catch (error) {
    console.error('Error in getPaymentLinkForSlackUser:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
    });
  }
});
