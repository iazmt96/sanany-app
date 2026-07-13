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

Core tables used by the current app:

- `public.listings`
- `public.listing_images`
- `public.profiles`
- `public.company_profiles`
- `public.follows`
- `public.ratings`

Auth/profile flows expect `profiles.account_type` to be normalized to:

- `individual`
- `company`

Company signup flow expects these metadata fields at sign-up time:

- `company_name`
- `representative_name`
- `business_type`
- `commercial_registration` (8-20 digits)

## Supabase migration rollout

Apply all files in `supabase/migrations` to your target project, especially the latest hardening migrations:

- `20260712163000_harden_profile_update_permissions.sql`
- `20260712163500_harden_company_signup_failfast.sql`

These enforce:

- clients cannot update `profiles.account_type`
- clients cannot update `company_profiles.verification_status`
- company signup fails fast when required metadata is missing or invalid

## Runtime validation behavior

Both apps fail fast with explicit errors when required Supabase environment variables are missing.

## Production deployment (sanany.com)

### 1. Vercel deployment target

The web app is configured for production deployment through GitHub Actions workflow:

- `.github/workflows/deploy-web-vercel.yml`

It deploys `apps/web` to Vercel on pushes to `main`.

### 2. Required GitHub secrets

Set these repository secrets before enabling deployment:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### 3. Required Vercel environment variables

In the Vercel project (Production scope), add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- Any additional app variables already used in `apps/web/.env.local`

### 4. Domain mapping for `sanany.com`

Add both domains in Vercel project:

- `sanany.com`
- `www.sanany.com`

Then set DNS at your registrar:

- Root `@` A record -> `76.76.21.21`
- `www` CNAME -> `cname.vercel-dns.com`

Current DNS for `sanany.com` is parked and must be changed to Vercel records for the site to go live.
