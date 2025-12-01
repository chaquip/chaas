import {onRequest} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {getCheckoutDetails} from './shared/sumupService.js';
import {addPayment} from './shared/transactionService.js';

export const validatePayment = onRequest(async (req, res) => {
  // Only accept POST requests (SumUp webhooks)
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Parse webhook payload from SumUp
    // Expected format: { "event_type": "CHECKOUT_STATUS_CHANGED", "id": "checkout-id" }
    const webhookPayload = req.body;

    if (
      !webhookPayload ||
      webhookPayload.event_type !== 'CHECKOUT_STATUS_CHANGED'
    ) {
      console.error('Invalid webhook payload:', webhookPayload);
      res.status(400).send('Bad Request - Invalid webhook payload');
      return;
    }

    const checkoutId = webhookPayload.id;
    if (!checkoutId) {
      console.error('Missing checkout ID in webhook payload');
      res.status(400).send('Bad Request - Missing checkout ID');
      return;
    }

    console.log('Received webhook for checkout:', checkoutId);

    // Get accountId from query parameter
    const accountIdEncoded = req.query.accountId as string;
    if (!accountIdEncoded) {
      console.error('Missing accountId in query parameter');
      res.status(400).send('Bad Request - Missing account ID');
      return;
    }
    const accountId = decodeURIComponent(accountIdEncoded);

    // Fetch checkout details from SumUp to verify payment
    // This is required by SumUp: always verify webhook events via API
    const checkout = await getCheckoutDetails(checkoutId);

    // Verify payment was successful
    if (checkout.status !== 'PAID') {
      console.log(`Payment not yet completed. Status: ${checkout.status}`);
      res.status(200).send(); // Acknowledge webhook, don't retry
      return;
    }

    // checkout_reference contains the transactionId
    const transactionId = checkout.checkout_reference;

    console.log('Payment validated:', {
      accountId,
      transactionId,
      amount: checkout.amount,
      status: checkout.status,
    });

    // Verify account exists
    const firestore = getFirestore();
    const accountDoc = await firestore
      .collection('accounts')
      .doc(accountId)
      .get();

    if (!accountDoc.exists) {
      console.error(`Account not found: ${accountId}`);
      res.status(404).send('Account not found');
      return;
    }

    // Check if payment already recorded (idempotency)
    const existingTransaction = await firestore
      .collection('transactions')
      .doc(transactionId)
      .get();

    if (existingTransaction.exists) {
      console.log(`Payment already recorded: ${transactionId}`);
      res.status(200).send(); // Acknowledge webhook (idempotency)
      return;
    }

    // Record payment with the same transaction ID as checkout_reference
    await addPayment(firestore, accountId, checkout.amount, transactionId);

    console.log(
      `Payment recorded: €${checkout.amount.toString()} for account ${accountId} (transaction: ${transactionId})`,
    );

    res.status(200).send(); // Acknowledge webhook success
  } catch (error) {
    console.error('Error validating payment:', error);

    if (error instanceof Error) {
      res.status(500).send(`Internal Server Error: ${error.message}`);
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
});
