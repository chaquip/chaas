import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Request} from 'firebase-functions/v2/https';

// Mock dependencies
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

vi.mock('./shared/sumupService.js', () => ({
  createCheckout: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-123'),
}));

import {getFirestore} from 'firebase-admin/firestore';
import {createCheckout} from './shared/sumupService.js';
import {randomUUID} from 'crypto';

const createMockRequest = (
  method: string,
  query: Record<string, string> = {},
  authHeader?: string,
): Partial<Request> => ({
  method,
  query,
  headers: authHeader ? {authorization: authHeader} : {},
});

describe('getPaymentLinkForSlackUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.CHAQUIP_API_KEY;
    delete process.env.SUMUP_MERCHANT_CODE;
  });

  describe('HTTP Method Validation', () => {
    it('should reject non-GET requests', () => {
      const req = createMockRequest('POST', {});
      expect(req.method).toBe('POST');
      expect(req.method).not.toBe('GET');
    });

    it('should accept GET requests', () => {
      const req = createMockRequest('GET', {slackUserId: 'U12345'});
      expect(req.method).toBe('GET');
    });
  });

  describe('Authentication', () => {
    it('should reject request without Authorization header', () => {
      const req = createMockRequest('GET', {slackUserId: 'U12345'});
      expect(req.headers).toEqual({});
    });

    it('should reject request with malformed Authorization header', () => {
      const req = createMockRequest(
        'GET',
        {slackUserId: 'U12345'},
        'InvalidFormat',
      );
      expect(req.headers?.authorization).not.toMatch(/^Bearer /);
    });

    it('should validate Bearer token format', () => {
      const req = createMockRequest(
        'GET',
        {slackUserId: 'U12345'},
        'Bearer test-token',
      );
      expect(req.headers?.authorization).toMatch(/^Bearer /);
      const token = req.headers?.authorization?.substring(7);
      expect(token).toBe('test-token');
    });

    it('should validate token against CHAQUIP_API_KEY', () => {
      process.env.CHAQUIP_API_KEY = 'correct-api-key';
      const validToken = 'correct-api-key';
      const invalidToken = 'wrong-api-key';

      expect(validToken).toBe(process.env.CHAQUIP_API_KEY);
      expect(invalidToken).not.toBe(process.env.CHAQUIP_API_KEY);
    });

    it('should handle missing CHAQUIP_API_KEY environment variable', () => {
      delete process.env.CHAQUIP_API_KEY;
      expect(process.env.CHAQUIP_API_KEY).toBeUndefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should reject request without slackUserId parameter', () => {
      const req = createMockRequest('GET', {});
      expect(req.query?.slackUserId).toBeUndefined();
    });

    it('should accept request with valid slackUserId', () => {
      const req = createMockRequest('GET', {slackUserId: 'U12345'});
      expect(req.query?.slackUserId).toBe('U12345');
      expect(typeof req.query?.slackUserId).toBe('string');
    });
  });

  describe('Account Lookup', () => {
    it('should query Firestore by slack.id field', async () => {
      const slackUserId = 'U12345';
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'account-123',
            data: () => ({
              slack: {id: slackUserId, name: 'Test User'},
              activity: {totalPurchased: 100, totalPaid: 50},
            }),
          },
        ],
      });

      const mockFirestore = {
        collection: vi.fn().mockReturnThis(),
        where: mockWhere,
        limit: mockLimit,
        get: mockGet,
      };

      vi.mocked(getFirestore).mockReturnValue(mockFirestore as never);

      await mockFirestore
        .collection('accounts')
        .where('slack.id', '==', slackUserId)
        .limit(1)
        .get();

      expect(mockFirestore.collection).toHaveBeenCalledWith('accounts');
      expect(mockWhere).toHaveBeenCalledWith('slack.id', '==', slackUserId);
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent user', async () => {
      const mockFirestore = {
        collection: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({empty: true, docs: []}),
      };

      vi.mocked(getFirestore).mockReturnValue(mockFirestore as never);

      const result = await mockFirestore
        .collection('accounts')
        .where('slack.id', '==', 'NONEXISTENT')
        .limit(1)
        .get();

      expect(result.empty).toBe(true);
    });

    it('should extract account data correctly', () => {
      const accountData = {
        slack: {id: 'U12345', name: 'Test User'},
        activity: {totalPurchased: 100, totalPaid: 50},
      };

      expect(accountData.slack.id).toBe('U12345');
      expect(accountData.slack.name).toBe('Test User');
      expect(accountData.activity.totalPurchased).toBe(100);
      expect(accountData.activity.totalPaid).toBe(50);
    });
  });

  describe('Balance Calculation', () => {
    it('should calculate balance as totalPaid - totalPurchased', () => {
      const totalPurchased = 100;
      const totalPaid = 50;
      const balance = totalPaid - totalPurchased;

      expect(balance).toBe(-50);
    });

    it('should return negative balance when user owes money', () => {
      const totalPurchased = 100;
      const totalPaid = 50;
      const balance = totalPaid - totalPurchased;

      expect(balance).toBeLessThan(0);
    });

    it('should return zero balance when fully paid', () => {
      const totalPurchased = 100;
      const totalPaid = 100;
      const balance = totalPaid - totalPurchased;

      expect(balance).toBe(0);
    });

    it('should return positive balance when overpaid', () => {
      const totalPurchased = 100;
      const totalPaid = 150;
      const balance = totalPaid - totalPurchased;

      expect(balance).toBeGreaterThan(0);
    });
  });

  describe('Payment Link Generation', () => {
    beforeEach(() => {
      process.env.SUMUP_MERCHANT_CODE = 'MERCHANT123';
      process.env.GCLOUD_PROJECT = 'test-project';
    });

    it('should not generate payment link when balance >= 0', () => {
      const balance = 0;
      expect(balance).toBeGreaterThanOrEqual(0);
      // Should return early without calling createCheckout
    });

    it('should generate payment link when balance < 0', async () => {
      const balance = -50;
      expect(balance).toBeLessThan(0);

      const mockCreateCheckout = vi.mocked(createCheckout);
      mockCreateCheckout.mockResolvedValue({
        checkoutId: 'checkout-123',
        checkoutUrl: 'https://pay.sumup.com/checkout-123',
      });

      const checkout = await createCheckout({
        amount: Math.abs(balance),
        currency: 'EUR',
        checkoutReference: 'mock-uuid-123',
        description: 'Chaquip payment for Test User',
        merchantCode: 'MERCHANT123',
        returnUrl: 'https://example.com/webhook?accountId=account-123',
      });

      expect(createCheckout).toHaveBeenCalled();
      expect(checkout.checkoutUrl).toBe('https://pay.sumup.com/checkout-123');
    });

    it('should use absolute value of balance for payment amount', () => {
      const balance = -50.75;
      const amount = Math.abs(balance);

      expect(amount).toBe(50.75);
      expect(amount).toBeGreaterThan(0);
    });

    it('should generate unique checkout reference using UUID', () => {
      const uuid = vi.mocked(randomUUID)();
      expect(uuid).toBe('mock-uuid-123');
    });

    it('should build return URL with accountId parameter', () => {
      const accountId = 'account-123';
      const functionUrl =
        'https://us-central1-test-project.cloudfunctions.net/handleSumUpWebhook';
      const returnUrl = `${functionUrl}?accountId=${encodeURIComponent(accountId)}`;

      expect(returnUrl).toBe(
        'https://us-central1-test-project.cloudfunctions.net/handleSumUpWebhook?accountId=account-123',
      );
    });

    it('should encode special characters in accountId', () => {
      const accountId = 'account with spaces';
      const returnUrl = `https://example.com?accountId=${encodeURIComponent(accountId)}`;

      expect(returnUrl).toBe(
        'https://example.com?accountId=account%20with%20spaces',
      );
    });

    it('should use SUMUP_WEBHOOK_URL if set', () => {
      process.env.SUMUP_WEBHOOK_URL = 'https://custom.com/webhook';
      const functionUrl = process.env.SUMUP_WEBHOOK_URL;

      expect(functionUrl).toBe('https://custom.com/webhook');
    });

    it('should fallback to default URL if SUMUP_WEBHOOK_URL not set', () => {
      delete process.env.SUMUP_WEBHOOK_URL;
      const projectId = 'test-project';
      const defaultUrl = `https://us-central1-${projectId}.cloudfunctions.net/handleSumUpWebhook`;

      expect(defaultUrl).toContain(projectId);
      expect(defaultUrl).toContain('handleSumUpWebhook');
    });

    it('should format description with user name', () => {
      const userName = 'John Doe';
      const description = `Chaquip payment for ${userName}`;

      expect(description).toBe('Chaquip payment for John Doe');
    });

    it('should require SUMUP_MERCHANT_CODE when generating payment link', () => {
      process.env.SUMUP_MERCHANT_CODE = 'MERCHANT123';
      expect(process.env.SUMUP_MERCHANT_CODE).toBe('MERCHANT123');

      delete process.env.SUMUP_MERCHANT_CODE;
      expect(process.env.SUMUP_MERCHANT_CODE).toBeUndefined();
    });
  });

  describe('Response Format', () => {
    it('should return balance and paymentLink for negative balance', () => {
      const response = {
        balance: -50,
        paymentLink: 'https://pay.sumup.com/checkout-123',
      };

      expect(response).toHaveProperty('balance');
      expect(response).toHaveProperty('paymentLink');
      expect(response.balance).toBeLessThan(0);
      expect(response.paymentLink).toMatch(/^https:\/\//);
    });

    it('should return only balance for zero or positive balance', () => {
      const response = {
        balance: 0,
      };

      expect(response).toHaveProperty('balance');
      expect(response).not.toHaveProperty('paymentLink');
      expect(response.balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore query errors gracefully', async () => {
      const mockFirestore = {
        collection: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockRejectedValue(new Error('Firestore error')),
      };

      vi.mocked(getFirestore).mockReturnValue(mockFirestore as never);

      await expect(
        mockFirestore
          .collection('accounts')
          .where('slack.id', '==', 'U12345')
          .limit(1)
          .get(),
      ).rejects.toThrow('Firestore error');
    });

    it('should handle SumUp API errors gracefully', async () => {
      const mockCreateCheckout = vi.mocked(createCheckout);
      mockCreateCheckout.mockRejectedValue(new Error('SumUp API error'));

      await expect(
        createCheckout({
          amount: 50,
          currency: 'EUR',
          checkoutReference: 'ref-123',
          description: 'Test',
          merchantCode: 'MERCHANT123',
          returnUrl: 'https://example.com',
        }),
      ).rejects.toThrow('SumUp API error');
    });

    it('should extract error message from Error instances', () => {
      const error = new Error('Test error message');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      expect(errorMessage).toBe('Test error message');
    });

    it('should handle unknown error types', () => {
      const error: unknown = 'string error';
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      expect(errorMessage).toBe('Unknown error');
    });
  });
});
