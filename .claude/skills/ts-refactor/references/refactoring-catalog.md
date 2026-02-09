# Refactoring Catalog — TypeScript/JavaScript

Practical catalog of refactoring moves with TS/JS before/after examples.

## Table of Contents
- [Extract Function](#extract-function)
- [Inline Function](#inline-function)
- [Extract Variable / Replace Temp with Query](#extract-variable)
- [Introduce Parameter Object / Options Bag](#introduce-parameter-object)
- [Replace Conditional with Polymorphism](#replace-conditional-with-polymorphism)
- [Replace Nested Conditionals with Guard Clauses](#guard-clauses)
- [Decompose Conditional](#decompose-conditional)
- [Extract Module / Split File](#extract-module)
- [Replace Loop with Pipeline](#replace-loop-with-pipeline)
- [Encapsulate Record](#encapsulate-record)
- [Replace Magic Values with Constants](#replace-magic-values)
- [Introduce Generic Type](#introduce-generic-type)
- [Consolidate Error Handling](#consolidate-error-handling)
- [Replace Callback with Async/Await](#replace-callback-with-async-await)
- [Extract Hook (React)](#extract-hook-react)
- [Lift State Up / Push State Down (React)](#lift-state-react)

---

## Extract Function

When: A code block does one identifiable thing, especially if >5 lines or reused.

```ts
// BEFORE
function printOwing(invoice: Invoice) {
  let outstanding = 0;
  for (const o of invoice.orders) {
    outstanding += o.amount;
  }
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${outstanding}`);
}

// AFTER
function calculateOutstanding(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + o.amount, 0);
}

function printOwing(invoice: Invoice) {
  const outstanding = calculateOutstanding(invoice.orders);
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${outstanding}`);
}
```

---

## Inline Function

When: A function's body is as clear as its name, or it's a trivial wrapper.

```ts
// BEFORE
function isAdult(age: number) { return age >= 18; }
function canVote(age: number) { return isAdult(age); }

// AFTER
function canVote(age: number) { return age >= 18; }
```

---

## Extract Variable

When: A complex expression is hard to read, or the same computation appears multiple times.

```ts
// BEFORE
if (order.total > 1000 && order.customer.loyaltyYears > 2 && !order.isFlagged) {
  applyDiscount(order);
}

// AFTER
const isHighValue = order.total > 1000;
const isLoyal = order.customer.loyaltyYears > 2;
const isEligible = isHighValue && isLoyal && !order.isFlagged;
if (isEligible) {
  applyDiscount(order);
}
```

---

## Introduce Parameter Object

When: Multiple functions pass the same group of parameters, or a function has >3 params.

```ts
// BEFORE
function dateRange(start: Date, end: Date) {}
function filterByDate(records: Record[], start: Date, end: Date) {}

// AFTER
interface DateRange { start: Date; end: Date; }
function filterByDate(records: Record[], range: DateRange) {}
```

---

## Replace Conditional with Polymorphism

When: switch/if-else chains on a type discriminator appear in multiple places.

```ts
// BEFORE
function calculatePay(employee: Employee) {
  switch (employee.type) {
    case 'full-time': return employee.salary;
    case 'contractor': return employee.hours * employee.rate;
    case 'intern': return employee.stipend;
  }
}

// AFTER
interface PayCalculator {
  calculate(): number;
}

class FullTimeCalc implements PayCalculator {
  constructor(private salary: number) {}
  calculate() { return this.salary; }
}
// ... one class per type, or use a strategy map:
const payStrategies: Record<string, (e: Employee) => number> = {
  'full-time': (e) => e.salary,
  'contractor': (e) => e.hours * e.rate,
  'intern': (e) => e.stipend,
};
```

---

## Guard Clauses

When: Deeply nested if/else blocks where early returns simplify flow.

```ts
// BEFORE
function getPayAmount(employee: Employee) {
  let result: number;
  if (employee.isSeparated) {
    result = separatedAmount(employee);
  } else {
    if (employee.isRetired) {
      result = retiredAmount(employee);
    } else {
      result = normalAmount(employee);
    }
  }
  return result;
}

// AFTER
function getPayAmount(employee: Employee) {
  if (employee.isSeparated) return separatedAmount(employee);
  if (employee.isRetired) return retiredAmount(employee);
  return normalAmount(employee);
}
```

---

## Decompose Conditional

When: A conditional's test or branches contain complex logic.

```ts
// BEFORE
if (date > plan.summerStart && date < plan.summerEnd) {
  charge = qty * plan.summerRate;
} else {
  charge = qty * plan.regularRate + plan.regularServiceCharge;
}

// AFTER
const isSummer = date > plan.summerStart && date < plan.summerEnd;
const charge = isSummer ? summerCharge(qty, plan) : regularCharge(qty, plan);
```

---

## Extract Module

When: A file has grown beyond ~300 lines or contains multiple unrelated concerns.

Split by cohesion: group functions/types that change together into their own module.

```
// BEFORE: utils.ts (500 lines with date, string, and validation helpers)

// AFTER:
// date-utils.ts — date formatting, parsing, comparison
// string-utils.ts — slugify, truncate, capitalize
// validation.ts — schema validators, sanitizers
```

Re-export from an index if needed for backwards compatibility, but prefer direct imports.

---

## Replace Loop with Pipeline

When: A for-loop does filter/map/reduce operations.

```ts
// BEFORE
const results: string[] = [];
for (const person of people) {
  if (person.age >= 18) {
    results.push(person.name.toUpperCase());
  }
}

// AFTER
const results = people
  .filter(p => p.age >= 18)
  .map(p => p.name.toUpperCase());
```

**Caveat:** Avoid chaining >3-4 pipelines — extract intermediate variables for clarity. For performance-critical paths with large arrays, a single loop may be preferable.

---

## Encapsulate Record

When: Raw objects are passed around with no validation or access control.

```ts
// BEFORE
const config = { dbHost: 'localhost', dbPort: 5432, maxRetries: 3 };
// anyone can mutate: config.dbPort = -1;

// AFTER
class AppConfig {
  readonly dbHost: string;
  readonly dbPort: number;
  readonly maxRetries: number;

  constructor(raw: Record<string, unknown>) {
    this.dbHost = String(raw.dbHost ?? 'localhost');
    this.dbPort = Number(raw.dbPort ?? 5432);
    this.maxRetries = Number(raw.maxRetries ?? 3);
    if (this.dbPort < 0) throw new Error('invalid port');
  }
}
```

---

## Replace Magic Values

```ts
// BEFORE
if (retries > 3) { setTimeout(fn, 5000); }

// AFTER
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
if (retries > MAX_RETRIES) { setTimeout(fn, RETRY_DELAY_MS); }
```

---

## Introduce Generic Type

When: Multiple functions/classes have identical structure but different payload types.

```ts
// BEFORE
interface StringResult { data: string; error?: Error; }
interface NumberResult { data: number; error?: Error; }

// AFTER
interface Result<T> { data: T; error?: Error; }
```

---

## Consolidate Error Handling

When: Try/catch blocks duplicated across similar operations.

```ts
// BEFORE
async function getUser(id: string) {
  try { return await db.user.findUnique({ where: { id } }); }
  catch (e) { logger.error(e); throw new AppError('user_fetch_failed'); }
}
async function getOrder(id: string) {
  try { return await db.order.findUnique({ where: { id } }); }
  catch (e) { logger.error(e); throw new AppError('order_fetch_failed'); }
}

// AFTER
async function dbQuery<T>(operation: () => Promise<T>, errorCode: string): Promise<T> {
  try { return await operation(); }
  catch (e) { logger.error(e); throw new AppError(errorCode); }
}
const getUser = (id: string) => dbQuery(() => db.user.findUnique({ where: { id } }), 'user_fetch_failed');
const getOrder = (id: string) => dbQuery(() => db.order.findUnique({ where: { id } }), 'order_fetch_failed');
```

---

## Replace Callback with Async/Await

```ts
// BEFORE
function loadData(cb: (err: Error | null, data?: Data) => void) {
  fetch(url)
    .then(res => res.json())
    .then(data => cb(null, data))
    .catch(err => cb(err));
}

// AFTER
async function loadData(): Promise<Data> {
  const res = await fetch(url);
  return res.json();
}
```

---

## Extract Hook (React)

When: Component has complex state/effect logic that obscures the render, or the same logic appears in multiple components.

```tsx
// BEFORE — logic mixed into component
function UserProfile({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchUser(id).then(setUser).finally(() => setLoading(false));
  }, [id]);
  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}

// AFTER — logic extracted
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchUser(id).then(setUser).finally(() => setLoading(false));
  }, [id]);
  return { user, loading };
}

function UserProfile({ id }: { id: string }) {
  const { user, loading } = useUser(id);
  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

---

## Lift State Up / Push State Down (React)

**Lift up** when siblings need shared state. **Push down** when only one child uses the state.

```tsx
// LIFT UP — before: duplicated fetch in two siblings
// After: parent owns state, passes as props

// PUSH DOWN — before: parent holds state only one child uses
// After: move useState into the child that needs it
```

Rule of thumb: state should live at the lowest common ancestor of the components that read or write it.
