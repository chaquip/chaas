/* eslint-disable @typescript-eslint/no-explicit-any */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {addPayment} from './transactionService';

// Mock Firestore
interface BatchOp {
  type: 'set' | 'update' | 'delete';
  ref: {id: string};
  data?: unknown;
}

const createMockFirestore = (existingTransactionIds: string[] = []) => {
  const batchOps: BatchOp[] = [];
  // Track created transactions to simulate state changes
  const createdTransactionIds = new Set(existingTransactionIds);
  // Queue to ensure transactions run serially (like real Firestore)
  let transactionLock = Promise.resolve();

  return {
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => {
        const docId = id ?? 'generated-id-123';
        return {
          id: docId,
          // Check happens here - reads current state
          get: vi.fn(async () => {
            // Add small delay to make race condition more likely
            await new Promise((resolve) => setTimeout(resolve, 1));
            return {
              exists: createdTransactionIds.has(docId),
            };
          }),
        };
      }),
      get: vi.fn(),
    })),
    batch: vi.fn(() => {
      const batchSets: {ref: any}[] = [];
      return {
        set: vi.fn((ref, data) => {
          batchOps.push({type: 'set', ref, data});
          batchSets.push({ref});
        }),
        update: vi.fn((ref, data) => {
          batchOps.push({type: 'update', ref, data});
        }),
        delete: vi.fn((ref) => {
          batchOps.push({type: 'delete', ref});
        }),
        // Commit happens here - state changes are applied
        commit: vi.fn(async () => {
          // Add small delay to make race condition more likely
          await new Promise((resolve) => setTimeout(resolve, 1));
          // Mark transactions as created
          for (const {ref} of batchSets) {
            createdTransactionIds.add(ref.id);
          }
        }),
      };
    }),
    runTransaction: vi.fn(async (updateFunction: any) => {
      // Ensure transactions run serially (simulating Firestore's isolation)
      const previousTransaction = transactionLock;
      let resolveThisTransaction: (() => void) | undefined;
      transactionLock = new Promise((resolve) => {
        resolveThisTransaction = resolve;
      });

      await previousTransaction;

      try {
        const mockTransaction = {
          get: vi.fn((ref: any) => {
            return Promise.resolve({
              exists: createdTransactionIds.has(ref.id),
            });
          }),
          set: vi.fn((ref: any) => {
            // Simulate adding the transaction to the database
            createdTransactionIds.add(ref.id);
          }),
          update: vi.fn(),
        };
        const result = await updateFunction(mockTransaction);
        if (resolveThisTransaction) resolveThisTransaction();
        return result;
      } catch (error) {
        if (resolveThisTransaction) resolveThisTransaction();
        throw error;
      }
    }),
    _batchOps: batchOps,
  };
};

describe('addPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent race condition - only one concurrent request succeeds', async () => {
    const mockFirestore = createMockFirestore([]);
    const accountId = 'account-123';
    const amount = 50;
    const transactionId = 'race-condition-transaction-id';

    // Simulate two concurrent requests trying to create the same transaction
    const request1 = addPayment(
      mockFirestore as any,
      accountId,
      amount,
      transactionId,
    );
    const request2 = addPayment(
      mockFirestore as any,
      accountId,
      amount,
      transactionId,
    );

    // One should succeed, one should fail
    const results = await Promise.allSettled([request1, request2]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason.message === 'Transaction already exists',
    );

    // Exactly one should succeed
    expect(succeeded.length).toBe(1);
    // Exactly one should fail with our error
    expect(failed.length).toBe(1);
  });
});
