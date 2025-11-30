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
  const batch = firestore.batch();
  const transactionRef = transactionId
    ? firestore.collection('transactions').doc(transactionId)
    : firestore.collection('transactions').doc();
  const accountRef = firestore.collection('accounts').doc(accountId);
  const timestamp = Date.now();

  batch.set(transactionRef, {
    id: transactionRef.id,
    type: 'payment',
    account: accountId,
    amount,
    timestamp,
  });

  batch.update(accountRef, {
    'activity.totalPaid': FieldValue.increment(amount),
    'activity.lastPaymentTimestamp': timestamp,
  });

  await batch.commit();
}
