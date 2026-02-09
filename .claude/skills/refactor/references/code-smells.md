# Code Smells — TypeScript/JavaScript

Quick-reference for identifying problems and choosing the right refactoring.

## Table of Contents
- [Bloaters](#bloaters)
- [Object-Orientation Abusers](#object-orientation-abusers)
- [Change Preventers](#change-preventers)
- [Dispensables](#dispensables)
- [Couplers](#couplers)

---

## Bloaters

### Long Function (>30 lines of logic)
**Symptoms:** Scrolling to read, multiple levels of abstraction, inline comments explaining sections.
**Fix:** Extract Function, Replace Temp with Query, Introduce Parameter Object.

```ts
// BEFORE — one giant handler
async function handleOrder(req: Request) {
  // validate
  const { items, userId } = req.body;
  if (!items?.length) throw new Error('empty');
  if (!userId) throw new Error('no user');
  // calculate
  let total = 0;
  for (const item of items) {
    const price = await getPrice(item.id);
    total += price * item.qty;
  }
  // persist
  const order = await db.order.create({ data: { userId, total, items } });
  // notify
  await sendEmail(userId, order.id);
  return order;
}

// AFTER — each concern is a small function
async function handleOrder(req: Request) {
  const input = validateOrderInput(req.body);
  const total = await calculateTotal(input.items);
  const order = await persistOrder(input.userId, total, input.items);
  await notifyUser(input.userId, order.id);
  return order;
}
```

### Large File (>300 lines)
**Symptoms:** Multiple unrelated classes/functions in one file, hard to find things.
**Fix:** Extract Module, Move Function, Group by Cohesion.

### Long Parameter List (>3 params)
**Symptoms:** Functions with many positional args, callers pass `null`/`undefined` for unused params.
**Fix:** Introduce Parameter Object, use options bag pattern.

```ts
// BEFORE
function createUser(name: string, email: string, role: string, dept: string, notify: boolean) {}

// AFTER
interface CreateUserOptions {
  name: string;
  email: string;
  role: string;
  department: string;
  notify?: boolean;
}
function createUser(options: CreateUserOptions) {}
```

### Primitive Obsession
**Symptoms:** Strings/numbers used where a domain type is appropriate (e.g., `userId: string` everywhere instead of a branded type or value object).
**Fix:** Replace Primitive with Object, introduce branded types.

```ts
// BEFORE
function getUser(id: string) {}

// AFTER
type UserId = string & { readonly __brand: 'UserId' };
function getUser(id: UserId) {}
```

---

## Object-Orientation Abusers

### Switch/If Chains on Type
**Symptoms:** `if (type === 'A') ... else if (type === 'B')` repeated across functions.
**Fix:** Replace Conditional with Polymorphism, Strategy pattern, or discriminated unions with exhaustive switch.

```ts
// BEFORE — scattered conditionals
function getArea(shape: Shape) {
  if (shape.type === 'circle') return Math.PI * shape.radius ** 2;
  if (shape.type === 'rect') return shape.w * shape.h;
  throw new Error('unknown');
}

// AFTER — discriminated union + exhaustive switch
type Shape =
  | { type: 'circle'; radius: number }
  | { type: 'rect'; w: number; h: number };

function getArea(shape: Shape): number {
  switch (shape.type) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'rect': return shape.w * shape.h;
    default: return shape satisfies never;
  }
}
```

### Refused Bequest
**Symptoms:** Subclass overrides parent methods to no-op, or ignores inherited interface members.
**Fix:** Replace Inheritance with Composition, extract interface.

### Temporary Field
**Symptoms:** Object field only meaningful in certain states; `undefined` checks scattered.
**Fix:** Introduce discriminated union, Extract Class for the state.

---

## Change Preventers

### Divergent Change
**Symptoms:** One module changes for multiple unrelated reasons.
**Fix:** Extract Class/Module by responsibility (Single Responsibility Principle).

### Shotgun Surgery
**Symptoms:** A single logical change requires edits in many files.
**Fix:** Move Function/Field, Inline Class to consolidate related logic.

### Feature Envy
**Symptoms:** A function accesses another object's data more than its own.
**Fix:** Move Function to the class/module it envies, or extract the envied data into a method.

---

## Dispensables

### Dead Code
**Symptoms:** Unreachable branches, unused exports, commented-out blocks.
**Fix:** Delete it. Version control preserves history.

### Speculative Generality
**Symptoms:** Abstract classes with one implementor, unused params "for future use", config options nobody uses.
**Fix:** Remove abstraction, inline, delete unused code. YAGNI.

### Duplicate Code
**Symptoms:** Same logic in 2+ places, copy-paste with minor variations.
**Fix:** Extract Function, Extract Module, Pull Up Method. Decide if duplication is incidental (leave it) or knowledge duplication (extract it).

### Comments That Restate Code
**Symptoms:** `// increment i` above `i++`, JSDoc that adds no information beyond the type signature.
**Fix:** Delete the comment. Rename the code to be self-documenting instead.

---

## Couplers

### Inappropriate Intimacy
**Symptoms:** Module reaches into another's internal state, bypasses public API.
**Fix:** Encapsulate Field, Move Function, introduce a clean interface boundary.

### Message Chains (a.b.c.d)
**Symptoms:** Long chains of property access / method calls through intermediaries.
**Fix:** Hide Delegate, introduce a direct method on the nearest object.

### God Object / God Module
**Symptoms:** One class/module that does everything, imported everywhere.
**Fix:** Extract Class/Module by cohesion, apply Single Responsibility.
