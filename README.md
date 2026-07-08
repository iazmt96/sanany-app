# SANANY Marketplace Monorepo

Phase 2 baseline for a production-oriented SANANY marketplace stack.

## Workspace structure

- `apps/web`: Next.js 15 web app with Tailwind and i18next.
- `apps/mobile`: Expo React Native app with NativeWind and i18next.
- `packages/ui`: Shared UI primitives.
- `packages/shared`: Shared i18n resources.
- `packages/types`: Shared domain types.
- `packages/utils`: Shared language, direction, and formatting utilities.
- `packages/api`: Supabase client + listings repository.
- `packages/auth`: Shared auth controller and guards.

## Quick start

1. Install dependencies:
   `npm install`
2. Add environment configuration:
   1. Copy `.env.example` values into `apps/web/.env.local` and `apps/mobile/.env`.
   2. Fill in real Supabase project values.
   3. For web and mobile, use `*_SUPABASE_PUBLISHABLE_KEY` as the primary key.
3. Run web:
   `npm run dev:web`
4. Run mobile:
   `npm run dev:mobile`

## Supabase schema expectations

`listings` table should expose:

- `id` (text/uuid primary key)
- `title_key` (text, i18n key)
- `summary_key` (text, i18n key)
- `location_key` (text, i18n key)
- `status` (`available` or `reserved`)
- `daily_price` (numeric)

## Runtime validation behavior

Both apps fail fast with explicit errors when required Supabase environment variables are missing.
