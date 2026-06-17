# Phase 1 — System Design Document

**Project:** Immigration Office Automation System
**Phase:** 1 — Unified Inbox + CRM (Core System)
**Author:** Safoura Janosepah (IDS)
**Stack:** Node.js + Express + Prisma + SQLite (PostgreSQL-ready) + React (frontend in later iteration)

---

## 1. Goal

Allow consultants to receive and manage messages from multiple platforms in a single dashboard, automatically create leads from new conversations, and track each lead through the immigration consulting lifecycle.

## 2. Channels Connected

| Channel       | Direction      | Implementation in Phase 1 |
|---------------|----------------|---------------------------|
| WhatsApp      | inbound + outbound | Mock (real API requires Meta Business approval) |
| Telegram      | inbound + outbound | Mock (real bot wiring deferred) |
| Instagram DM  | inbound + outbound | Mock (Meta Graph API deferred) |
| Email         | inbound + outbound | Mock (IMAP/SMTP deferred) |
| Website Form  | inbound        | Mock (HTTP endpoint will be added later) |
| SMS           | inbound + outbound | Mock (Twilio deferred) |

All channels share a common `Message` shape so the integration layer can be swapped in without changing the inbox API.

## 3. Lead Workflow

```
Inbound message arrives on any channel
        │
        ▼
Match by (channel, externalContactId) → existing Lead?
        │                              │
       yes                             no
        │                              ▼
        │                      Create Lead (status = NEW)
        │                      Assign to default consultant (round-robin)
        ▼                              │
Append message to existing             ▼
Conversation                   Create Conversation linked to Lead
        │                              │
        └──────────────┬───────────────┘
                       ▼
            Notify assigned consultant
                       ▼
       Consultant works the lead through statuses:
       NEW → CONTACTED → QUALIFIED → CONSULTATION → CONVERTED → CLOSED
```

### Lead Status Lifecycle

- **NEW** — auto-created from inbound message, not yet reviewed.
- **CONTACTED** — consultant has replied at least once.
- **QUALIFIED** — consultation booked or case type confirmed.
- **CONSULTATION** — paid consultation in progress.
- **CONVERTED** — signed retainer / became a client (handed off to Phase 2 client portal).
- **CLOSED** — lost or archived.

## 4. Database Schema (logical)

```
User (consultants & admins)
 ├─ id, email, name, role, passwordHash, createdAt

CaseType (Work Permit, Study Permit, PR, Citizenship, Startup Visa, Refugee, Other)
 ├─ id, name, description

Lead
 ├─ id, fullName, email, phone, source (channel enum), status, caseTypeId,
 │  assignedToId (User), externalContactId, createdAt, updatedAt

Conversation
 ├─ id, leadId, channel, externalThreadId, lastMessageAt

Message
 ├─ id, conversationId, direction (IN/OUT), channel, body, externalMessageId,
 │  status (RECEIVED/SENT/READ/FAILED), sentAt, createdAt

Note  (free-text notes on a lead)
 ├─ id, leadId, authorId, body, createdAt

Reminder
 ├─ id, leadId, ownerId, title, dueAt, completed, createdAt
```

### Relationships

- A `Lead` has one assigned `User`, one `CaseType`, many `Conversation`s, many `Note`s, many `Reminder`s.
- A `Conversation` belongs to one `Lead`, one `Channel`, and has many `Message`s.
- A `Message` belongs to one `Conversation` and is either `IN` (from client) or `OUT` (from consultant).

### Indexes (for inbox performance)

- `Conversation(lastMessageAt DESC)` — inbox sort.
- `Message(conversationId, sentAt)` — thread fetch.
- `Lead(assignedToId, status)` — "my open leads".
- Unique `(channel, externalContactId)` on Lead — dedupe inbound messages from same person.

## 5. Unified Message Structure

Every channel adapter normalizes to:

```json
{
  "channel": "TELEGRAM | WHATSAPP | INSTAGRAM | EMAIL | WEB_FORM | SMS",
  "externalContactId": "string identifying the sender on that channel",
  "externalThreadId": "string identifying the thread (optional, falls back to contact)",
  "externalMessageId": "string, idempotency key",
  "from": { "name": "string", "handle": "string" },
  "body": "string (plain text; HTML stripped)",
  "sentAt": "ISO-8601 timestamp",
  "attachments": []
}
```

The `MessageIngestService` accepts this shape and is responsible for: dedupe by `externalMessageId`, lead match-or-create, conversation match-or-create, message persistence.

## 6. Backend Architecture

```
src/
├─ index.js           ← Express bootstrap
├─ app.js             ← middleware + routes
├─ db.js              ← Prisma client singleton
├─ routes/            ← Express routers (thin)
├─ controllers/       ← request → service → response
├─ services/          ← business logic (lead, message ingest, inbox)
└─ middleware/        ← error handler, validation
prisma/
├─ schema.prisma
└─ seed.js
```

**Layering rule:** routes call controllers, controllers call services, only services touch Prisma. This keeps business logic testable.

## 7. API Surface (Phase 1, Week 1-3 deliverable)

CRM:
- `GET/POST/PATCH/DELETE /api/leads`
- `GET/POST /api/leads/:id/notes`
- `GET/POST/PATCH /api/leads/:id/reminders`
- `GET/POST /api/users`
- `GET /api/case-types`

Inbox:
- `GET /api/inbox` — unified list of conversations (latest first, filterable by channel/assignee/status)
- `GET /api/conversations/:id` — full thread with messages
- `POST /api/conversations/:id/messages` — send outbound message (mock)
- `POST /api/ingest` — generic inbound webhook (used by mock channels and later by real adapters)

## 8. Out of Scope for Phase 1

- Real channel API connections (Meta, Twilio, IMAP) — scaffolded with mocks.
- Authentication/SSO — single-user dev mode for now; JWT middleware stub included.
- Frontend React app — comes after the API stabilizes.
- Client portal, e-signatures, payments, LinkedIn engine — these are Phase 2+ per the proposal.

## 9. Migration Path to Production

- **DB:** Prisma schema uses standard types; switch `provider = "sqlite"` to `"postgresql"` and run migrations against managed Postgres (Azure/AWS/GCP).
- **Auth:** add Passport / Auth0 / Azure AD; the role enum is already in the User table.
- **Channels:** each mock adapter under `src/services/channels/` exposes the same `ingest(payload)` and `send(conversationId, body)` interface — replace internals with real SDK calls.
- **Hosting:** containerize with Docker, deploy backend behind a reverse proxy with TLS.
