# OpenJenni - Academic AI Writing Assistant

## Overview

OpenJenni is an open-source, self-hosted academic AI writing assistant — a BYOK (Bring Your Own Key) alternative to Jenni AI. It supports AI autocomplete, citation management, PDF library, AI chat research assistant, and outline generation.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Routing**: wouter

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

### Frontend (`artifacts/openjenni/`)
- `src/App.tsx` — router setup with wouter
- `src/pages/Dashboard.tsx` — document list, stats, new document dialog
- `src/pages/Editor.tsx` — main writing editor with AI features, tabbed sidebar
- `src/pages/Settings.tsx` — BYOK config, citation style, feature toggles

### API Server (`artifacts/api-server/`)
- `src/routes/documents.ts` — CRUD + stats endpoint
- `src/routes/citations.ts` — citation management with auto-formatting
- `src/routes/pdfs.ts` — PDF upload/list/delete with multer
- `src/routes/ai.ts` — autocomplete, paraphrase, chat, outline (BYOK provider support)
- `src/routes/settings.ts` — user settings with singleton pattern

### Database Schema (`lib/db/src/schema/`)
- `documents.ts` — writing documents
- `citations.ts` — formatted citations per document
- `pdfs.ts` — uploaded PDF metadata
- `settings.ts` — BYOK settings + feature toggles

## Features
- **AI Autocomplete** — Ctrl+J for ghost text suggestions, Tab to accept
- **Paraphrase modes** — simplify, academic, expand, shorten, active voice
- **AI Research Chat** — context-aware chat with document content
- **Citation Manager** — add/format citations in APA7, MLA9, Chicago, IEEE, Harvard
- **PDF Library** — upload and manage research papers
- **Outline Generator** — structured outline from topic + thesis
- **BYOK** — bring your own OpenAI, Anthropic, Moonshot, OpenRouter, or custom API key
- **Auto-save** — debounced save every 2s after typing stops

## AI Providers Supported
- OpenAI (GPT-5.2, GPT-5, GPT-5-mini, GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo)
- Anthropic (Claude Sonnet 4.6, Claude Opus 4.6, Claude Haiku 4.5, Claude 3.5 Sonnet)
- Moonshot AI / Kimi (kimi-k2, kimi-latest)
- OpenRouter (Claude 3.5 Sonnet, GPT-4o, GPT-4o-mini, Claude 3 Haiku, Llama 3.1 405B, Gemini Pro 1.5, Qwen3.6 Plus FREE, Step 3.5 Flash FREE, Claude Sonnet 4.6, Claude Opus 4.6, Gemini 3 Flash, DeepSeek V3.2, and more)
- Custom endpoint (any OpenAI-compatible API)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
