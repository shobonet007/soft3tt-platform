# Deployment runbook

1. Verify the dedicated Supabase project is healthy and the URL/publishable key in Vercel point to it.
2. Run `supabase/migrations/0001_soft3tt_core.sql` in Supabase SQL Editor.
3. Supabase Auth → URL Configuration: Site URL `https://www.soft3tt.online`; redirect URLs include `http://localhost:3000/**`, `https://soft3tt-platform.vercel.app/**`, `https://www.soft3tt.online/**`.
4. Create a GitHub repository, push this code, connect it to Vercel team Shobonet → project `soft3tt-platform`.
5. Set Vercel env vars from `.env.example` in Production, Preview and Development.
6. Deploy to Vercel URL; test homepage, auth, RLS and conversion service.
7. Inspect the current Render API repository and verify upload path, multipart names, job id response, status route and download route. Adapter currently assumes `POST /api/convert`; this is not yet verified.
8. Deploy the BiRefNet worker to a separate GPU host and complete inference/storage before enabling AI.
9. Add `www.soft3tt.online` to Vercel and follow exact DNS records shown by Vercel at Namecheap. Preserve Blogger DNS values for rollback until cutover is accepted.
10. Update Supabase Site URL to the verified custom domain after DNS/SSL is live.

Rollback: restore saved Blogger DNS records; do not shut down the Render conversion API during migration.
