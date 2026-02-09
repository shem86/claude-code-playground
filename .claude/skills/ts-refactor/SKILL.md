---
name: ts-refactor
description: Refactor TypeScript and JavaScript code using software engineering best practices. Produces clean, maintainable, well-structured code. Use when the user asks to refactor, clean up, simplify, improve code quality, reduce complexity, make code more maintainable, remove duplication, apply design patterns, split large files, improve naming, or perform code review with actionable fixes. Covers structural refactoring, readability, design patterns, and performance-aware improvements.
---

# TypeScript/JavaScript Refactoring

## Workflow

Follow this sequence for every refactoring task:

### 1. Analyze

Read the target code and surrounding context. Identify:

- What the code does (behavior to preserve)
- Which files/functions are in scope
- Existing tests (run them first to establish a green baseline)

### 2. Identify Smells

Scan for code smells. Consult [references/code-smells.md](references/code-smells.md) for the full catalog. Common high-impact smells:

- Long functions (>30 lines of logic)
- Large files (>300 lines)
- Duplicate code
- Deep nesting / arrow anti-pattern
- God objects
- Primitive obsession
- Switch/if chains on type discriminators

### 3. Plan

Choose the smallest set of refactoring moves that address the smells. Consult:

- [references/refactoring-catalog.md](references/refactoring-catalog.md) — before/after examples of each move
- [references/design-patterns.md](references/design-patterns.md) — when a pattern fits

Prefer incremental, behavior-preserving steps over large rewrites. Present the plan to the user before executing if the changes are non-trivial (>3 files or structural changes).

### 4. Refactor

Apply changes one move at a time. After each move:

- Ensure the code compiles (`npx tsc --noEmit` or IDE diagnostics)
- Run existing tests to confirm no regressions

Key principles during refactoring:

- **Preserve behavior** — refactoring changes structure, not behavior
- **One thing at a time** — don't mix refactoring with feature changes or bug fixes
- **Keep diffs reviewable** — small, focused commits over monolithic rewrites
- **Don't gold-plate** — stop when the smells are resolved. Resist the urge to "improve" unrelated code

### 5. Verify

- Run the full test suite
- Check for type errors
- Review the diff: is every change justified by a smell identified in step 2?

## Principles

### Naming

- Functions: verb + noun (`calculateTotal`, `validateInput`, `formatDate`)
- Booleans: `is`/`has`/`should` prefix (`isValid`, `hasPermission`)
- Collections: plural (`users`, `orderItems`)
- Callbacks/handlers: `on` + event (`onSubmit`, `onClick`)
- Avoid abbreviations unless universally understood (`id`, `url`, `db`)

### Structure

- One concept per function, one responsibility per module
- Prefer composition over inheritance
- Prefer flat over nested (guard clauses, early returns)
- Prefer `const` and immutability by default
- Prefer discriminated unions over class hierarchies for data modeling

### TypeScript-Specific

- Use strict mode; avoid `any` — prefer `unknown` with type narrowing
- Use `satisfies` for compile-time checks without widening
- Prefer interfaces for object shapes, type aliases for unions/intersections
- Use `as const` for literal tuples and enums

### React-Specific

- Extract custom hooks when component logic exceeds ~15 lines
- Push state down to the lowest component that needs it
- Prefer controlled components
- Memoize expensive computations (`useMemo`), not everything

### Performance Awareness

- Replace O(n) lookups in loops with `Map`/`Set` for O(1) access
- Avoid creating objects/arrays in render paths (stable references)
- Identify N+1 query patterns — batch or join instead
- Measure before optimizing; don't guess at bottlenecks
