#!/usr/bin/env bash
set -euo pipefail

APP_PORT_OFFSET=0
FIRESTORE_PORT_OFFSET=1
AUTH_PORT_OFFSET=2
FUNCTIONS_PORT_OFFSET=3
UI_PORT_OFFSET=4

BASE_PORT="${1:-}"

if [ -z "$BASE_PORT" ] || ! [[ "$BASE_PORT" =~ ^[0-9]+$ ]]; then
  echo "Usage: bin/setup.sh <base-port>" >&2
  echo "Example: bin/setup.sh 9000" >&2
  echo "" >&2
  echo "This will assign:" >&2
  echo "  App:        <base-port>" >&2
  echo "  Firestore:  <base-port> + 1" >&2
  echo "  Auth:       <base-port> + 2" >&2
  echo "  Functions:  <base-port> + 3" >&2
  echo "  UI:         <base-port> + 4" >&2
  exit 1
fi

export VITE_APP_PORT=$((BASE_PORT + APP_PORT_OFFSET))
export VITE_FIRESTORE_PORT=$((BASE_PORT + FIRESTORE_PORT_OFFSET))
export VITE_AUTH_PORT=$((BASE_PORT + AUTH_PORT_OFFSET))
export VITE_FUNCTIONS_PORT=$((BASE_PORT + FUNCTIONS_PORT_OFFSET))
export VITE_UI_PORT=$((BASE_PORT + UI_PORT_OFFSET))

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"

echo "Setting up with base port $BASE_PORT:"
echo "  App:        $VITE_APP_PORT"
echo "  Firestore:  $VITE_FIRESTORE_PORT"
echo "  Auth:       $VITE_AUTH_PORT"
echo "  Functions:  $VITE_FUNCTIONS_PORT"
echo "  UI:         $VITE_UI_PORT"
echo ""

cat > "$ENV_FILE" <<EOF
VITE_APP_PORT=$VITE_APP_PORT
VITE_FIRESTORE_PORT=$VITE_FIRESTORE_PORT
VITE_AUTH_PORT=$VITE_AUTH_PORT
VITE_FUNCTIONS_PORT=$VITE_FUNCTIONS_PORT
VITE_UI_PORT=$VITE_UI_PORT
EOF
echo "Port config written to .env.local"
echo ""

echo "> yarn install"
yarn --cwd "$PROJECT_DIR" install
echo ""

echo "> yarn install (functions)"
yarn --cwd "$PROJECT_DIR/functions" install
echo ""

echo "> yarn fixtures"
yarn --cwd "$PROJECT_DIR" fixtures
