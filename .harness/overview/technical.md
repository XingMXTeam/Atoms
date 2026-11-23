# Technical overview

## Stack

- Next.js App Router + TypeScript + Tailwind v4
- OpenNext → Cloudflare Workers (`atoms-demo`, placement `aws:us-east-1`, domain `atoms.maoxunxing.com`)
- Drizzle + D1 in Workers; better-sqlite3 locally behind the same repository interface
- LLM provider modes: `gemini` | `mock` | `replay` via `LLM_PROVIDER`

## Constraints

- China reachability: no runtime external CDNs
- Secrets never committed; document in `.env.example` only
