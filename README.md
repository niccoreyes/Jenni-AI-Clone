# Jenny AI Clone

Monorepo for the Jenny AI Clone project. This repository currently includes:
- `artifacts/api-server`: backend API server built with Express, Drizzle ORM, and TypeScript
- `lib`: shared workspace packages used by the server and other packages
- `scripts`: workspace tooling and utilities

## Quick start

### 1. Install dependencies

Make sure `pnpm` is installed and available.

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

### 2. Run the API server locally

From the repository root:

```bash
pnpm --filter @workspace/api-server dev
```

The server requires `PORT` to be set. The sample Docker setup uses `PORT=3000` by default.

The API is mounted under `/api`, and the root path `/` now returns a simple running status response. For example:

- `http://localhost:3000/`
- `http://localhost:3000/api/healthz`

### 3. Build everything

To typecheck and build all workspace packages:

```bash
pnpm run build
```

To run only workspace typechecking:

```bash
pnpm run typecheck
```

## Docker

A simple Docker setup is included for the API server.

### Build the Docker image

```bash
docker build -t jenny-ai-clone-api .
```

### Run in Docker

```bash
docker run --rm -p 3000:3000 -e PORT=3000 jenny-ai-clone-api
```

### Docker Compose

```bash
docker compose up --build
```

This starts the API server on `http://localhost:3000` using the `PORT` environment variable.

The Compose stack also starts a local PostgreSQL service and configures the API server with:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/jenny_ai_clone
```

> Note: Docker Compose uses the built image and runs the `pnpm --filter @workspace/api-server start` command, so it relies on the image's compiled output rather than the workspace dev flow.

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
