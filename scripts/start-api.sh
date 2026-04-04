#!/usr/bin/env sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must be set"
  exit 1
fi

echo "Waiting for Postgres to become available and applying database schema..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if pnpm --filter @workspace/db push 2>/dev/null; then
    echo "Database schema applied successfully"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "Database not ready yet, retrying in 2s... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
  fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "Failed to apply database schema after $MAX_RETRIES attempts"
  exit 1
fi

echo "Starting API server..."
exec pnpm --filter @workspace/api-server start
