---
name: react-best-practices
description: Guides React and UI implementation for Vite apps using TanStack Query and Tailwind v4—declarative components, Suspense and error boundaries for async UI, flex-first layout with grid when appropriate, CVA for variants, minimal useEffect, and hooks for DOM sync. Use when building or refactoring React components, hooks, forms, TanStack Query, or Tailwind styling. Apply typescript-best-practices for types, validation, adapters, constants, and control flow.
---

# React best practices

Apply these conventions when writing or changing **React UI** code. Shared **TypeScript** rules (types, Zod, adapters, comments, constants, control flow) live in [typescript-best-practices/SKILL.md](../typescript-best-practices/SKILL.md)—follow that skill for all `.ts`/`.tsx` modules too.

**Stack defaults:** React 19, Vite, TanStack Query, Tailwind v4. OpenAPI-generated client code often lives under `src/client/`—treat external response shapes as unstable unless proven otherwise (see **Adapters** in [typescript-best-practices/SKILL.md](../typescript-best-practices/SKILL.md)).

## Data and side effects

- Prefer **TanStack Query** for server/async state. Consider **Zustand** (or similar) when **local** UI state is large or cross-cutting.
- Renders should stay **pure**: no hidden side effects; derive UI from props, local state, and query results.
- **`useEffect`**: default mental model is *almost never*. Prefer query `select`/callbacks, event handlers, derived state, or URL/search params first.
- **Default**: put remaining effect logic in a dedicated hook (`useThing()`), not scattered in the component.
- **Exceptional**: a genuinely tiny one-off sync that cannot live elsewhere may stay **inline**—treat as rare; do not normalize sloppy effects.

## Errors and loading

- Prefer **Suspense** + **error boundaries** (or route-level equivalents) for **async / render-tree** loading and failures (e.g. suspense queries).
- **Pragmatic limit**: error boundaries do **not** catch failures inside **event handlers**, timers, or many **mutation** paths—use try/catch, mutation `onError` / error state, or toasts as appropriate.

## Structure and readability

- Follow **typescript-best-practices** for early returns, guard clauses, and `else` discipline.
- Prefer **small, focused** components. Extract when it **names a concept** or enables **reuse**; avoid splitting every JSX chunk when locality/readability suffers.
- **Multiple components in one file** is fine only when they are **tightly coupled**.
- Very long files are a smell—extract or split domains.
- Prefer **declarative** JSX: compute **view-ready** data in variables **above** the return, not inside `{...}` expressions in the template.

## DOM and performance

- Imperative **DOM** or browser APIs: wrap in a **custom hook**, not raw calls sprinkled in component bodies.
- **No premature** `useMemo`, `React.memo`, or `useCallback` unless cost is obvious or measured.
- **Pragmatic note**: React Compiler may reduce the need for manual memo over time; still avoid memo-by-default.
- **Several `useState`**: fine when values are **independent**. Smell: **coupled** updates, **derived** state stored separately, or state that belongs in **URL**, query cache, or server—the **fix** is extraction, query/store, or derived values.

## CSS and Tailwind

- **Layout default**: **flexbox** when layout needs more than normal block flow.
- Use **CSS grid** when it is the better tool (true **2D** layouts, explicit rows/columns, overlapping grid areas)—**flex-first**, not flex-only.
- Avoid **arbitrary or conflicting** width constraints without a reason; **`min-*` + `max-*`** together is fine for an intentional **clamp**.
- Prefer **theme tokens** in CSS / Tailwind theme config over ad hoc arbitrary values unless the value is clearly one-off.
- Prefer **modern CSS** and **Intl** APIs (`Intl.DateTimeFormat`, `Intl.NumberFormat`, etc.) for formatting.
- **CVA** (`class-variance-authority`) for **variant-heavy** presentational components; **add the dependency** when introducing that pattern (not assumed installed).

## Pragmatic limits (summary)

- Boundaries ≠ all errors; handlers/mutations need explicit handling.
- Component size: name concepts and reuse, not maximal fragmentation.
- `useState` count: watch coupling and derivation, not a fixed number.
- Memo only when justified.
