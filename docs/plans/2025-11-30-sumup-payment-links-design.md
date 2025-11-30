# SumUp Payment Links via Slack - Design Document

**Date:** 2025-11-30
**Status:** Approved
**Author:** Claude (Brainstorming with User)

## Overview

Add functionality to send payment links via Slack using SumUp Checkout API, allowing users to pay their CHaaS balance online via card payment.

## Goals

- Enable sending payment links from the Pay tab in Account UI
- Generate one-time SumUp checkout links with exact payment amount
- Deliver payment links via Slack Direct Message
- Automatically record payments when confirmed via SumUp webhook
- Maintain audit trail and security

## Architecture

### High-Level Flow

1. User opens Pay tab in AccountDrawer, enters payment amount (e.g., €5.50)
2. User clicks "Send Payment Link via Slack" button
3. Cloud Function creates one-time SumUp checkout and sends Slack DM
4. User clicks link in Slack, completes payment on SumUp's secure page
5. SumUp sends webhook notification to backend
6. Webhook handler validates payment and records transaction in Firestore

### Components

**Frontend:**
- New button in Pay tab: "Send Payment Link via Slack"
- Loading states and toast notifications
- Uses existing amount input field

**Backend (2 new Cloud Functions + 1 shared service):**
1. `sendPaymentLink` - Callable function (authenticated)
2. `handleSumUpWebhook` - HTTP function (public endpoint)
3. `shared/sumupService.ts` - Shared SumUp API integration

**Environment Variables:**
```bash
SUMUP_API_KEY=sup_sk_xxxxx...
SUMUP_MERCHANT_CODE=MCxxxxx
SLACK_BOT_TOKEN=xoxb-xxxxx...  # Already exists
```

## Detailed Design

### 1. Frontend Implementation

**Location:** `/src/components/AccountDrawer.tsx` (Pay tab, lines 418-501)

**UI Changes:**

Current Pay tab has:
- Amount input field
- "Submit Payment" button (manual payment)

Add below existing button:
- "📤 Send Payment Link via Slack" button

**Button Behavior:**
- Disabled if: amount empty/zero, or user not signed in
- Shows loading spinner while sending
- Success toast: "Payment link sent to {name} on Slack!"
- Error toast: "Failed to send payment link: {error}"

**Implementation Details:**
- Import `sendPaymentLink` Cloud Function
- Add `handleSendPaymentLink` async function
- Add `isLoading` state
- Use Chakra UI's `useToast()`

### 2. Cloud Function: sendPaymentLink

**Location:** `/functions/src/sendPaymentLink.ts`

**Type:** `onCall` (authenticated, callable from frontend)

**Input:**
```typescript
{
  accountId: string;
  amount: number;
}
```

**Logic:**
1. Validate authentication (require `request.auth`)
2. Validate inputs (accountId non-empty, amount positive)
3. Fetch account from Firestore
4. Create SumUp checkout via `sumupService.createCheckout()`:
   - amount: amount
   - currency: "EUR"
   - checkout_reference: accountId
   - description: "CHaaS payment for {name}"
   - merchant_code: SUMUP_MERCHANT_CODE
   - webhook_url: full URL to handleSumUpWebhook
5. Send Slack DM via Slack Web API:
   - User: account.slack.id
   - Message: "Hi {name}! Please pay €{amount} for your CHaaS balance: {checkout_url}"
   - Use SLACK_BOT_TOKEN
6. Return success with checkout_id

**Error Handling:**
- Account not found → `functions/not-found`
- SumUp API error → `functions/internal`
- Slack API error → `functions/internal`
- Invalid inputs → `functions/invalid-argument`

### 3. Cloud Function: handleSumUpWebhook

**Location:** `/functions/src/handleSumUpWebhook.ts`

**Type:** `onRequest` (HTTP endpoint, public)

**URL:** `https://[region]-[project-id].cloudfunctions.net/handleSumUpWebhook`

**Logic:**
1. Verify webhook signature using `sumupService.validateWebhookSignature()`
   - Return 401 if invalid
2. Parse webhook payload:
   - checkout_reference (accountId)
   - amount
   - status (PAID, PENDING, FAILED)
   - currency
3. If status !== "PAID":
   - Log event
   - Return 200 OK
   - Exit
4. If status === "PAID":
   - Validate account exists
   - Call `addPayment(admin.firestore(), accountId, amount)`
   - Log success
   - Return 200 OK

**Error Handling:**
- Invalid signature → 401 Unauthorized
- Account not found → Log error, return 200 (don't retry)
- Firestore error → Log error, return 500 (SumUp retries)

**Idempotency:** Not implemented initially. If duplicate webhooks cause issues, can add checkout_id tracking later.

### 4. Shared SumUp Service

**Location:** `/functions/src/shared/sumupService.ts`

**Function: createCheckout()**
```typescript
async function createCheckout(params: {
  amount: number;
  currency: string;
  checkoutReference: string;
  description: string;
  merchantCode: string;
  webhookUrl: string;
}): Promise<{ checkoutId: string; checkoutUrl: string }>
```

- POST to `https://api.sumup.com/v0.1/checkouts`
- Auth: `Authorization: Bearer ${SUMUP_API_KEY}`
- Returns checkout ID and payment URL
- Throws on API errors

**Function: validateWebhookSignature()**
```typescript
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean
```

- Verifies SumUp webhook signature using HMAC-SHA256
- Returns true if valid, false otherwise
- If SumUp doesn't provide signature, returns true (placeholder)

**Error Handling:**
- Network errors
- 401 (invalid API key)
- 400 (invalid merchant code)
- 429 (rate limiting)

## Data Model

No changes to existing data model. Payments recorded using existing `addPayment()` function from `/src/services/transaction.ts`.

**Note:** Not storing SumUp transaction_id initially. Webhook signature validation ensures payment legitimacy.

## Security

1. **Webhook Validation:** Signature verification prevents fake payment notifications
2. **Authentication:** `sendPaymentLink` requires Firebase auth
3. **Input Validation:** Amount must be positive, accountId verified
4. **One-time Checkout:** SumUp checkout links expire after use
5. **Private Communication:** Slack DMs keep payment info private

## Testing Strategy

**Local Development:**
1. Use Firebase emulators
2. Test `sendPaymentLink` from UI
3. Mock SumUp API or use SumUp test mode
4. Simulate webhook with curl/Postman
5. Test Slack DMs to test channel

**Production Testing:**
1. Deploy functions
2. Test with €0.01 to real account
3. Verify: Send link → Slack DM → Payment → Webhook → Balance update

**Deployment Commands:**
```bash
# Set environment variables
firebase functions:config:set sumup.api_key="sup_sk_xxxxx"
firebase functions:config:set sumup.merchant_code="MCxxxxx"

# Deploy functions
firebase deploy --only functions:sendPaymentLink,functions:handleSumUpWebhook
```

## Future Enhancements (Out of Scope)

- Payment history showing "Paid via SumUp" vs "Manual payment"
- Retry logic if Slack DM fails
- Admin dashboard for payment link tracking
- Email fallback if Slack unavailable
- Store SumUp transaction_id for refunds/disputes
- Idempotency for webhook duplicate prevention

## Success Criteria

- User can send payment link from Pay tab
- Payment link delivered via Slack DM
- User completes payment on SumUp
- Balance automatically updates in CHaaS
- No manual intervention required
- Audit trail in Firestore transactions

## Dependencies

- SumUp API account with API key and merchant code
- Slack bot with DM permissions (already configured)
- Firebase Cloud Functions
- Existing `addPayment()` function
