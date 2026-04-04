# Dockerfile for the Jenny AI Clone monorepo API server
FROM node:20-slim

WORKDIR /app

# Use Corepack to install pnpm and preserve reproducible dependency management
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY scripts ./scripts
COPY lib ./lib
COPY artifacts ./artifacts

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build

EXPOSE 3000
ENV PORT=3000

CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
