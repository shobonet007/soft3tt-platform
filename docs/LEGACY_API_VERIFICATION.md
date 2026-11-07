# Verify existing Render API before production

Inspect the actual `soft3tt-conversion-api` source. Confirm upload route/method, file field name, conversion field name and IDs, job ID response property, status route/schema, download route and response headers. Update `src/lib/conversion/legacy-adapter.ts` to match. The `/api/convert` default is a placeholder, not a verified assertion. Test each converter using small non-sensitive files.
