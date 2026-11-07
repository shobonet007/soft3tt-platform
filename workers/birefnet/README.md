# BiRefNet GPU worker

Deploy separately from Vercel. Do not run GPU inference in Vercel Functions or the 512 MB Render Free API.

Expected authenticated contract: `POST /v1/remove-background` with multipart `file`, `mode` (`transparent` or `solid`), `backgroundColor`; response JSON with job id/status/result URL. Implement pinned BiRefNet inference, image dimension limits, private object storage and signed output URLs before enabling. Current worker is a contract only; no inference is bundled.
