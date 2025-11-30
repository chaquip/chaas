import {onRequest} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {getCheckoutDetails} from './shared/sumupService.js';
import {addPayment} from './shared/transactionService.js';

export const validatePayment = onRequest(async (req, res) => {
  // Only accept GET requests
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Get checkout ID from query parameter and URL decode it
    const checkoutIdEncoded = req.query.checkoutId as string;

    if (!checkoutIdEncoded) {
      console.error('Missing checkoutId in query parameter');
      res.status(400).send('Bad Request - Missing checkout ID');
      return;
    }

    const checkoutId = decodeURIComponent(checkoutIdEncoded);
    console.log('Validating payment for checkout:', checkoutId);

    // Fetch checkout details from SumUp to verify payment
    const checkout = await getCheckoutDetails(checkoutId);

    // Verify payment was successful
    if (checkout.status !== 'PAID') {
      console.error(`Payment not completed. Status: ${checkout.status}`);
      res.redirect('https://akeneo.com');
      return;
    }

    // Parse checkout_reference: format is "accountId:transactionId"
    const parts = checkout.checkout_reference.split('---');
    if (parts.length !== 2) {
      console.error('Invalid checkout_reference format:', checkout.checkout_reference);
      res.status(400).send('Bad Request - Invalid checkout reference format');
      return;
    }

    const accountId = parts[0];
    const transactionId = parts[1];

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
      res.redirect('https://akeneo.com');
      return;
    }

    // Record payment with the same transaction ID as checkout_reference
    await addPayment(firestore, accountId, checkout.amount, transactionId);

    console.log(`Payment recorded: €${checkout.amount} for account ${accountId} (transaction: ${transactionId})`);

    res.redirect('https://akeneo.com');
  } catch (error) {
    console.error('Error validating payment:', error);

    if (error instanceof Error) {
      res.status(500).send(`Internal Server Error: ${error.message}`);
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
});
