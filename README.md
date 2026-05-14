# Pintintín

Online Dominican-variant ("Pintintín") domino game. Mobile-first.

## Stack

- **Mobile:** React Native + Expo + expo-router (TypeScript)
- **Server:** Node.js + Express + Socket.IO (TypeScript, ESM)
- **Realtime:** Socket.IO with Redis adapter
- **Persistence:** Supabase / Postgres
- **Hosting:** Railway (server + Redis), Vercel (admin/web), Expo EAS (mobile)

## Repo layout

```
apps/
  mobile/        Expo app
  server/        Game server (authoritative)
packages/
  game-core/     Pure-TS rule engine (shared client + server)
  protocol/      Socket.IO event schemas (zod)
supabase/
  migrations/    SQL schema
```

## Getting started

```bash
pnpm install

# Server (needs Redis running on localhost:6379, or it will run single-instance)
cp apps/server/.env.example apps/server/.env
pnpm dev:server

# Mobile (in another terminal)
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile
```

Set `ALLOW_DEV_BYPASS_AUTH=true` in `apps/server/.env` for dev so you can connect without a Supabase JWT.

## Testing

```bash
pnpm --filter @pintintin/game-core test
```

## MVP scope

Play-money cash table only, 4-player free-for-all, single human vs. 3 bots.
Tournaments, real-money wallet, and rake are deferred — see the plan file.
