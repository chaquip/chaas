import type {Firestore} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';

/**
 * Records a payment transaction and updates account balance
 * Admin SDK version of addPayment from src/services/transaction.ts
 */
export async function addPayment(
  firestore: Firestore,
  accountId: string,
  amount: number,
  transactionId?: string,
): Promise<void> {
  const transactionRef = transactionId
    ? firestore.collection('transactions').doc(transactionId)
    : firestore.collection('transactions').doc();
  const accountRef = firestore.collection('accounts').doc(accountId);
  const timestamp = Date.now();

  await firestore.runTransaction(async (transaction) => {
    // Check if transaction already exists (atomic read)
    const existingTransaction = await transaction.get(transactionRef);
    if (existingTransaction.exists) {
      throw new Error('Transaction already exists');
    }

    // Create transaction and update account (atomic write)
    transaction.set(transactionRef, {
      id: transactionRef.id,
      type: 'payment',
      account: accountId,
      amount,
      timestamp,
    });

    transaction.update(accountRef, {
      'activity.totalPaid': FieldValue.increment(amount),
      'activity.lastPaymentTimestamp': timestamp,
    });
  });
}
