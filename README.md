# Phase 1 — Unified Inbox + CRM

Backend API for the Immigration Office Automation System. Implements the **Week 1–3 deliverables** from the Phase 1 plan: system design, CRM data model + endpoints, message/conversation models, and the unified inbox API. Channel integrations are mocked and ready to be swapped for real adapters.

## Stack

- Node.js 18+ / Express 4
- Prisma ORM
- SQLite for development (PostgreSQL-ready — change `provider` in `prisma/schema.prisma`)
- Zod for request validation

## Quickstart

```bash
cd phase1
npm install
cp .env.example .env             # already present; edit if needed
npx prisma migrate dev --name init
npm run db:seed
npm run dev                      # http://localhost:4000
```

Health check: `GET http://localhost:4000/api/health`

## Test

```bash
# Boots the Express app on an ephemeral port and exercises the API.
npm run test:api
```

## Project Layout

```
phase1/
├─ docs/
│  └─ SYSTEM_DESIGN.md      ← Week 1 deliverable
├─ prisma/
│  ├─ schema.prisma         ← Lead, User, CaseType, Conversation, Message, Note, Reminder
│  └─ seed.js               ← mock data across all 6 channels
├─ src/
│  ├─ index.js              ← server bootstrap
│  ├─ app.js                ← Express app + routes
│  ├─ db.js                 ← Prisma client singleton
│  ├─ constants.js
│  ├─ middleware/
│  ├─ routes/               ← thin Express routers
│  └─ services/             ← business logic (lead, ingest, inbox)
└─ tests/api.test.js
```

## API Reference

### Health
- `GET /api/health` → `{status, service, time}`

### Leads (CRM)
- `GET /api/leads?status=&assignedToId=&q=` — list, with filtering
- `GET /api/leads/:id` — full profile (notes, reminders, conversations)
- `POST /api/leads` — create lead manually
- `PATCH /api/leads/:id` — update fields/status
- `DELETE /api/leads/:id`

### Lead notes
- `GET /api/leads/:id/notes`
- `POST /api/leads/:id/notes` — `{body, authorId?}`

### Lead reminders
- `GET /api/leads/:id/reminders`
- `POST /api/leads/:id/reminders` — `{title, dueAt (ISO), ownerId?}`
- `PATCH /api/leads/:leadId/reminders/:reminderId` — toggle `completed`, edit

### Users (consultants/admins)
- `GET /api/users` · `POST /api/users` · `GET /api/users/:id` · `PATCH /api/users/:id`

### Case Types
- `GET /api/case-types` · `POST /api/case-types` · `PATCH /api/case-types/:id`

### Unified Inbox
- `GET /api/inbox?channel=&assignedToId=&status=` — unified conversation list, latest first
- `GET /api/conversations/:id` — full thread + lead profile
- `POST /api/conversations/:id/messages` — `{body, authorId?}` — send outbound (mock)
- `POST /api/conversations/:id/read` — clear unread counter

### Inbound webhook (mock + future adapters)
- `POST /api/ingest` — generic inbound webhook
  ```json
  {
    "channel": "TELEGRAM",
    "externalContactId": "tg:104872",
    "externalMessageId": "tg:104872:42",
    "from": { "name": "Mary Tan", "handle": "mary_t", "phone": "+14165550199" },
    "body": "Hi, can you help with my work permit?",
    "sentAt": "2026-05-06T14:30:00Z"
  }
  ```
  Behavior: idempotent on `externalMessageId`. Auto-creates a `Lead` (status=NEW) and `Conversation` if not present, assigns to the consultant with the fewest open leads.

## Channel Enum

`WHATSAPP | TELEGRAM | INSTAGRAM | EMAIL | WEB_FORM | SMS`

## Lead Status Lifecycle

`NEW → CONTACTED → QUALIFIED → CONSULTATION → CONVERTED → CLOSED`

The first outbound reply on a `NEW` lead auto-advances it to `CONTACTED`.

## What's Mocked

All six channel adapters are mocked. The seed inserts realistic conversations on each. To wire a real channel later, replace the body of `services/messageIngestService.sendOutbound` for outbound and POST to `/api/ingest` from the channel's webhook (Telegram bot, Twilio webhook, Meta Graph webhook, etc.).

## Migration to PostgreSQL

In `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Set `DATABASE_URL` to your Postgres connection string and run `npx prisma migrate deploy`.

## Roadmap

- **Phase 1 Week 4-8 (next):** real channel integrations (Email, Telegram, Web form, WhatsApp Business API), React frontend (inbox + lead list + conversation view + reminder panel), auth.
- **Phase 2+:** Client portal, e-signature, payments, LinkedIn engine — see `Proposalv2.docx`.
