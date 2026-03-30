---
name: typescript-best-practices
description: Guides TypeScript and shared module conventions—DRY inferred types, no any, unknown with Zod or guards at trust boundaries, adapters behind stable contracts, meaningful comments and JSDoc, named constants and env config, and early-return control flow. Use when writing or refactoring .ts/.tsx logic, types, validation, utilities, adapters, or non-UI code; pairs with the react-best-practices skill for UI work.
---

# TypeScript best practices

Use these rules for **TypeScript and JavaScript modules** (utilities, adapters, shared types, business logic). For **React UI** behavior (Suspense, hooks, components), see [react-best-practices/SKILL.md](../react-best-practices/SKILL.md).

## Types and validation

- Stay **DRY** on types: infer from values, use `satisfies`, `ReturnType`, generics; express adapter outputs at boundaries.
- **`any`**: forbidden. **`unknown`**: allowed at boundaries; narrow with validation or type guards.
- **Trust boundaries** (forms, `JSON.parse`, external payloads, data you do not control): prefer **Zod** (or similar). Add Zod as a **direct** dependency when introducing that validation—do not assume it is only transitive.
- Narrow **internal** shapes may use discriminated unions or type guards without Zod in every layer.

## Adapters

- When a dependency may **change** (generated OpenAPI types, third-party objects, baggy APIs), define a **contract** (type or interface) for what consumers need, then implement an **adapter** that maps external → domain/UI model in one place. Depend on the **abstraction**, not the source shape.

## Comments

- Do not comment what the code **literally** does. Comment **intent**, **tradeoffs**, or **non-obvious** invariants.
- Use **JSDoc** when return shape or behavior is not clear from types (especially public APIs, hooks, utilities).

## Constants and config

- No **magic** strings/numbers in business logic; use named constants, small `constants` modules, or **`import.meta.env`** (Vite) / environment-appropriate config for deployment-specific values.

## Control flow and structure

- Use **early returns** and **guard clauses**; avoid deep nesting.
- Treat heavy **`else` / `else if`** chains as a smell. Prefer early returns, extraction to helpers, or smaller functions.
- If `else` remains, it should **read clearer** than the alternative—justify it mentally.

## Pragmatic limits

- **Zod** at **trust boundaries**; lighter narrowing inside when sufficient.
- Adapter contracts can be **inferred** types—an explicit `interface` is optional when the exported type is already the single source of truth.
