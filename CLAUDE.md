# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
yarn dev              # Start Vite dev server + Firebase emulators (Firestore:8080, Auth:9099, Functions:5001)
yarn fixtures         # Load test data into emulators
```

Dev server runs on http://localhost:5173. Emulator UI available at http://localhost:4000.

### Testing

```bash
yarn test:unit                    # Run all unit tests (frontend + backend)
yarn test:integration             # Run integration tests with emulators
yarn vitest                       # Watch mode for tests
yarn vitest <test-name>           # Run specific test file
yarn vitest <path/to/file>        # Run tests in specific file
```

Test file conventions:

- `*.unit.test.ts(x)` - Unit tests
- `*.integration.test.ts(x)` - Integration tests with emulators

The vitest workspace has 3 projects:

- `unit` - Frontend unit tests (jsdom environment)
- `unit-node` - Backend/functions unit tests (node environment)
- `integration` - Integration tests with Firebase emulators (single fork for isolation)

### Code Quality

```bash
yarn lint              # Check linting issues
yarn lint:fix          # Auto-fix linting issues
yarn prettier:fix      # Format code with Prettier
yarn tsc               # TypeScript type checking
yarn build             # Build for production (frontend + functions)
```

## Architecture Overview

### Frontend Architecture (`src/`)

**Component Organization:**

```
src/
├── components/     # Reusable UI components
├── contexts/       # React Context providers for global state
├── hooks/          # Custom React hooks
├── models/         # TypeScript type definitions
├── pages/          # Top-level page components
├── services/       # Business logic layer
├── store/          # Firestore data access layer
└── utils/          # Utilities and Firebase configuration
```

**Key Architectural Patterns:**

1. **Store Pattern for Real-time Data**

   - Custom store classes wrap Firestore real-time listeners
   - Each store (account, item, transaction) exposes:
     - `snapshot()` - Get current data
     - `subscribe(callback)` - Subscribe to real-time updates
   - Example: [src/store/account.ts](src/store/account.ts)

2. **Firestore Converters**

   - Type-safe conversion between Firestore documents and TypeScript models
   - Defined in each store file using `FirestoreDataConverter<T>`

3. **Service Layer for Business Logic**

   - Services handle complex operations (e.g., creating purchase transactions)
   - Located in `src/services/`
   - Example: [src/services/transaction.ts](src/services/transaction.ts) handles batch writes for purchases

4. **Context Providers for State Management**

   - `StoreContext` - Provides access to all stores (account, item, transaction)
   - `ItemsProvider` - Manages items data with real-time updates
   - `AuthContext` - Handles Firebase authentication state

5. **Environment-Specific Firebase Configuration**
   - [src/utils/firebase.ts](src/utils/firebase.ts) configures Firebase for DEV/TEST/PROD environments
   - Automatically connects to emulators in non-production environments
   - DEV/TEST use fake credentials and local emulators

### Backend Architecture (`functions/src/`)

**Cloud Functions:**

- `updateUsers` - Synchronizes Slack workspace users with Firestore accounts
- `sendPaymentLink` - Generates SumUp payment links and sends via Slack DM
- `handleSumUpWebhook` - Processes payment completion webhooks from SumUp
- `getPaymentLinkForSlackUser` - HTTP endpoint for external Slack command integration

**Shared Business Logic:**

- `shared/updateUsersLogic.ts` - Core logic for user synchronization (determine actions: CREATE/UPDATE/DELETE)
- `shared/transactionService.ts` - Transaction operations (create payments, validate)
- `shared/sumupService.ts` - SumUp API integration

**Testing Backend Functions:**

- Functions use Node.js 22 and TypeScript
- Unit tests are in the same directory as the function source
- Use `vitest` for testing (runs in node environment)

## Key Implementation Details

### Working with Firestore

**Real-time Listeners:**
All data uses real-time Firestore listeners via the store pattern. When modifying data access:

1. Use the store layer (`src/store/`) for queries
2. Subscribe to changes via `store.subscribe()`
3. Get current snapshot via `store.snapshot()`

**Batch Operations:**
For operations that modify multiple documents (e.g., recording a purchase updates both transaction and account):

- Use Firestore batch writes
- Example in [src/services/transaction.ts](src/services/transaction.ts)

**Collections:**

- `accounts` - User accounts with Slack info and activity totals
- `transactions` - Purchase and payment records
- `items` - Available beverages for purchase

### Testing Patterns

**Unit Tests:**

- Test components in isolation using `@testing-library/react`
- Mock Firestore operations for frontend tests
- Backend function tests use direct imports without emulators

**Integration Tests:**

- Run with Firebase emulators (`yarn test:integration`)
- Use fixture data from `src/utils/fixtures/datasets/test/`
- Tests run in single fork mode to prevent race conditions

**Adding Tests:**

1. Create test file with appropriate suffix (`.unit.test.ts` or `.integration.test.ts`)
2. Frontend tests go next to component files
3. Backend tests go in `functions/src/` next to function files

### Firebase Emulators

**Emulator Ports:**

- Firestore: 8080
- Auth: 9099
- Functions: 5001
- UI: 4000 (http://localhost:4000)

**Emulator Data Persistence:**

- Data imports from `.emulators/` directory on start
- Data exports to `.emulators/` on exit
- Use `yarn fixtures` to reset to test data

**Environment Projects:**

- `chaas-dev` - Local development with emulators
- `chaas-test` - Integration testing
- `chaquip-dev-f52f4` - Development environment (Firebase hosting)
- `chaquip-prod` - Production environment (Firebase hosting)

## Common Development Tasks

### Adding a New Component

1. Create component file in `src/components/`
2. Add corresponding `.unit.test.tsx` file
3. Export from `src/components/index.ts`
4. Use Chakra UI components for consistency

### Adding a New Cloud Function

1. Create function file in `functions/src/`
2. Add corresponding `.unit.test.ts` file
3. Export from `functions/src/index.ts`
4. Shared logic goes in `functions/src/shared/`

### Modifying the Database Schema

1. Update TypeScript types in `src/models/`
2. Update Firestore converters in `src/store/`
3. Update test fixtures in `src/utils/fixtures/datasets/`
4. Consider migration needs for existing production data

### Running Functions Locally

Functions automatically start with `yarn dev`. To test a specific function:

1. Ensure emulators are running
2. Make HTTP requests to `http://localhost:5001/chaas-dev/us-central1/<function-name>`
3. For `updateUsers`, can also run script: `yarn update-users`

## External Integrations

**Slack Integration:**

- Uses `@slack/web-api` package
- Requires `SLACK_BOT_TOKEN` secret (see [README.md Configuration section](README.md#configuration))
- Fetches workspace members and sends DMs

**SumUp Payment Processing:**

- Creates checkout pages for payment collection
- Webhook validation via API fetch (prevent fake payment notifications)
- Requires `SUMUP_API_KEY` and `SUMUP_MERCHANT_CODE` secrets (see [README.md Configuration section](README.md#configuration))

**Configuration Management:**

Cloud functions use Firebase Secret Manager for all configuration:

- **Secrets**: `SLACK_BOT_TOKEN`, `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `CHAQUIP_API_KEY`
- **Local Development**: Use `functions/.env` file with all values for emulator testing
- **Environment-specific values**: Some secrets (like `SUMUP_MERCHANT_CODE`) have different values per Firebase project
- See [README.md Configuration section](README.md#configuration) for complete setup instructions

**Frontend Configuration:**

- Uses `.env` file with `VITE_*` prefixed variables for Firebase configuration
- Values are **public** (safe to commit) and obtained from Firebase Console
- Go to **Project settings > General** in Firebase Console to retrieve configuration values
- See [README.md Configuration section](README.md#configuration) for detailed instructions on retrieving and setting VITE\_\* variables

## Code Style and Patterns

**TypeScript:**

- Strict mode enabled
- No implicit any
- Prefer explicit types over inference for public APIs

**React Patterns:**

- Functional components only
- Custom hooks for reusable logic
- Context for global state, local state for component-specific data

**Naming Conventions:**

- Components: PascalCase (e.g., `AccountCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAccounts.ts`)
- Services: camelCase (e.g., `transactionService.ts`)
- Types/Interfaces: PascalCase (e.g., `Account`, `Transaction`)

**File Organization:**

- Colocate tests with source files
- Export public APIs via index files
- Keep related functionality together (component + styles + tests)

## Deployment

Deployment is automated via GitHub Actions:

- **Development**: Deploys to `chaquip-dev-f52f4` on any push
- **Production**: Deploys to `chaquip-prod` on merge to `main`

Pipeline runs: Prettier → ESLint → TypeScript → Tests → Build → Deploy

Manual deployment:

```bash
firebase deploy                    # Deploy everything
firebase deploy --only functions   # Functions only
firebase deploy --only hosting     # Frontend only
```
