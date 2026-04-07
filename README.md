# Chalmers room booker (POC)

A small web app to browse Chalmers study rooms, see weekly availability on a schedule, filter by campus and capacity, and book time slots. Sign-in stores a JWT in `localStorage` so it survives browser restarts until you sign out or clear site data.

**Stack:** React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query. The HTTP client and query hooks are generated from the TimeEdit OpenAPI spec with [`@hey-api/openapi-ts`](https://heyapi.dev/).

## API

The UI talks to **`https://timeedit.svaren.dev`** by default (see `API_BASE` in `src/config/api.ts`; override with `VITE_API_BASE`). Types and clients are regenerated with `pnpm openapi-ts` from the OpenAPI URL in **`openapi-ts.config.ts`** (currently a Vercel preview host, not necessarily the same origin as runtime `API_BASE`).

## Development

Use [pnpm](https://pnpm.io/) for installs and scripts.

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

The build runs `gen:room-ratings` (bundles room rating data), then TypeScript and Vite.

## Other scripts

| Command                 | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `pnpm lint`             | ESLint                                                                |
| `pnpm test`             | Vitest (run once)                                                     |
| `pnpm test:watch`       | Vitest (watch mode)                                                   |
| `pnpm preview`          | Preview production build                                              |
| `pnpm openapi-ts`       | Regenerate `src/client` from the OpenAPI URL (`openapi-ts.config.ts`) |
| `pnpm gen:room-ratings` | Regenerate `src/data/roomRatings.gen.ts`                              |

## Scope

This repository is a proof-of-concept / demo; it is not an official Chalmers product.
