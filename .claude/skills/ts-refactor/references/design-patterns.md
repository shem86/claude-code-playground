# Design Patterns — TypeScript/JavaScript

Practical patterns for TS/JS codebases. Each pattern includes when to use, when to avoid, and a concise example.

## Table of Contents
- [Strategy](#strategy)
- [Observer / Event Emitter](#observer)
- [Factory Function](#factory-function)
- [Builder](#builder)
- [Adapter](#adapter)
- [Decorator / Wrapper](#decorator)
- [Repository](#repository)
- [Module / Barrel](#module--barrel)
- [Middleware / Pipeline](#middleware--pipeline)
- [Dependency Injection](#dependency-injection)
- [Result Type (Error as Value)](#result-type)
- [Discriminated Union (Tagged Union)](#discriminated-union)

---

## Strategy

**When:** Multiple algorithms for the same task, chosen at runtime.
**Avoid:** When there's only one variant. Don't over-abstract.

```ts
type SortStrategy<T> = (items: T[]) => T[];

const strategies: Record<string, SortStrategy<Product>> = {
  price: (items) => [...items].sort((a, b) => a.price - b.price),
  name: (items) => [...items].sort((a, b) => a.name.localeCompare(b.name)),
  rating: (items) => [...items].sort((a, b) => b.rating - a.rating),
};

function sortProducts(products: Product[], strategy: string): Product[] {
  const sort = strategies[strategy];
  if (!sort) throw new Error(`Unknown strategy: ${strategy}`);
  return sort(products);
}
```

---

## Observer

**When:** Decoupling event producers from consumers. Already built into Node (`EventEmitter`) and the browser (`addEventListener`).
**Avoid:** When a simple callback suffices. Don't introduce pub/sub for two components.

```ts
// Typed event emitter (lightweight)
type EventMap = {
  'user:created': { id: string; email: string };
  'user:deleted': { id: string };
};

class TypedEmitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<(data: any) => void>>();

  on<K extends keyof T>(event: K, fn: (data: T[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

const events = new TypedEmitter<EventMap>();
const unsub = events.on('user:created', ({ id, email }) => { /* ... */ });
```

---

## Factory Function

**When:** Object creation involves logic, defaults, or validation. Prefer over classes when no mutable state or methods are needed.
**Avoid:** When a plain object literal or constructor is sufficient.

```ts
interface Logger {
  info(msg: string): void;
  error(msg: string, err?: Error): void;
}

function createLogger(prefix: string): Logger {
  const fmt = (level: string, msg: string) =>
    `[${new Date().toISOString()}] [${level}] ${prefix}: ${msg}`;

  return {
    info: (msg) => console.log(fmt('INFO', msg)),
    error: (msg, err) => console.error(fmt('ERROR', msg), err ?? ''),
  };
}
```

---

## Builder

**When:** Constructing complex objects step-by-step, especially when many optional fields exist.
**Avoid:** When an options object or factory is simpler.

```ts
class QueryBuilder {
  private table = '';
  private conditions: string[] = [];
  private limit?: number;

  from(table: string) { this.table = table; return this; }
  where(condition: string) { this.conditions.push(condition); return this; }
  take(n: number) { this.limit = n; return this; }

  build(): string {
    let sql = `SELECT * FROM ${this.table}`;
    if (this.conditions.length) sql += ` WHERE ${this.conditions.join(' AND ')}`;
    if (this.limit) sql += ` LIMIT ${this.limit}`;
    return sql;
  }
}

const query = new QueryBuilder().from('users').where('active = true').take(10).build();
```

---

## Adapter

**When:** Wrapping a third-party library or legacy API behind your own interface for testability and swap-ability.

```ts
// Your interface
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
}

// Redis implementation
class RedisStorage implements StorageAdapter {
  constructor(private client: RedisClient) {}
  async get(key: string) { return this.client.get(key); }
  async set(key: string, value: string, ttl?: number) {
    if (ttl) await this.client.setex(key, ttl, value);
    else await this.client.set(key, value);
  }
}

// In-memory implementation (for tests)
class MemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async set(key: string, value: string) { this.store.set(key, value); }
}
```

---

## Decorator

**When:** Adding behavior (logging, caching, retry) without modifying the original function/class.

```ts
function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxRetries = 3,
  delayMs = 1000,
): T {
  return (async (...args: Parameters<T>) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        await new Promise(r => setTimeout(r, delayMs * attempt));
      }
    }
  }) as T;
}

const fetchUserReliable = withRetry(fetchUser);
```

---

## Repository

**When:** Abstracting data access behind a clean interface. Keeps business logic free of ORM/SQL details.

```ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }
  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  save(user: User) { return this.prisma.user.upsert({ where: { id: user.id }, create: user, update: user }); }
  delete(id: string) { return this.prisma.user.delete({ where: { id } }).then(() => {}); }
}
```

---

## Module / Barrel

**When:** Re-exporting from an `index.ts` to simplify imports.
**Avoid:** Barrel files that re-export hundreds of symbols — they hurt tree-shaking and IDE performance.

```ts
// lib/validators/index.ts
export { validateEmail } from './email';
export { validatePhone } from './phone';
export type { ValidationResult } from './types';
```

Keep barrels small. One barrel per feature boundary, not one per folder.

---

## Middleware / Pipeline

**When:** Processing a request/input through a chain of composable steps.

```ts
type Middleware<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

function compose<T>(middlewares: Middleware<T>[]): Middleware<T> {
  return (ctx, next) => {
    let index = -1;
    function dispatch(i: number): Promise<void> {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = i === middlewares.length ? next : middlewares[i];
      return fn(ctx, () => dispatch(i + 1));
    }
    return dispatch(0);
  };
}
```

---

## Dependency Injection

**When:** Making components testable by injecting dependencies instead of hardcoding them.
**In TS/JS:** Prefer constructor/parameter injection over DI containers. Keep it simple.

```ts
// BEFORE — hard to test
class OrderService {
  async createOrder(data: OrderData) {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    await sendgrid.send({ to: user.email, subject: 'Order confirmed' });
  }
}

// AFTER — inject dependencies
class OrderService {
  constructor(
    private userRepo: UserRepository,
    private mailer: Mailer,
  ) {}

  async createOrder(data: OrderData) {
    const user = await this.userRepo.findById(data.userId);
    await this.mailer.send({ to: user.email, subject: 'Order confirmed' });
  }
}
```

---

## Result Type

**When:** Functions that can fail in expected ways. Prefer over throwing for business-logic errors.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function err<E>(error: E): Result<never, E> { return { ok: false, error }; }

function parseAge(input: string): Result<number, string> {
  const n = Number(input);
  if (isNaN(n) || n < 0 || n > 150) return err(`Invalid age: ${input}`);
  return ok(n);
}

const result = parseAge('25');
if (result.ok) console.log(result.value); // 25
```

---

## Discriminated Union

**When:** Modeling state machines, API responses, or any value that can be one of several shapes.

```ts
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function renderState<T>(state: AsyncState<T>) {
  switch (state.status) {
    case 'idle': return 'Ready';
    case 'loading': return 'Loading...';
    case 'success': return `Data: ${state.data}`;
    case 'error': return `Error: ${state.error.message}`;
  }
}
```

Use `satisfies never` in the default case to get compile-time exhaustiveness checking.
