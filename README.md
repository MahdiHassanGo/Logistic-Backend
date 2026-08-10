# LogiKhata Shared Backend

A production-oriented Express 5 + TypeScript + PostgreSQL backend shared by a web app, React Native app, and Flutter app.

## Implemented foundation

- Prisma ORM with PostgreSQL schema, migrations, indexes, financial `Decimal` fields, and relational constraints.
- Zod validation with strict request objects and stable error responses.
- RS256 JWT access tokens, opaque hashed refresh tokens, rotation, session revocation, and refresh-token reuse detection.
- Browser HttpOnly refresh cookies and mobile refresh-token responses for secure device storage.
- Role-based permissions with role mappings and user overrides.
- Customers, products, users, purchases, invoices, payments, allocations, ledger, drivers, vehicles, deliveries, dashboard, and health endpoints.
- Serializable transactions, PostgreSQL row locks, automatic retries, idempotency keys, payment reversals, and optimistic delivery versions.
- Redis + BullMQ domain-event queue, Socket.IO authentication, Pino logs, Helmet, CORS allowlist, rate limiting, Docker, and graceful shutdown.

## Architecture

```text
Web / React Native / Flutter
            |
      REST + Socket.IO
            |
Express routes -> Zod -> Auth/RBAC -> Services -> Prisma -> PostgreSQL
                                      |
                                  BullMQ/Redis
```

Controllers do not contain Prisma transaction logic. Financial rules live in services. PostgreSQL remains the canonical source of truth; Socket.IO and queues are secondary delivery mechanisms.

## Requirements

- Node.js 22+
- PostgreSQL 17+
- Redis 8+

## Setup

```bash
cp .env.example .env
docker compose up -d postgres redis
node scripts/generate-jwt-keys.mjs
```

Copy the two generated key lines into `.env`, then set a strong `SEED_OWNER_PASSWORD`.

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
npm run db:seed
npm run dev
```

Run the queue worker in another process:

```bash
npm run worker:dev
```

Health endpoints:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

## Authentication contract

### Browser

```json
POST /api/v1/auth/login
{
  "identifier": "owner",
  "password": "your-password",
  "clientType": "WEB"
}
```

The access token is returned in JSON. The refresh token is stored only in an HttpOnly cookie. Browser requests to `/auth/refresh` must include credentials.

### React Native or Flutter

Use `clientType: "MOBILE"`. The response includes both tokens. Store the refresh token in Keychain/Keystore/SecureStore and keep the access token in memory.

See [docs/client-integration.md](docs/client-integration.md).

## Core routes

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
GET    /api/v1/customers/:id/ledger

GET    /api/v1/products
POST   /api/v1/products
PATCH  /api/v1/products/:id

GET    /api/v1/purchases
POST   /api/v1/purchases
GET    /api/v1/purchases/:id

GET    /api/v1/payments
POST   /api/v1/payments
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/reverse

GET    /api/v1/deliveries
POST   /api/v1/deliveries
GET    /api/v1/deliveries/:id
PATCH  /api/v1/deliveries/:id/status
POST   /api/v1/deliveries/drivers
POST   /api/v1/deliveries/vehicles

GET    /api/v1/dashboard/summary
```

All protected routes require `Authorization: Bearer <access-token>`. Critical writes also require an `Idempotency-Key` header.

## Purchase transaction guarantees

A purchase request locks the customer row, reloads products, calculates every total on the server, checks credit limits, creates the purchase and item snapshots, creates an invoice, writes immutable ledger entries, optionally creates and allocates an initial payment, updates the cached customer balance, optionally creates a delivery, and commits everything atomically.

## Payment guarantees

Payments use manual allocation or oldest-invoice-first allocation. The service locks customer and invoice state, prevents over-allocation, updates invoice status atomically, writes a credit ledger entry, and updates the customer balance. Reversal never deletes a financial record; it creates compensating state and restores invoice dues.

## Production notes

- Run API and worker as separate containers/processes.
- Use managed PostgreSQL with point-in-time recovery and a connection pool/proxy appropriate to the deployment platform.
- Put RSA private keys and database/SMS/object-storage credentials in a secret manager.
- Terminate HTTPS at a trusted load balancer or reverse proxy.
- Add Redis-backed distributed rate limiting before horizontal scaling.
- Implement the worker adapters for SMS, invoice PDF, push notifications, report export, and backup workflows.
- Add generated OpenAPI documentation and contract tests before public client releases.
