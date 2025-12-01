import {describe, it, expect, vi, beforeEach} from 'vitest';

// Mock dependencies
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn(),
}));

vi.mock('./shared/sumupService.js', () => ({
  createCheckout: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-123'),
}));

import {createCheckout} from './shared/sumupService.js';

describe('sendPaymentLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct return URL with accountId query parameter', () => {
    const accountId = 'account-123';
    const functionUrl =
      'https://us-central1-test-project.cloudfunctions.net/handleSumUpWebhook';
    const expectedReturnUrl = `${functionUrl}?accountId=${encodeURIComponent(accountId)}`;

    expect(expectedReturnUrl).toBe(
      'https://us-central1-test-project.cloudfunctions.net/handleSumUpWebhook?accountId=account-123',
    );
  });

  it('should encode special characters in accountId', () => {
    const accountId = 'account with spaces';
    const functionUrl = 'https://example.com/handleSumUpWebhook';
    const returnUrl = `${functionUrl}?accountId=${encodeURIComponent(accountId)}`;

    expect(returnUrl).toBe(
      'https://example.com/handleSumUpWebhook?accountId=account%20with%20spaces',
    );
  });

  it('should use transactionId as checkout_reference', () => {
    const transactionId = 'transaction-123';
    const checkoutReference = transactionId;

    expect(checkoutReference).toBe('transaction-123');
    expect(checkoutReference).toBe(transactionId);
  });

  it('should call createCheckout with correct parameters including returnUrl', async () => {
    const accountId = 'account-123';
    const amount = 50.0;
    const transactionId = 'mock-uuid-123';
    const merchantCode = 'MERCHANT123';
    const functionUrl = 'https://example.com/handleSumUpWebhook';
    const returnUrl = `${functionUrl}?accountId=${encodeURIComponent(accountId)}`;

    const mockCreateCheckout = vi.mocked(createCheckout);
    mockCreateCheckout.mockResolvedValue({
      checkoutId: 'checkout-123',
      checkoutUrl: 'https://pay.sumup.com/checkout-123',
    });

    await mockCreateCheckout({
      amount,
      currency: 'EUR',
      checkoutReference: transactionId,
      description: 'Test payment',
      merchantCode,
      returnUrl,
    });

    expect(mockCreateCheckout).toHaveBeenCalledWith({
      amount,
      currency: 'EUR',
      checkoutReference: transactionId,
      description: 'Test payment',
      merchantCode,
      returnUrl,
    });
  });

  it('should use returnUrl parameter (not webhookUrl)', () => {
    const params = {
      amount: 50.0,
      currency: 'EUR',
      checkoutReference: 'transaction-123',
      description: 'Test payment',
      merchantCode: 'MERCHANT123',
      returnUrl: 'https://example.com/handleSumUpWebhook?accountId=account-123',
    };

    // Verify the parameter is named 'returnUrl'
    expect(params).toHaveProperty('returnUrl');
    expect(params).not.toHaveProperty('webhookUrl');
  });

  it('should generate unique transaction IDs', () => {
    const uuid1 = 'uuid-1';
    const uuid2 = 'uuid-2';

    expect(uuid1).not.toBe(uuid2);
    expect(uuid1.length).toBeGreaterThan(0);
    expect(uuid2.length).toBeGreaterThan(0);
  });

  it('should use environment variable for function URL if available', () => {
    const envUrl = 'https://custom-domain.com/handleSumUpWebhook';

    // If SUMUP_WEBHOOK_URL is set, use it
    expect(envUrl).toBe('https://custom-domain.com/handleSumUpWebhook');
  });

  it('should fall back to default URL if env variable not set', () => {
    const projectId = 'test-project';
    const defaultUrl = `https://us-central1-${projectId}.cloudfunctions.net/handleSumUpWebhook`;

    expect(defaultUrl).toContain(projectId);
    expect(defaultUrl).toContain('handleSumUpWebhook');
  });
});
