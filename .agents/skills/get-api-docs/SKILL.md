---
name: get-api-docs
description: >
  Use this skill when you need documentation for a third-party library,
  SDK, or API before writing code that uses it. Search and fetch current
  docs with the `chub` CLI instead of guessing API shapes from training
  memory.
---

# Get API Docs via chub

When you need documentation for a library, SDK, or API, use Context Hub's
CLI instead of writing against an inferred API shape.

## Step 1 — Find the right doc ID

```bash
chub search "<library name>" --json
```

Pick the best-matching `id` from the results (for example
`openai/chat`, `anthropic/sdk`, `stripe/api`, `pinecone/vector-db`). If
nothing matches, try a broader query.

## Step 2 — Fetch the docs

```bash
chub get <id> --lang py    # or --lang js, --lang ts
```

Omit `--lang` if the doc only has one language variant — Context Hub will
choose it automatically.

## Step 3 — Use the docs

Read the fetched content and use it to write accurate code or answer the
question. Do not rely on memorized API shapes — use what the docs say.

## Step 4 — Annotate what you learned

If you discover a gap, gotcha, workaround, or project-specific detail that
is not in the doc, save it so next sessions start smarter:

```bash
chub annotate <id> "Webhook verification requires raw body — do not parse before verifying"
```

Annotations are local, persist across sessions, and appear automatically on
future `chub get` calls. Keep notes concise and actionable.

## Step 5 — Give feedback

Rate the doc after using it so authors can improve it.

```bash
chub feedback <id> up --label accurate "Clear examples and current models"
chub feedback <id> down --label outdated "Still lists gpt-4o as latest instead of gpt-5.4"
```

Available labels include `outdated`, `inaccurate`, `incomplete`, `wrong-examples`, `wrong-version`, `poorly-structured`, `accurate`, `well-structured`, `helpful`, and `good-examples`.

## Quick reference

| Goal | Command |
|------|---------|
| List all available docs | `chub search` |
| Find a doc | `chub search "stripe"` |
| Fetch Python docs | `chub get stripe/api --lang py` |
| Fetch JS docs | `chub get openai/chat --lang js` |
| Save output to file | `chub get anthropic/sdk --lang py -o docs.md` |
| Annotate a doc | `chub annotate stripe/api "needs raw body"` |
| List annotations | `chub annotate --list` |
| Rate a doc | `chub feedback stripe/api up` |

## Notes

- `chub search` with no query lists everything available.
- IDs are typically `<author>/<name>` — confirm the exact ID from search
  before fetching.
- If multiple languages exist and you don't pass `--lang`, `chub` will tell
  you which variants are available.
- If `chub` is not installed, install it with:

```bash
npm install -g @aisuite/chub
```
