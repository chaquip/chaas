# Slack User Payment Link Endpoint Design

**Date:** 2025-12-01
**Status:** Approved

## Overview

Create a new HTTP GET endpoint that accepts a Slack user ID, retrieves the user's balance, and conditionally generates a SumUp payment link if the user owes money.

## API Specification

### Endpoint
`GET /getPaymentLinkForSlackUser`

### Request
```
GET /getPaymentLinkForSlackUser?slackUserId=U12345
Authorization: Bearer <static-api-key>
```

### Response

**User owes money (balance < 0):**
```json
{
  "balance": -15.50,
  "paymentLink": "https://pay.sumup.com/checkout/..."
}
```

**User is paid up (balance >= 0):**
```json
{
  "balance": 0.00
}
```

### Error Cases
- `401 Unauthorized`: Missing or invalid API key
- `400 Bad Request`: Missing `slackUserId` parameter
- `404 Not Found`: No account found with that Slack user ID
- `500 Internal Server Error`: Firestore or SumUp API errors

## Architecture & Flow

### Request Flow
1. External service makes GET request with `slackUserId` query param
2. Middleware validates `Authorization: Bearer <api-key>` header against `CHAQUIP_API_KEY` env var
3. Function looks up account by `slack.id` field in Firestore
4. Calculate balance: `totalPurchased - totalPaid`
5. If balance < 0 (user owes money):
   - Generate SumUp checkout for absolute value of balance
   - Return `{balance, paymentLink}`
6. If balance >= 0 (user paid up or has credit):
   - Return `{balance}` with no payment link

### Technology Choices
- Use `onRequest` from `firebase-functions/v2/https` (not `onCall`) for GET endpoint
- Reuse existing `createCheckout` from `functions/src/shared/sumupService.ts`
- Follow same pattern as `functions/src/sendPaymentLink.ts` but adapted for HTTP/REST

## Implementation Details

### File Structure
- New file: `functions/src/getPaymentLinkForSlackUser.ts`
- Export from `functions/src/index.ts`
- Reuse `functions/src/shared/sumupService.ts` for checkout creation

### Key Logic

**1. Authentication:**
Validate `Authorization: Bearer <token>` header against `process.env.CHAQUIP_API_KEY`

**2. Account Lookup:**
Query Firestore where `slack.id == slackUserId`

**3. Balance Calculation:**
```typescript
const balance = account.activity.totalPurchased - account.activity.totalPaid
```

**4. Conditional Payment Link:**
- If `balance < 0`: call `createCheckout()` with `amount: Math.abs(balance)`
- If `balance >= 0`: return early with just balance

### Environment Variables

**New:**
- `CHAQUIP_API_KEY` - Static API key for authentication

**Existing (reused):**
- `SUMUP_API_KEY` - For SumUp checkout creation
- `SUMUP_MERCHANT_CODE` - For merchant identification
- `SUMUP_WEBHOOK_URL` - For payment webhooks

### SumUp Checkout Configuration

- `amount`: Absolute value of negative balance
- `currency`: 'EUR'
- `description`: "Chaquip payment for {slack.name}"
- `checkout_reference`: Generated UUID for transaction tracking
- `merchant_code`: From `SUMUP_MERCHANT_CODE` env var
- `return_url`: Point to existing `handleSumUpWebhook` with `accountId` query parameter

### Webhook Integration

The existing `handleSumUpWebhook` will process payments and call `addPayment()` from `transactionService.ts`, which automatically updates `activity.totalPaid` so balance reflects payment immediately.

## Error Handling

- Validate API key first (fail fast on auth errors)
- Validate required parameters (slackUserId)
- Graceful Firestore errors with proper logging
- SumUp API errors return 500 with descriptive message
- Follow same error handling pattern as `sendPaymentLink.ts`

## Testing Strategy

**Unit tests** (similar to `sendPaymentLink.unit.test.ts`):
- Mock Firestore queries
- Mock SumUp API calls
- Test cases:
  - Negative balance (returns payment link)
  - Zero balance (no payment link)
  - Positive balance (no payment link)
  - Missing user (404 error)
  - Invalid API key (401 error)
