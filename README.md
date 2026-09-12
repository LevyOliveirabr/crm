# Nimbus CRM

A lightweight CRM for managing contacts and a sales pipeline, built with
**Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**, and
**Prisma 7** on **SQLite**.

## Features

- **Dashboard** – key metrics (contacts, active contacts, open pipeline, closed
  won) plus a pipeline-by-stage breakdown and recent activity.
- **Contacts** – searchable table with create / edit / delete, status tracking
  (Lead / Active / Inactive), and per-contact deal counts.
- **Deals** – a Kanban-style pipeline board across five stages
  (Lead → Qualified → Proposal → Won / Lost) with quick stage moves, values, and
  contact assignment.
- **JSON API** – route handlers under `/api/contacts` and `/api/deals` with
  request validation.

## Tech stack

| Layer    | Choice                                        |
| -------- | --------------------------------------------- |
| Framework| Next.js 16 (App Router, Turbopack)            |
| Language | TypeScript                                    |
| Styling  | Tailwind CSS v4                               |
| Data     | Prisma 7 + SQLite (better-sqlite3 adapter)    |

## Getting started

Requirements: Node.js 20+ and npm.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local env file
cp .env.example .env

# 3. Apply migrations and seed sample data
npm run db:migrate
npm run db:seed

# 4. Start the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Script             | Description                                       |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Start the Next.js dev server.                     |
| `npm run build`    | Production build (type-checks and lints).         |
| `npm run start`    | Serve the production build.                       |
| `npm run lint`     | Run ESLint.                                       |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`). |
| `npm run db:seed`  | Seed sample contacts and deals (idempotent).      |
| `npm run db:setup` | Migrate, generate client, and seed in one step.   |

## Data model

- **Contact** – `name`, `email` (unique), `phone`, `company`, `title`,
  `status`, `notes`, and related deals.
- **Deal** – `title`, `value`, `stage`, and an optional `contact` relation.

The SQLite database file (`dev.db`) and the generated Prisma client
(`src/generated/prisma`) are git-ignored and recreated locally.

## Cloud Agent environment

`.cursor/environment.json` configures the Cursor Cloud Agent environment: it
installs dependencies, applies migrations, seeds the database, and runs the dev
server on port 3000.
