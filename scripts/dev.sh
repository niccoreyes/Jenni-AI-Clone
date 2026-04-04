#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Jenny AI Clone - Development Mode${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if Docker is running
echo -e "${YELLOW}Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if postgres container is already running
if docker ps --format '{{.Names}}' | grep -q 'jenny-ai-clone-postgres-1'; then
  echo -e "${GREEN}✓ PostgreSQL container already running${NC}"
else
  echo -e "${YELLOW}Starting PostgreSQL in Docker...${NC}"
  docker compose up postgres -d > /dev/null 2>&1
  
  # Wait for PostgreSQL to be ready
  echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
  MAX_RETRIES=30
  RETRY_COUNT=0
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
      echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
      break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      printf "."
      sleep 1
    fi
  done

  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Development environment ready!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Export DATABASE_URL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jenny_ai_clone"

# Create a temporary directory for process management
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to handle cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down development servers...${NC}"
  if [ ! -z "$API_PID" ]; then
    kill $API_PID 2>/dev/null || true
  fi
  if [ ! -z "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null || true
  fi
  echo -e "${GREEN}✓ Development servers stopped${NC}"
  echo -e "${YELLOW}PostgreSQL container is still running (docker compose stop postgres to stop it)${NC}"
}

trap cleanup EXIT INT TERM

# Start API Server
echo -e "${BLUE}Starting API Server...${NC}"
pnpm --filter @workspace/api-server dev > "$TEMP_DIR/api.log" 2>&1 &
API_PID=$!
echo -e "${GREEN}✓ API Server started (PID: $API_PID)${NC}"
echo -e "${YELLOW}  Logs: tail -f /tmp/jenny-ai-api.log${NC}"

# Wait a moment for API to start
sleep 2

# Start Frontend
export API_SERVER="http://localhost:3001"
echo -e "${BLUE}Starting Frontend...${NC}"
pnpm --filter @workspace/openjenni dev > "$TEMP_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
echo -e "${YELLOW}  Logs: tail -f /tmp/jenny-ai-frontend.log${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ All services are running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e ""
echo -e "  ${GREEN}Frontend:${NC}   http://localhost:3000"
echo -e "  ${GREEN}API Server:${NC} http://localhost:3001"
echo -e "  ${GREEN}Database:${NC}   postgresql://postgres:postgres@localhost:5432/jenny_ai_clone"
echo -e ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e ""

# Wait for both processes
wait
