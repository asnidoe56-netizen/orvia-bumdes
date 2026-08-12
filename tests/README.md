# Testing ORVIA BUMDes

Two runners, chosen to match the Next.js 16 testing guide
(`node_modules/next/dist/docs/01-app/02-guides/testing/`):

| Layer | Runner | Command | Needs a database? |
|---|---|---|---|
| `tests/unit` | Vitest | `npm test` | no |
| `tests/guard` | Vitest | `npm test` | no |
| `tests/bugs` | Vitest | `npm test` | no |
| `tests/e2e` | Playwright | `npm run test:e2e` | yes |

`npm run verify` runs typecheck → lint → Vitest. That is the gate to put in CI.

The guide is explicit that **async Server Components should be covered by E2E,
not unit tests** — Vitest cannot render them. That is why almost every page in
this app is exercised through Playwright rather than React Testing Library.

## The layers

### `tests/unit` — pure logic
Straight function tests: role→route mapping, the ORVIA AI permission matrix,
unit-menu selection, and provider error redaction. Fast, no I/O.

### `tests/guard` — architecture invariants
These scan the source tree and assert rules that no single unit test can hold.
They exist because this codebase is 65k lines across 123 tenants and the
dangerous mistakes are *structural*: a new Server Action that forgets its auth
check, a service-role client imported into a Client Component, a new report
that reads unbounded data.

They are written as **ratchets**. Each has an explicit allowlist capturing the
state at audit time. The suite is green today; it turns red when someone adds a
*new* violation. When a listed gap gets fixed, the ratchet test fails and tells
you to delete the entry — that is intentional, and it is how the allowlists
shrink.

Why a ratchet and not a plain failing test: a suite that is red on `main` gets
ignored within a week. A green suite that goes red on a real regression gets
acted on.

### `tests/bugs` — confirmed defects, written down
Executable records of bugs found during the audit. Where the buggy helper is
not exported, the test mirrors it verbatim **and asserts the source still
matches**, so the mirror cannot silently drift from the real code.

Each is written so that **fixing the bug makes the test fail**, with a comment
saying what to change. Search for `BUG:` to list them.

### `tests/e2e` — the real request pipeline
`access-control.spec.ts` is the one to keep green above all others: it walks 28
protected routes anonymously and asserts every one redirects to `/login`.
`performance.spec.ts` holds load budgets. `public-loan-form.spec.ts` covers the
only unauthenticated write path in the product.

## Running the E2E suite

Playwright needs a real Supabase project, because every dashboard route is
`force-dynamic` and hits the database on each request.

```bash
# 1. Browser binaries (once)
npx playwright install chromium

# 2. Credentials — .env.local at the repo root
#    NEXT_PUBLIC_SUPABASE_URL=...
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 3. Run
npm run test:e2e
npm run test:e2e -- --project=chromium          # skip the mobile profile
npm run test:e2e -- tests/e2e/access-control.spec.ts
```

Playwright starts `npm run dev` itself and reuses an already-running server.
To test a deployed environment instead:

```bash
E2E_BASE_URL=https://inovasigorut.online npm run test:e2e
```

The public loan-form spec needs a real published link and skips without it:

```bash
E2E_LOAN_SLUG=<slug> E2E_LOAN_TOKEN=<token> npm run test:e2e
```

## What is deliberately not covered

- **RLS policies.** The strongest tenant-isolation tests would sign in as a user
  from village A and try to read village B. That needs seeded fixtures and
  service-role provisioning, and it is the highest-value suite still missing.
  It is also blocked on the point below.
- **The database itself.** 58 of the 66 RPCs this app calls have no definition
  in `supabase/migrations/`, so the schema cannot be rebuilt from this repo and
  a disposable test database cannot be created. Fixing that unblocks real
  integration testing.
- **Accounting correctness** (journal balance, depreciation, profit sharing).
  All of it lives in Postgres functions that are not in the repo.

## Adding tests

- A new Server Action → the guard suite already fails if it has no auth gate.
- A new pure helper → `tests/unit`.
- A new page or flow → `tests/e2e`.
- Found a bug you cannot fix now → `tests/bugs`, written so the fix breaks it.
