# OpenJenni Architecture

OpenJenni is a self-hosted, **BYOK (Bring Your Own Key)** academic AI writing assistant — an open-source alternative to Jenni AI. It's built as a **pnpm monorepo** with clean separation of concerns, contract-first API development, and full containerization.

---

## System Overview

```mermaid
graph TB
    subgraph "Browser"
        FE[React 19 + Vite SPA]
    end

    subgraph "Docker Compose Network"
        API[Express 5 API Server]
        DB[(PostgreSQL 15)]
    end

    subgraph "External Services"
        AI1[OpenAI]
        AI2[Anthropic]
        AI3[Moonshot / Kimi]
        AI4[OpenRouter]
        AI5[Ollama (Local)]
        AI6[Custom Endpoint]
    end

    FE -- "HTTP /api/*" --> API
    API -- "Drizzle ORM\nnode-postgres" --> DB
    API -- "Vercel AI SDK" --> AI1
    API -- "Vercel AI SDK" --> AI2
    API -- "Vercel AI SDK" --> AI3
    API -- "Vercel AI SDK" --> AI4
    API -- "Vercel AI SDK" --> AI5
    API -- "HTTP" --> AI6

    style FE fill:#61dafb
    style API fill:#68a063
    style DB fill:#336791,color:#fff
```

---

## Monorepo Structure

```
Jenny-AI-Clone/
├── artifacts/
│   ├── api-server/              # Express 5 backend
│   ├── openjenni/               # React + Vite frontend
│   └── mockup-sandbox/          # Component preview sandbox
├── lib/
│   ├── db/                      # Drizzle ORM schema + migrations
│   ├── api-spec/                # OpenAPI 3.1 spec + Orval config
│   ├── api-zod/                 # Generated Zod validators & types
│   └── integrations/
│       └── api-client-react/    # Generated React Query hooks
├── scripts/                     # Dev & deployment scripts
├── docker-compose.yml           # 3-service orchestration
├── Dockerfile                   # API server image
├── Dockerfile.frontend          # Frontend image
└── pnpm-workspace.yaml          # Workspace manifest + catalog
```

### Package Dependency Graph

```mermaid
graph LR
    subgraph "Frontend App"
        FE["@workspace/openjenni"]
    end

    subgraph "Backend App"
        API["@workspace/api-server"]
    end

    subgraph "Shared Libraries"
        DB["@workspace/db"]
        ZOD["@workspace/api-zod"]
        HOOKS["@workspace/api-client-react"]
    end

    subgraph "Tooling"
        SPEC["@workspace/api-spec"]
    end

    FE --> HOOKS
    API --> DB
    API --> ZOD
    HOOKS --> ZOD
    SPEC -- "Orval codegen" --> ZOD
    SPEC -- "Orval codegen" --> HOOKS

    style SPEC fill:#ffcc00
    style ZOD fill:#a855f7,color:#fff
    style HOOKS fill:#61dafb
    style DB fill:#68a063
    style API fill:#68a063
    style FE fill:#61dafb
```

---

## API Code Generation Pipeline

The entire API contract flows from a **single source of truth**: `lib/api-spec/openapi.yaml`.

```mermaid
flowchart TD
    OPENAPI["lib/api-spec/openapi.yaml\n(OpenAPI 3.1 Specification)"]

    OPENAPI -->|"orval codegen"| ZODGEN["lib/api-zod/src/generated/\n• Zod validators\n• TypeScript types\n• Request/Response schemas"]

    OPENAPI -->|"orval codegen"| HOOKGEN["lib/api-client-react/src/generated/\n• React Query hooks\n• Custom fetch wrapper\n• ApiError handling"]

    ZODGEN -->|"import"| APIVALID["api-server routes\nRequest validation via .parse()"]

    HOOKGEN -->|"import"| FECOMP["openjenni pages & components\nuseGetDocuments(), useCreateDocument(), etc."]

    style OPENAPI fill:#ffcc00
    style ZODGEN fill:#a855f7,color:#fff
    style HOOKGEN fill:#61dafb
    style APIVALID fill:#68a063
    style FECOMP fill:#61dafb
```

**Benefits of this approach:**

- **Type safety end-to-end** — change the OpenAPI spec, regenerate, and both frontend and backend types update automatically
- **No manual sync** — API contracts are enforced, not hoped-for
- **Zero handwritten boilerplate** — validators, types, and hooks are all generated

---

## Database Schema

```mermaid
erDiagram
    documents {
        uuid id PK
        text title
        text content
        text citation_style
        int word_count
        int target_word_count
        text field_of_study
        timestamptz created_at
        timestamptz updated_at
    }

    citations {
        uuid id PK
        uuid document_id FK
        text source_id
        text author
        text year
        text title
        text journal
        text volume
        text pages
        text doi
        text url
        uuid pdf_id FK
        text citation_style
        text formatted
        timestamptz created_at
        timestamptz updated_at
    }

    pdfs {
        uuid id PK
        text filename
        text original_name
        text extracted_text
        text summary
        int page_count
        timestamptz created_at
    }

    settings {
        text id PK "singleton"
        text provider
        text api_key
        text base_url
        text model
        text default_citation_style
        text language
        text user_role
        boolean feature_autocomplete
        boolean feature_paraphrase
        boolean feature_chat
        boolean feature_outline
    }

    documents ||--o{ citations : "has"
    pdfs ||--o{ citations : "referenced by"
```

**Key design decisions:**

- **`settings` is a singleton table** — only one row exists, storing the user's AI provider config, API key, and feature toggles
- **`word_count` is auto-calculated** on document create/update from `content.split(/\s+/).length`
- **Citations link to PDFs** via `pdf_id` foreign key, enabling reference tracking

---

## Frontend ↔ Backend Exchange Mechanisms

### Development Mode

```mermaid
sequenceDiagram
    participant Browser
    participant Vite as Vite Dev Server<br/>(localhost:3000)
    participant Express as Express API Server<br/>(localhost:3001)
    participant Postgres as PostgreSQL<br/>(localhost:5432)

    Browser->>Vite: GET / (page load)
    Vite->>Browser: Serve React app (HMR enabled)

    Browser->>Vite: POST /api/ai/autocomplete/stream
    Vite->>Express: Proxy POST /api/ai/autocomplete/stream
    Express->>Express: Read settings from DB
    Express->>Postgres: SELECT provider, api_key, model
    Postgres-->>Express: User's AI config
    Express->>Express: Create LanguageModel via AI SDK
    Express-->>Vite: SSE text stream (pipeTextStreamToResponse)
    Vite-->>Browser: Streamed ghost text
    Browser->>Browser: Render italic overlay

    Browser->>Vite: GET /api/documents
    Vite->>Express: Proxy GET /api/documents
    Express->>Postgres: SELECT * FROM documents
    Postgres-->>Express: Document rows
    Express-->>Vite: JSON response
    Vite-->>Browser: React Query cache update
```

**How the proxy works:** `vite.config.ts` configures `server.proxy`:

```ts
proxy: {
  '/api': {
    target: process.env.API_SERVER || 'http://localhost:3001',
    changeOrigin: true,
  },
}
```

### Docker / Production Mode

```mermaid
sequenceDiagram
    participant Browser
    participant Frontend as Frontend Container<br/>(nginx / serve :3000)
    participant API as API Server Container<br/>(node :3001)
    participant Postgres as PostgreSQL Container<br/>(:5432)

    Browser->>Frontend: GET / (static bundle)
    Frontend-->>Browser: Built React app

    Note over Frontend,API: Frontend uses API_SERVER<br/>env var: http://api-server:3001

    Browser->>API: Direct HTTP /api/* calls<br/>(CORS enabled)
    API->>Postgres: Drizzle ORM queries
    Postgres-->>API: Results
    API-->>Browser: JSON / SSE responses
```

### React Query Hook Exchange

All frontend data fetching uses **generated React Query hooks**. Here's the data flow:

```mermaid
flowchart LR
    PAGE["Dashboard.tsx"]
    HOOK["useGetDocuments()"]
    FETCH["Generated customFetch()\n(base URL + auth + error parsing)"]
    ENDPOINT["GET /api/documents"]
    CACHE["React Query Cache"]
    UI["Document list UI"]

    PAGE --> HOOK
    HOOK --> FETCH
    FETCH --> ENDPOINT
    ENDPOINT --> CACHE
    CACHE --> UI
    CACHE -. "auto-refetch on invalidate" .-> HOOK

    style PAGE fill:#61dafb
    style HOOK fill:#a855f7,color:#fff
    style FETCH fill:#a855f7,color:#fff
    style ENDPOINT fill:#68a063
    style CACHE fill:#ffcc00
    style UI fill:#61dafb
```

**Mutations follow the same pattern:** `useCreateDocument()` → `customFetch('POST', '/api/documents')` → invalidates `getDocuments` query → cache refresh → UI auto-updates.

---

## AI Autocomplete Streaming Flow

This is the most complex exchange in the system — real-time streaming from AI provider → backend → frontend → ghost text overlay.

```mermaid
sequenceDiagram
    participant Editor as Editor.tsx<br/>(useCompletion hook)
    participant AISDK_FE as @ai-sdk/react
    participant Server as POST /api/ai/autocomplete/stream
    participant Settings as DB settings
    participant AISDK as Vercel AI SDK<br/>streamText()
    participant Provider as AI Provider<br/>(OpenAI / Anthropic / etc.)

    Editor->>Editor: User presses Ctrl+J
    Editor->>Editor: Capture cursor position + currentText
    Editor->>AISDK_FE: complete(currentText)
    AISDK_FE->>Server: POST /api/ai/autocomplete/stream<br/>{ currentText }

    Server->>Settings: SELECT provider, api_key, model
    Settings-->>Server: { provider: 'openai', api_key: 'sk-...', model: 'gpt-4' }

    Server->>AISDK: createOpenAI({ apiKey, baseURL })
    Server->>AISDK: streamText({ model, prompt: systemPrompt + currentText })

    AISDK->>Provider: OpenAI chat completions API (streaming)
    Provider-->>AISDK: Token-by-token SSE stream
    AISDK-->>Server: textStream (AsyncIterable<string>)
    Server->>Server: pipeTextStreamToResponse(res, textStream)

    Server-->>AISDK_FE: HTTP 200 + text/plain stream
    AISDK_FE-->>Editor: completion string updates incrementally
    Editor->>Editor: Render ghost text in italic muted-foreground

    Editor->>Editor: User presses Tab
    Editor->>Editor: Accept — insert completion at cursor
    Editor->>Editor: User presses Esc
    Editor->>Editor: Dismiss — clear ghost text
```

**Key details:**

- **Non-streaming fallback**: `/api/ai/autocomplete` uses `fetch` with retries, exponential backoff, and rate limit handling (429 → retry-after)
- **System prompt**: "You are an academic writing assistant. Continue the text naturally in the same style and tone."
- **Multi-provider**: The backend dynamically creates the correct `LanguageModel` based on the user's settings

---

## AI Provider Architecture

```mermaid
graph TD
    CLIENT["API Route: /api/ai/*"]

    CLIENT --> ROUTER{Read settings\nfrom DB}

    ROUTER -->|"provider: openai"| OPENAI["@ai-sdk/openai\ncreateOpenAI({apiKey})"]
    ROUTER -->|"provider: anthropic"| ANTHROPIC["@ai-sdk/anthropic\ncreateAnthropic({apiKey})"]
    ROUTER -->|"provider: moonshot"| MOONSHOT["OpenAI-compatible\napi.moonshot.cn/v1"]
    ROUTER -->|"provider: openrouter"| OPENROUTER["OpenAI-compatible\nopenrouter.ai/api/v1"]
    ROUTER -->|"provider: custom"| CUSTOM["OpenAI-compatible\nuser-defined base_url"]

    OPENAI --> AI_SDK[Vercel AI SDK\nstreamText / generateText]
    ANTHROPIC --> AI_SDK
    MOONSHOT --> AI_SDK
    OPENROUTER --> AI_SDK
    CUSTOM --> AI_SDK

    AI_SDK --> FEATURES["AI Features:\n• Autocomplete (stream + non-stream)\n• Paraphrase (6 modes)\n• Chat (context-aware)\n• Outline (JSON structured)"]

    style CLIENT fill:#68a063
    style ROUTER fill:#ffcc00
    style AI_SDK fill:#a855f7,color:#fff
    style FEATURES fill:#61dafb
```

### Paraphrase Modes

| Mode       | Description                                |
| ---------- | ------------------------------------------ |
| `simplify` | Make text clearer and easier to understand |
| `academic` | Elevate tone to formal academic style      |
| `expand`   | Add detail and elaboration                 |
| `shorten`  | Condense while preserving meaning          |
| `active`   | Convert to active voice                    |
| `passive`  | Convert to passive voice                   |

---

## Docker Compose Orchestration

```mermaid
graph TB
    subgraph "Docker Compose"
        subgraph "api-server (port 3001)"
            API[Express 5 App]
            UPLOADS["uploads/\n(PDF storage)"]
        end

        subgraph "frontend (port 3000)"
            STATIC[Static React Bundle]
        end

        subgraph "postgres (port 5432)"
            PGDATA["pgdata/\n(Persistent Volume)"]
        end
    end

    USER["User Browser"] --> STATIC
    USER -->|"Direct CORS"| API
    API --> PGDATA
    API --> UPLOADS

    style API fill:#68a063
    style STATIC fill:#61dafb
    style PGDATA fill:#336791,color:#fff
    style USER fill:#f0f0f0
```

**Environment variables:**

| Service      | Key Variables                                                                  |
| ------------ | ------------------------------------------------------------------------------ |
| `api-server` | `PORT=3001`, `DATABASE_URL=postgres://jenni:jennipass@postgres:5432/openjenni` |
| `frontend`   | `API_SERVER=http://api-server:3001`                                            |
| `postgres`   | `POSTGRES_USER=jenni`, `POSTGRES_PASSWORD=jennipass`, `POSTGRES_DB=openjenni`  |

**Startup sequence** (`scripts/start-api.sh`):

1. Wait for PostgreSQL to be ready (retry loop)
2. Apply DB schema via `drizzle-kit push`
3. Start Express server with `node dist/index.mjs`

---

## Request Lifecycle: Create a Document

```mermaid
sequenceDiagram
    participant User
    participant Editor as Editor.tsx
    useCreateDoc as useCreateDocument()
    customFetch as customFetch wrapper
    Express as Express POST /api/documents
    ZodVal as Zod validator<br/>(@workspace/api-zod)
    DB as PostgreSQL

    User->>Editor: Click "New Document"
    Editor->>Editor: Navigate to /write/:id
    Editor->>useCreateDoc: mutate({ title, content })
    useCreateDoc->>customFetch: POST /api/documents { body }

    customFetch->>Express: HTTP POST + JSON
    Express->>ZodVal: validate request body
    ZodVal-->>Express: validated data

    Express->>Express: Calculate word_count
    Express->>DB: INSERT INTO documents
    DB-->>Express: new document row
    Express-->>customFetch: 201 + document JSON
    customFetch-->>useCreateDoc: parsed response
    useCreateDoc->>useCreateDoc: Invalidate getDocuments cache
    useCreateDoc-->>Editor: onSuccess callback
    Editor->>Editor: Update UI state
```

---

## Technology Stack Summary

| Layer                  | Technology                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| **Frontend Framework** | React 19.1 + Vite 7                                                    |
| **Styling**            | Tailwind CSS v4 + shadcn/ui (55 Radix UI primitives)                   |
| **Routing**            | wouter (lightweight)                                                   |
| **Data Fetching**      | TanStack React Query v5 (generated hooks)                              |
| **AI Integration**     | Vercel AI SDK v6 + `@ai-sdk/react`                                     |
| **Backend Framework**  | Express 5 (ESM, esbuild bundled)                                       |
| **Database ORM**       | Drizzle ORM + node-postgres                                            |
| **Validation**         | Zod (generated from OpenAPI)                                           |
| **API Spec**           | OpenAPI 3.1 + Orval codegen                                            |
| **Logging**            | Pino + pino-http                                                       |
| **File Uploads**       | Multer (20MB PDF limit)                                                |
| **Containerization**   | Docker Compose (3 services)                                            |
| **Package Manager**    | pnpm workspaces + catalog                                              |
| **AI Providers**       | OpenAI, Anthropic, Moonshot (Kimi), OpenRouter, Ollama (Local), Custom |

---

## Key Architectural Decisions

1. **Contract-first development**: OpenAPI spec is the source of truth. Change it → regenerate → both frontend types and backend validators update automatically.

2. **BYOK model**: Users bring their own API keys. The `settings` singleton stores provider choice and credentials, enabling multi-provider support without vendor lock-in.

3. **Streaming-first autocomplete**: Ghost text overlay provides real-time suggestions as the user types, with Tab to accept and Esc to dismiss — mimicking the Jenni AI experience.

4. **Monorepo with generated boundaries**: `lib/api-spec` → `lib/api-zod` + `lib/api-client-react` creates a clean contract boundary. No team can drift from the API spec.

5. **PostgreSQL with Drizzle**: Type-safe queries with schema-as-code. `drizzle-kit push` applies schema changes without manual migration files during development.

6. **Vite proxy in dev, direct CORS in prod**: Development uses Vite's built-in proxy to avoid CORS issues. Docker uses direct CORS with `api-server` hostname resolution.
