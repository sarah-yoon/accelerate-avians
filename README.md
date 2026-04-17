# Accelerate Avians

A real-time multiplayer typing racer with retro pixel art birds. Race against friends or challenge your own ghost replays.

**[Play it live](https://accelerate-avians.vercel.app)**

## Features

- **Multiplayer racing** — Create a room, share the code, and race head-to-head in real time
- **Solo mode with ghost replay** — Race against your own previous best runs
- **Lobby system** — Host controls difficulty, players join via room code, synchronized countdown
- **Leaderboards** — Global rankings by passage, tracked per-player stats
- **Bird avatars** — 20 pixel art bird sprites to choose from
- **Difficulty tiers** — Short, medium, and long passages sourced from real text

## Architecture

The app is split into two independently deployed services:

```
┌─────────────────────────┐       WebSocket        ┌──────────────────────────┐
│   Next.js Frontend      │◄──────────────────────►│   Game Server            │
│   (Vercel)              │                        │   (Railway)              │
│                         │                        │                          │
│  React 19 + Tailwind    │                        │  Express + Socket.IO     │
│  Clerk auth             │                        │  Clerk auth middleware   │
│  Prisma ORM             │                        │  Room manager            │
│  Next.js API routes     │                        │  Race controller         │
│  Sentry monitoring      │                        │  Progress validator      │
└────────┬────────────────┘                        └──────────────────────────┘
         │
         ▼
   ┌────────────┐
   │ PostgreSQL │
   └────────────┘
```

**Frontend (Next.js 16 on Vercel)** — Handles rendering, authentication, API routes for scores/leaderboards/profiles, and the solo typing experience.

**Game Server (Express + Socket.IO on Railway)** — Manages multiplayer state: room creation/joining, race synchronization, real-time progress broadcasting, disconnect handling, and result persistence.

Both services share the same PostgreSQL database and Clerk authentication.

**Scoring authority:**

- **Multiplayer races** are *server-authoritative* — final WPM and accuracy are derived from server-stamped progress events received over WebSocket. Client-supplied keystroke timing data is preserved (`clientGhostData`) but used only for the existing solo-mode replay visualization.
- **Solo races** are *server-validated* but use client-supplied input (the typing happens entirely in-browser; only the final result is POSTed to `/api/scores`).

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Frontend       | Next.js 16, React 19, Tailwind CSS  |
| Auth           | Clerk                               |
| Database       | PostgreSQL + Prisma ORM             |
| Game Server    | Express, Socket.IO                  |
| Monitoring     | Sentry                              |
| Deployment     | Vercel (frontend), Railway (server) |
| Testing        | Vitest, Testing Library, Playwright |

## Data Model

- **Users** — Linked to Clerk, stores display bird preference
- **Passages** — Typing prompts with word/char counts and difficulty rating
- **Scores** — Per-user per-passage results with ghost replay data (keystroke JSON)
- **Matches** — Multiplayer rooms with status lifecycle (waiting → racing → completed)
- **MatchPlayers** — Per-player results within a match, including placement and ghost data

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL
- Clerk account (for auth keys)

### Frontend

```bash
npm install
cp .env.example .env   # fill in Clerk + database credentials
npx prisma migrate dev
npm run db:seed         # seed passages
npm run dev             # http://localhost:3000
```

### Game Server

```bash
cd server
npm install
cp .env.example .env   # fill in Clerk + CORS_ORIGIN
npm run dev             # http://localhost:3001
```

## Testing

```bash
npm run test            # frontend unit + component tests (Vitest)
cd server && npm test   # game server unit tests (Vitest)
npm run test:e2e        # end-to-end tests (Playwright)
```
