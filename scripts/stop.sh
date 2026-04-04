#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Jenny AI Clone - Stop Services${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function to kill processes on specific ports
kill_port() {
  local port=$1
  local name=$2
  if lsof -ti:$port > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping $name on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ $name stopped${NC}"
  else
    echo -e "${GREEN}✓ $name not running${NC}"
  fi
}

# Stop local development processes
echo -e "${YELLOW}Stopping local development processes...${NC}"
kill_port 3000 "Frontend"
kill_port 3001 "API Server"

# Stop Docker containers
echo -e "${YELLOW}Stopping Docker containers...${NC}"
if docker compose ps --format 'table {{.Name}}\t{{.Status}}' | grep -q "jenny-ai-clone"; then
  docker compose stop
  echo -e "${GREEN}✓ Docker containers stopped${NC}"
else
  echo -e "${GREEN}✓ No Docker containers running${NC}"
fi

# Optional: Remove containers (uncomment if you want to clean up completely)
# echo -e "${YELLOW}Removing Docker containers...${NC}"
# docker compose down
# echo -e "${GREEN}✓ Docker containers removed${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ All services stopped!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Note: PostgreSQL data is preserved in Docker volume${NC}"
echo -e "${YELLOW}To remove all data: docker compose down --volumes${NC}"