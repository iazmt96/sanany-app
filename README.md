# SANANY Marketplace Monorepo

Phase 1 baseline for a production-oriented SANANY marketplace stack.

## Workspace structure

- `apps/web`: Next.js 15 web app with Tailwind and i18next.
- `apps/mobile`: Expo React Native app with NativeWind and i18next.
- `packages/ui`: Shared UI primitives for web and native.
- `packages/shared`: Shared i18n resources and marketplace seed data.
- `packages/types`: Shared domain types.
- `packages/utils`: Shared language, direction, and formatting utilities.
- `packages/api`: Supabase integration foundation.

## Quick start

1. Install dependencies:
   `npm install`
2. Run web:
   `npm run dev:web`
3. Run mobile:
   `npm run dev:mobile`

