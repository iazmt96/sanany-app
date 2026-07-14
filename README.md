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
   4. To deliver OTP by WhatsApp, set `NEXT_PUBLIC_SUPABASE_PHONE_OTP_CHANNEL=whatsapp` and `EXPO_PUBLIC_SUPABASE_PHONE_OTP_CHANNEL=whatsapp`.
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

Phone OTP channel defaults to `sms`. Supported values:

- `sms`
- `whatsapp`

If `whatsapp` is selected, Supabase must be configured with a supported provider for that channel. Current Supabase support is limited to Twilio / Twilio Verify for WhatsApp delivery.

## Supabase auth email branding

The hosted Supabase auth emails can be synced to the SANANY-branded design with:

- `npm run supabase:email-templates`

Required environment variables before running it:

- `SUPABASE_ACCESS_TOKEN`
- Optional: `SUPABASE_PROJECT_REF`
- Optional: `SANANY_SITE_URL` (defaults to `https://sanany.com/ar`)
- Optional: `SANANY_BRAND_HOME_URL` (defaults to `https://sanany.com`)

If you also want the visible sender name itself to become `SANANY`, Supabase requires a custom SMTP provider to be configured first.

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

## Mobile release (Android + iOS)

The mobile app is configured for EAS release builds in:

- `apps/mobile/app.json`
- `apps/mobile/eas.json`

### 1. Sign in to Expo

From `apps/mobile`:

- `npm exec eas-cli -- login`

### 2. Build production binaries

- Android AAB: `npm run build:android -w @sanany/mobile`
- iOS IPA: `npm run build:ios -w @sanany/mobile`

### 3. Submit to stores

- Google Play: `npm run submit:android -w @sanany/mobile`
- App Store Connect: `npm run submit:ios -w @sanany/mobile`

### 4. Required store accounts

- Google Play Console account + app created under package `com.sanany.mobile`
- Apple Developer account + app created under bundle id `com.sanany.mobile`
