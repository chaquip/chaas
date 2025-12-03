# Chaquip as a Service (ChaasS)

A beverage expense management and payment collection system for **L'Amicale du chat qui pète**, the non-profit bar linked to Akeneo company.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [How It Works](#how-it-works)
- [External Integrations](#external-integrations)
- [Development](#development)
- [Deployment](#deployment)

## Overview

ChaasS manages the beverage service for L'Amicale du chat qui pète's bar. The system allows Akeneo employees to:

- **Track purchases**: Record drinks bought from the bar with automatic balance calculation
- **Manage debts**: See who owes money and how much in real-time
- **Process payments**: Generate and send payment links directly via Slack
- **Sync employees**: Automatically sync Akeneo's Slack workspace members with the bar's account system

The application replaces manual tracking with an automated, real-time system integrated into Akeneo's existing Slack workspace.

## Features

### 🏪 Account Management

**Real-time Dashboard**

- View all bar accounts at a glance with color-coded debt indicators
- Green: Credit or no debt
- Yellow/Orange: Small debt
- Red: Significant debt
- See each person's name, Slack avatar, and current balance

**Smart Search & Filtering**

- Instantly filter accounts by name or Slack username
- Real-time search with performance optimization
- Automatic sorting by last activity

**Account Details**

- Complete transaction history for each account
- View all purchases with item details and timestamps
- Track all payments with amounts and dates
- Delete individual transactions if needed

### 🍺 Purchase Management

**Easy Drink Selection**

- Visual card-based interface for beverage selection
- Adjust quantities for each drink type
- See item prices and pictures
- Real-time total calculation
- One-click charge to account

**Automatic Balance Updates**

- Instant balance recalculation after purchases
- Transaction history automatically updated
- All changes synced across all devices in real-time

### 💰 Payment Processing

**SumUp Integration**

- Generate secure payment links for any amount
- Send payment links directly to users via Slack DM
- Automatic payment verification and recording
- No manual intervention required

**Payment Workflow**

1. Click "Send payment link" on any account with debt
2. System generates SumUp checkout link
3. User receives Slack message with payment link
4. User pays via SumUp (credit card, Apple Pay, etc.)
5. System automatically records payment and updates balance

**Slack Command API**

- Provides HTTP API endpoint for balance lookup and payment link generation
- Used by `/chaquip` command (handled in [akeneo/product-internal-tools](https://github.com/akeneo/product-internal-tools))
- Users can check their status directly from Slack

### 👥 User Synchronization

**Automatic Slack Sync**

- One-click sync with Akeneo's Slack workspace
- Automatically creates accounts for new employees
- Updates profile information (name, username, avatar)
- Removes accounts for employees who left (if no transaction history)
- Detailed sync report showing:
  - Created accounts
  - Updated accounts
  - Deleted accounts
  - Employees vs non-employees

**Employee Detection**

- Automatically identifies Akeneo employees by email domain
- Distinguishes between @akeneo.com and @getakeneo.com addresses
- Filters out contractors and external users

### 🔐 Authentication & Security

**Secure Access**

- Email/password authentication via Firebase
- Only authenticated users can view or modify data
- All transactions are atomic (no partial updates possible)
- Webhook validation prevents fraudulent payment recording

### 📊 Transaction History

**Complete Audit Trail**

- Every purchase recorded with item details
- Every payment recorded with amount and timestamp
- Transaction deletion capability for corrections
- Full history preserved for accountability

## Tech Stack

### Frontend

- **React 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Chakra UI** - Component library for consistent design
- **Vite** - Fast build tool and dev server
- **Firebase SDK** - Real-time database client

### Backend

- **Firebase Cloud Functions** - Serverless Node.js functions
- **Firebase Firestore** - NoSQL real-time database
- **Firebase Authentication** - User management
- **TypeScript** - Type-safe backend code

### External Services

- **Slack Web API** - User sync and messaging
- **SumUp API** - Payment processing

### Infrastructure

- **Firebase Hosting** - Frontend hosting
- **Firebase Emulators** - Local development
- **GitHub Actions** - CI/CD automation

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │   Accounts   │  │  Purchases   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Firestore                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Accounts   │  │ Transactions │  │    Items     │     │
│  │  Collection  │  │  Collection  │  │  Collection  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloud Functions (Backend Logic)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  User Sync   │  │Payment Links │  │   Webhooks   │     │
│  │  (Slack)     │  │   (SumUp)    │  │   (SumUp)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────┬───────────────────┘
                     │                    │
                     ▼                    ▼
          ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │   Slack API      │  │   SumUp API      │  │ External Tools   │
          │  (User sync,     │  │  (Payment        │  │ (Slack command:  │
          │   messaging)     │  │   processing)    │  │  /chaquip)       │
          └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Data Flow

**Real-time Synchronization**

- Frontend subscribes to Firestore collections using live listeners
- Any change (purchase, payment, user sync) immediately updates all connected clients
- No page refresh needed - updates appear instantly

**Atomic Transactions**

- All balance-modifying operations use Firestore batch writes
- Ensures transaction record and account balance update together
- Prevents data inconsistencies even under concurrent access

**Serverless Backend**

- Cloud Functions handle business logic requiring elevated permissions
- Slack sync, payment link generation, and webhook processing
- Automatic scaling based on usage

## How It Works

### 1. Recording a Purchase

```
User opens AccountDrawer for a person
  ↓
Selects drinks and quantities (e.g., 2 beers, 1 soda)
  ↓
Clicks "Charge €X.XX"
  ↓
System creates purchase transactions in Firestore
  ↓
Account balance updates: totalPurchased += amount
  ↓
All connected clients see updated balance immediately
```

### 2. Processing a Payment

```
User clicks "Send payment link" on account with debt
  ↓
Cloud Function generates SumUp checkout link for debt amount
  ↓
Function sends Slack DM to person with payment link
  ↓
Person clicks link and pays via SumUp
  ↓
SumUp sends webhook to Cloud Function
  ↓
Function validates payment via SumUp API
  ↓
Function creates payment transaction in Firestore
  ↓
Account balance updates: totalPaid += amount
  ↓
Debt is cleared, all clients updated
```

### 3. Syncing Users from Slack

```
Admin clicks "Sync Users" button
  ↓
Cloud Function fetches all Slack workspace members
  ↓
Function compares Slack users with Firestore accounts
  ↓
Determines needed actions:
  - CREATE: New employees not yet in system
  - UPDATE: Changed names, avatars, or usernames
  - DELETE: People who left (only if no transaction history)
  ↓
Function executes batch operations (handles 500+ users)
  ↓
Returns detailed report
  ↓
UI displays sync results modal with counts
```

### 4. Slack Command Integration (External)

```
Employee types "/chaquip" in Slack
  ↓
Slack webhook handled by akeneo/product-internal-tools
  ↓
External repo calls getPaymentLinkForSlackUser() HTTP endpoint
  ↓
ChaasS function looks up account by Slack user ID
  ↓
Returns JSON response with balance and payment link (if debt)
  ↓
External repo formats and sends Slack message to user
  ↓
User sees balance status and payment link in Slack
```

## External Integrations

### Slack Integration

**Purpose**: User management and payment notifications

**Operations**:

- Fetch all workspace members (handles pagination for large workspaces)
- Send direct messages with payment links

**Data Retrieved**:

- User ID (unique identifier)
- Display name and username
- Profile picture URL
- Email address (for employee detection)

**Employee Detection**:

- Checks if email ends with `@akeneo.com` or `@getakeneo.com`
- Only employees are included in regular account sync
- Non-employees can be tracked but marked separately

### SumUp Payment Processing

**Purpose**: Secure online payment collection

**Operations**:

- Create hosted checkout pages with custom amounts
- Fetch checkout status and payment details
- Receive webhook notifications on payment completion

**Payment Flow**:

1. System creates checkout with amount and description
2. SumUp returns hosted checkout URL
3. Customer pays via credit card, Apple Pay, Google Pay, etc.
4. SumUp processes payment
5. SumUp sends webhook to notify system
6. System validates and records payment

**Security**:

- All webhooks validated by fetching checkout details from SumUp API
- Prevents fake payment notifications
- Idempotent processing (duplicate webhooks safely ignored)

### Firebase Services

**Firestore Database**:

- Stores accounts, transactions, and items
- Real-time listeners for live updates
- Query optimization via composite indexes

**Authentication**:

- Email/password authentication for admin access
- Session management
- Security rules enforce authentication requirement

**Cloud Functions**:

- `updateUsers` - Slack user synchronization
- `sendPaymentLink` - Payment link generation and Slack messaging
- `handleSumUpWebhook` - Payment confirmation processing
- `getPaymentLinkForSlackUser` - HTTP API endpoint for balance/payment link lookup (used by external Slack command integration)

**Hosting**:

- Serves React SPA
- Automatic SSL certificates
- Global CDN distribution

## Development

### Prerequisites

- Node.js 22+
- Yarn package manager
- Firebase CLI: `npm install -g firebase-tools`

### Setup

1. **Clone and install**:

```bash
git clone <repository-url>
cd chaas
yarn install
```

2. **Start development environment**:

```bash
yarn dev
```

This starts:

- **Vite dev server** on http://localhost:5173
- **Firestore emulator** on port 8080
- **Auth emulator** on port 9099
- **Functions emulator** on port 5001

3. **Load test data**:

```bash
yarn fixtures
```

### Available Commands

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `yarn dev`              | Start dev server + emulators         |
| `yarn build`            | Build for production                 |
| `yarn preview`          | Preview production build             |
| `yarn test:unit`        | Run unit tests                       |
| `yarn test:integration` | Run integration tests with emulators |
| `yarn lint`             | Check code quality                   |
| `yarn lint:fix`         | Fix linting issues                   |
| `yarn prettier:fix`     | Format code                          |
| `yarn tsc`              | Type check                           |

### Local Development Workflow

1. Make changes to code
2. Hot reload updates browser automatically (frontend)
3. Functions recompile automatically (backend)
4. Use Firestore emulator UI at http://localhost:4000 to inspect data
5. Test with fixtures data or create your own test accounts

### Testing

**Unit Tests**:

```bash
yarn test:unit
```

**Integration Tests** (with emulators):

```bash
yarn test:integration
```

**Watch Mode**:

```bash
yarn vitest
```

## Deployment

### Environments

- **Development**: `chaquip-dev-f52f4`

  - Website : https://chaquip-dev-f52f4.web.app/
  - Firebase console : https://console.firebase.google.com/project/chaquip-dev-f52f4/overview
  - Deployed automatically on pull requests
  - Used for testing before production

- **Production**: `chaquip-prod`
  - Website : https://chaquip-prod.web.app/
  - Firebase console : https://console.firebase.google.com/u/0/project/chaquip-prod/overview
  - Deployed automatically on merge to `main`
  - Live system used by L'Amicale du chat qui pète

### CI/CD Pipeline

**Trigger**: Push to any branch or merge to `main`

**Steps**:

1. **Code Quality**

   - Prettier formatting check
   - ESLint validation
   - TypeScript type checking

2. **Testing**

   - Unit tests (Vitest)
   - Integration tests (with Firebase emulators)

3. **Build**

   - Compile TypeScript (frontend + functions)
   - Bundle frontend assets (Vite)

4. **Deploy**
   - Deploy to development (on PR) or production (on main)
   - Firebase Hosting (frontend)
   - Firebase Functions (backend)

### Manual Deployment

```bash
# Deploy everything to production
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# Deploy to specific environment
firebase use chaquip-dev-f52f4
firebase deploy
```

### Configuration

**Firebase Projects**:

- Development: `chaquip-dev-f52f4`
- Production: `chaquip-prod`

#### Overview

The application uses Firebase Secret Manager to store all sensitive configuration values (API keys, tokens, merchant codes) securely.

#### Cloud Functions Secrets (Sensitive Data)

The following secrets are required for cloud functions:

- `SLACK_BOT_TOKEN` - Slack Bot User OAuth Token
- `SUMUP_API_KEY` - SumUp API Key for payment processing
- `SUMUP_MERCHANT_CODE` - SumUp merchant identifier
- `CHAQUIP_API_KEY` - API key for external Slack command integration

**Setting Secrets**

Use the Firebase CLI to set secrets:

```bash
# Set all required secrets
firebase functions:secrets:set SLACK_BOT_TOKEN
firebase functions:secrets:set SUMUP_API_KEY
firebase functions:secrets:set SUMUP_MERCHANT_CODE
firebase functions:secrets:set CHAQUIP_API_KEY
```

**Viewing Secrets**

```bash
# List all secrets
firebase functions:secrets:access

# View a specific secret value (requires appropriate permissions)
firebase functions:secrets:access SECRET_NAME
```

#### Frontend Configuration (VITE\_\* Variables)

The frontend uses Vite environment variables for Firebase configuration. These are **NOT secrets** - they are public configuration values that are safe to commit to source control.

**Retrieving Firebase Configuration from Console**

To get the Firebase configuration for your frontend:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (e.g., `chaquip-prod` or `chaquip-dev-f52f4`)
3. Click on **Project settings** (gear icon) in the left sidebar
4. Scroll down to **Your apps** section
5. Select your web app or click **Add app** if none exists
6. Copy the Firebase configuration object

The configuration will look like this:

```javascript
const firebaseConfig = {
  apiKey: 'AIzaSy...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.firebasestorage.app',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcd1234',
};
```

**Setting VITE\_\* Variables in .env**

Create or update your `.env` file in the project root with the Firebase configuration:

```bash
# Frontend Firebase Configuration
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcd1234
```

#### Local Development

For local development with Firebase emulators:

1. **Functions**: Create `functions/.env` with all secrets:

   ```bash
   SLACK_BOT_TOKEN=xoxb-your-token
   SUMUP_API_KEY=your-api-key
   CHAQUIP_API_KEY=your-api-key
   SUMUP_MERCHANT_CODE=your-dev-merchant-code
   ```

2. **Frontend**: Use `.env` or `.env.development` in the project root:

   ```bash
   VITE_FIREBASE_PROJECT_ID=chaas-dev
   VITE_FIREBASE_API_KEY=fake-api-key-for-emulator
   # ... other VITE_* variables
   ```

3. **Important**: Never commit `.env` or `functions/.env` files containing real secrets!

## Database Schema

### Collections

**accounts**

```typescript
{
  id: string;
  slack: {
    id: string; // Slack user ID
    name: string; // Display name
    username: string; // Slack @username
    pictureUrl: string; // Profile picture URL
  }
  activity: {
    totalPurchased: number; // Total drinks bought (EUR)
    totalPaid: number; // Total payments made (EUR)
    lastPurchaseTimestamp: number;
    lastPaymentTimestamp: number;
  }
  isEmployee: boolean; // Akeneo employee flag
}
```

**transactions**

```typescript
// Purchase
{
  id: string;
  type: 'purchase';
  item: {
    id: string;
    name: string;
    price: number;
    enabled: boolean;
    picture: string;
  }
  account: string; // Account ID reference
  timestamp: number;
}

// Payment
{
  id: string;
  type: 'payment';
  amount: number;
  account: string; // Account ID reference
  timestamp: number;
}
```

**items** (available beverages)

```typescript
{
  id: string;
  name: string; // e.g., "Beer", "Soda", "Coffee"
  price: number; // Price in EUR
  enabled: boolean; // Available for purchase
  picture: string; // Image URL
}
```

## Security

- **Authentication Required**: All database operations require authenticated users
- **Firestore Security Rules**: Enforce authentication at database level
- **Server-Side Validation**: Cloud Functions validate all sensitive operations
- **Webhook Verification**: Payment webhooks verified via SumUp API
- **Atomic Operations**: Batch writes prevent partial updates
- **Environment Variables**: Secrets stored securely, never in code

## Contributing

1. Create feature branch from `main`
2. Make changes following existing patterns
3. Run tests: `yarn test:unit`
4. Run linting: `yarn lint`
5. Create pull request (triggers dev deployment)
6. After approval, merge to `main` (triggers prod deployment)

---

Built for **L'Amicale du chat qui pète** 🐱💨 - Making bar management purr-fect!
