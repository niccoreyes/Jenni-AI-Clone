# Jenni AI Clone

Monorepo for the Jenni AI Clone project. This repository currently includes:

- `artifacts/api-server`: backend API server built with Express, Drizzle ORM, and TypeScript
- `lib`: shared workspace packages used by the server and other packages
- `scripts`: workspace tooling and utilities

## Prerequisites

Before getting started, ensure you have the following installed:

- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
- **pnpm** (v8 or later) - Will be installed automatically via npm if not available
- **macOS users**: Requires command-line tools for optional dependencies on Apple Silicon:
  ```bash
  # If you encounter rollup or other native module errors, run:
  npm install @rollup/rollup-darwin-arm64 -g
  ```

The `dev.sh` script will check for all dependencies and prompt you to install any missing ones.

## Quick start

### 1. Install dependencies

From the repository root:

```bash
pnpm install
```

### 2. Run development mode (Recommended for development)

Start all services with a single command:

```bash
./scripts/dev.sh
```

This script automatically:

- Checks and installs missing dependencies
- Starts PostgreSQL in Docker
- Starts the API server with hot-reload
- Starts the frontend with hot-reload
- Shows service URLs and maintains persistent database

**Services available at:**

- Frontend: http://localhost:3000
- API Server: http://localhost:3001
- Database: postgresql://postgres:postgres@localhost:5432/jenni_ai_clone

Press **Ctrl+C** to stop all services (PostgreSQL will continue running for data persistence).

### Stop all services

To stop all development services:

```bash
./scripts/stop.sh
```

This script:

- Stops the frontend and API server processes
- Stops Docker containers
- Preserves PostgreSQL data in the Docker volume

### 3. Manual setup (Alternative)

If you prefer to run services manually:

1. **Start PostgreSQL in Docker:**

   ```bash
   docker compose up postgres -d
   ```

2. **Start API Server** (in a new terminal):

   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jenni_ai_clone" \
   PORT=3001 \
   pnpm --filter @workspace/api-server dev
   ```

3. **Start Frontend** (in another terminal):
   ```bash
   API_SERVER=http://localhost:3001 \
   pnpm --filter @workspace/openjenni dev
   ```

### 4. Build and typecheck

To typecheck and build all workspace packages:

```bash
pnpm run build
```

To run only workspace typechecking:

```bash
pnpm run typecheck
```

## Frontend Status

The frontend (`artifacts/openjenni`) is a React application built with Vite. It includes:

- **UI Components**: Shadcn/ui components with Tailwind CSS
- **API Integration**: Configured to proxy `/api` requests to the backend
- **Development Server**: Runs on port 3000 with hot-reload
- **ARM64 Support**: Compatible with Apple Silicon (may require additional native dependencies)

### Frontend Dependencies

For macOS ARM64 users, you may need to install additional native dependencies:

```bash
npm install @rollup/rollup-darwin-arm64 -g
```

## API Documentation

The API is mounted under `/api`, and the root path `/` returns a running status response:

- `http://localhost:3000/` - Frontend (dev mode)
- `http://localhost:3001/` - API server root
- `http://localhost:3001/api/healthz` - API health check

## Docker

The project supports multiple Docker configurations for different workflows.

### Docker Images

- **Dockerfile**: API server image based on Node.js 20-slim, includes all workspace libraries and the API server
- **Dockerfile.frontend**: OpenJenni frontend image based on Node.js 20-slim, includes ARM64 support for Apple Silicon

### Development Mode: PostgreSQL in Docker + Local Development

For the best development experience, run PostgreSQL in Docker while running the API and frontend locally via pnpm for hot-reloading.

#### Quick Start (Recommended)

Run a single command to start everything:

```bash
./scripts/dev.sh
```

This script automatically:

- Checks Docker is running
- Starts PostgreSQL in Docker with persistent volume
- Waits for PostgreSQL to be ready
- Starts the API server (with hot-reload)
- Starts the frontend (with hot-reload)
- Shows you all the service URLs and logs
- Cleans up gracefully on exit (Ctrl+C)

#### Manual Setup

If you prefer to run services manually:

1. Start PostgreSQL in Docker with persistent volume:

```bash
docker compose up postgres -d
```

This starts a PostgreSQL 15 database accessible at `postgresql://postgres:postgres@localhost:5432/jenni_ai_clone` with persistent data storage.

2. In a new terminal, run the API server (applies database schema and starts the server):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jenni_ai_clone" pnpm --filter @workspace/api-server dev
```

3. In another terminal, run the frontend:

```bash
API_SERVER=http://localhost:3001 pnpm --filter @workspace/openjenni dev
```

The frontend will be available at `http://localhost:3000` and automatically proxy `/api` requests to `http://localhost:3001`.

#### Benefits

- Fast hot-reload development for both API and frontend
- Persistent PostgreSQL database between dev sessions
- Easier debugging with local execution
- No container overhead for rapid iteration

### Production Mode: Full Docker Compose

For production or complete containerization, use the full Docker Compose stack:

```bash
docker compose up --build
```

This starts:

- **frontend** at `http://localhost:3000` (port 3000)
- **api-server** at `http://localhost:3001` (port 3001)
- **postgres** database at `localhost:5432`

The services are configured as follows:

- Frontend proxies `/api` requests to the backend at `http://api-server:3001`
- API server connects to PostgreSQL via `postgresql://postgres:postgres@postgres:5432/jenni_ai_clone`
- PostgreSQL data persists in the named volume `postgres_data`

#### Single Service Builds

To build individual images:

```bash
# API server only
docker build -t jenni-ai-clone-api .

# Frontend only
docker build -t jenni-ai-clone-frontend -f Dockerfile.frontend .
```

#### Run Individual Containers

```bash
# API server with local PostgreSQL
docker run --rm -p 3001:3001 \
  -e PORT=3001 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/jenni_ai_clone \
  jenni-ai-clone-api

# Frontend with local API server
docker run --rm -p 3000:3000 \
  -e API_SERVER=http://localhost:3001 \
  jenni-ai-clone-frontend
```

### Database Persistence

The Docker PostgreSQL service automatically creates and maintains a named volume (`postgres_data`) that persists across container restarts:

```bash
# View volumes
docker volume ls | grep postgres_data

# Inspect volume
docker volume inspect jenni-ai-clone_postgres_data

# Remove volume (WARNING: deletes all data)
docker volume rm jenni-ai-clone_postgres_data
```

#### Stop and Restart Containers

```bash
# Stop all services
docker compose down

# Stop but keep volumes (preserves database)
docker compose down --volumes  # ⚠️ removes volumes

# Just stop PostgreSQL, keeping volumes
docker compose stop postgres

# Restart PostgreSQL (all data persists)
docker compose start postgres
```

## Repository structure

- `artifacts/api-server`: Express API server package
- `lib`: shared libraries and generated API types
- `scripts`: workspace tooling packages
- `package.json`: root workspace manifest
- `pnpm-workspace.yaml`: workspace package configuration
- `pnpm-lock.yaml`: dependency lockfile

## Notes

- The repository is configured as a private GitHub repository.
- Use `pnpm install` from the root to install workspace dependencies.
- If you add frontend or sandbox packages later, they can be added to `pnpm-workspace.yaml` and managed with the same workflow.
- `PORT` is required by the API server at runtime.
