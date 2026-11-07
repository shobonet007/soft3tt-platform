# Soft3TT — Vercel + Supabase migration

Next.js App Router foundation for migrating Soft3TT away from Blogger while preserving the existing Render conversion API during transition.

## Included
- Responsive Soft3TT homepage and tool directory.
- Supabase SSR clients, auth middleware, sign-in and private workspace shell.
- Conversion registry for the known image/video/audio/document tools.
- Authenticated conversion API route and isolated legacy API adapter.
- Background-removal API contract for a separate GPU worker.
- Supabase SQL schema, RLS policies and private Storage buckets.
- Deployment runbook and legacy API verification checklist.

## Important honest status
This is a codebase foundation, not a completed live deployment. The existing Render API's exact upload/status response contract must be checked against its repository before production conversion is enabled. The BiRefNet worker is a secured scaffold and returns 501 until inference and private result storage are implemented. Batch processing, background-image replacement, preview UI, billing, malware scanning, rate limiting and automated cleanup are not yet production complete.

## Setup
1. Use the dedicated Supabase project `soft3tt-production` (the project ref in your dashboard screenshot was `fbauuqgtymuwfabcoho`).
2. Run `supabase/migrations/0001_soft3tt_core.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`; set Supabase URL and publishable key.
4. `npm install`, then `npm run dev`.
5. Push to a new GitHub repository and connect it to Vercel project `soft3tt-platform`.
6. Add env vars in Production, Preview and Development.
7. Deploy to the Vercel URL and test before changing DNS.
8. Add `www.soft3tt.online` to Vercel only after acceptance tests. Preserve Blogger DNS for rollback.

## Security
The publishable key may be exposed in the browser; RLS is mandatory. Never expose Supabase secret/service-role keys or GPU worker token in `NEXT_PUBLIC_*`. Source and result buckets are private. User rows are scoped by `auth.uid()`.
