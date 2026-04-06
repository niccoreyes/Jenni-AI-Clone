# Dockerfile for the Jenni AI Clone monorepo API server
FROM node:20-slim

WORKDIR /app

# Use Corepack to install pnpm and preserve reproducible dependency management
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY .npmrc package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY scripts/ scripts/
COPY lib/api-spec/ lib/api-spec/
COPY lib/api-client-react/ lib/api-client-react/
COPY lib/api-zod/ lib/api-zod/
COPY lib/db/ lib/db/
COPY artifacts/api-server/ artifacts/api-server/

# Install dependencies - force to fetch platform-specific binaries for Linux container
RUN pnpm install --force
RUN pnpm --filter @workspace/api-server build
EXPOSE 3001
ENV PORT=3001

CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
