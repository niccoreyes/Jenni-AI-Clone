#!/usr/bin/env bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
BUILD_MODE=false
for arg in "$@"; do
  case $arg in
    --build|-b)
      BUILD_MODE=true
      shift
      ;;
    --help|-h)
      echo -e "${BLUE}Usage: ./scripts/dev.sh [options]${NC}"
      echo -e ""
      echo -e "Options:"
      echo -e "  --build, -b    Build before starting (production mode)"
      echo -e "  --help, -h     Show this help message"
      echo -e ""
      echo -e "Default: Development mode (hot-reload enabled)"
      exit 0
      ;;
  esac
done

if [ "$BUILD_MODE" = true ]; then
  echo -e "${BLUE}🚀 Jenni AI Clone - Build Mode${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${BLUE}🚀 Jenni AI Clone - Development Mode${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

# Function to prompt user
prompt_install() {
  local name=$1
  local install_cmd=$2
  read -r -p "$(echo -e ${YELLOW})$name is not installed. Install it now? (y/n)$(echo -e ${NC}) " -n 1
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Installing $name...${NC}"
    eval "$install_cmd"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ $name installed successfully${NC}"
      return 0
    else
      echo -e "${RED}❌ Failed to install $name${NC}"
      return 1
    fi
  else
    echo -e "${RED}❌ $name is required to continue${NC}"
    return 1
  fi
}

# Check Node.js
echo -e "${YELLOW}Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed${NC}"
  if prompt_install "Node.js" "brew install node"; then
    :
  else
    exit 1
  fi
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}pnpm not found, attempting to install...${NC}"
  
  # Try corepack first
  if command -v corepack &> /dev/null; then
    echo -e "${YELLOW}Using corepack to setup pnpm...${NC}"
    corepack enable 2>/dev/null || true
    corepack prepare pnpm@latest --activate 2>/dev/null || true
  fi
  
  # If still not found, try npm
  if ! command -v pnpm &> /dev/null; then
    if command -v npm &> /dev/null; then
      echo -e "${YELLOW}Installing pnpm via npm...${NC}"
      if ! npm install -g pnpm; then
        echo -e "${RED}❌ Failed to install pnpm via npm${NC}"
        exit 1
      fi
    else
      echo -e "${RED}❌ Neither corepack nor npm is available to install pnpm${NC}"
      exit 1
    fi
  fi
  
  if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ Failed to setup pnpm${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}✓ pnpm $(pnpm --version)${NC}"

# Check Docker
echo -e "${YELLOW}Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed${NC}"
  if prompt_install "Docker Desktop" "brew install docker"; then
    :
  else
    exit 1
  fi
fi

if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Kill any existing processes on ports 3000, 3001
echo -e "${YELLOW}Cleaning up any existing processes on ports 3000-3001...${NC}"
lsof -ti:3000,3001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Check if postgres container is already running
if docker ps --format '{{.Names}}' | grep -q 'jenni-ai-clone-postgres-1'; then
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

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing workspace dependencies...${NC}"
  
  # Check if we're on macOS ARM64 and temporarily enable ARM64 packages
  if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
    echo -e "${YELLOW}Detected macOS ARM64 - enabling ARM64 native packages...${NC}"
    # Temporarily comment out ARM64 exclusions in pnpm-workspace.yaml
    sed -i.bak \
      -e 's/"lightningcss>lightningcss-darwin-arm64": "-"/# "lightningcss>lightningcss-darwin-arm64": "-"/' \
      -e 's/"rollup>@rollup\/rollup-darwin-arm64": "-"/# "rollup>@rollup\/rollup-darwin-arm64": "-"/' \
      -e 's/"@tailwindcss\/oxide>@tailwindcss\/oxide-darwin-arm64": "-"/# "@tailwindcss\/oxide>@tailwindcss\/oxide-darwin-arm64": "-"/' \
      pnpm-workspace.yaml
  fi
  
  pnpm install --force
  
  # Restore original pnpm-workspace.yaml if we modified it
  if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" && -f "pnpm-workspace.yaml.bak" ]]; then
    mv pnpm-workspace.yaml.bak pnpm-workspace.yaml
    echo -e "${GREEN}✓ ARM64 packages enabled for development${NC}"
  fi
  
  echo -e "${GREEN}✓ Dependencies installed${NC}"
  echo ""
fi

# Export DATABASE_URL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jenni_ai_clone"
export PORT=3001

# Create a temporary directory for process management
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to handle cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down development servers...${NC}"
  pkill -INT -P $$ 2>/dev/null || true
  echo -e "${GREEN}✓ Development servers stopped${NC}"
  echo -e "${YELLOW}PostgreSQL container is still running (docker compose stop postgres to stop it)${NC}"
}

trap cleanup EXIT INT TERM

# Start API Server
if [ "$BUILD_MODE" = true ]; then
  echo -e "${BLUE}Building and Starting API Server...${NC}"
  pnpm --filter @workspace/api-server build > >(tee "$TEMP_DIR/api.log") 2>&1
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ API Server build failed. Error:${NC}"
    cat "$TEMP_DIR/api.log"
    exit 1
  fi
  pnpm --filter @workspace/api-server start > >(tee "$TEMP_DIR/api.log") 2>&1 &
  API_PID=$!
else
  echo -e "${BLUE}Starting API Server (dev mode)...${NC}"
  pnpm --filter @workspace/api-server dev > >(tee "$TEMP_DIR/api.log") 2>&1 &
  API_PID=$!
fi
echo -e "${GREEN}✓ API Server started (PID: $API_PID)${NC}"

# Wait a moment for API to start and check if it's still running
sleep 3
if ! kill -0 $API_PID 2>/dev/null; then
  echo -e "${RED}❌ API Server failed to start. Error:${NC}"
  cat "$TEMP_DIR/api.log"
  exit 1
fi

# Start Frontend
export API_SERVER="http://localhost:3001"
export BASE_PATH="/"
export PORT=3000
if [ "$BUILD_MODE" = true ]; then
  echo -e "${BLUE}Building and Starting Frontend (production)...${NC}"
  pnpm --filter @workspace/openjenni build > >(tee "$TEMP_DIR/frontend.log") 2>&1
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed. Error:${NC}"
    cat "$TEMP_DIR/frontend.log"
    kill $API_PID 2>/dev/null || true
    exit 1
  fi
  pnpm --filter @workspace/openjenni serve > >(tee "$TEMP_DIR/frontend.log") 2>&1 &
  FRONTEND_PID=$!
else
  echo -e "${BLUE}Starting Frontend (dev mode with hot-reload)...${NC}"
  pnpm --filter @workspace/openjenni dev > >(tee "$TEMP_DIR/frontend.log") 2>&1 &
  FRONTEND_PID=$!
fi
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

# Wait a moment for Frontend to start and check if it's still running
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo -e "${RED}❌ Frontend failed to start. Error:${NC}"
  cat "$TEMP_DIR/frontend.log"
  kill $API_PID 2>/dev/null || true
  exit 1
fi

echo ""
if [ "$BUILD_MODE" = true ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✨ All services running in production mode!${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✨ All services are running in dev mode!${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi
echo -e ""
echo -e "  ${GREEN}Frontend:${NC}   http://localhost:3000"
echo -e "  ${GREEN}API Server:${NC} http://localhost:3001"
echo -e "  ${GREEN}Database:${NC}   postgresql://postgres:postgres@localhost:5432/jenni_ai_clone"
echo -e ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e ""

# Wait for both processes
wait
