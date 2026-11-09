# Soft3TT self-hosted BiRefNet GPU worker

This folder now contains the inference service, not only an API contract. It loads the MIT-licensed `ZhengPeng7/BiRefNet` model from Hugging Face and produces transparent PNGs, solid-colour composites, image-background composites, and ZIP batches.

## Important hosting requirement

This container needs an NVIDIA GPU with a CUDA-compatible driver. Do not deploy it on the existing Render Free conversion API instance (512 MB RAM, no GPU), and do not run it as a Vercel Function. Deploy it as a long-running Docker service on a GPU VM/Pod (for example, a RunPod GPU Pod with an HTTP service exposed on port 8080). Attach persistent storage at `/models` so the downloaded model weights survive container replacement.

## Environment variables

Worker service:

- `WORKER_TOKEN`: long random secret (at least 32 characters).
- `MODEL_ID`: defaults to `ZhengPeng7/BiRefNet`.
- `REQUIRE_CUDA`: defaults to `1`; set to `0` only for slow CPU development/testing.
- `PORT`: defaults to `8080`.
- `HF_HOME`: defaults to `/models/huggingface`.

Vercel `soft3tt-platform` project (Production and Preview as required):

- `BACKGROUND_REMOVER_URL`: public HTTPS base URL of this GPU service, without a trailing slash.
- `BACKGROUND_REMOVER_TOKEN`: exactly the same secret value as the worker's `WORKER_TOKEN`.

Never use a `NEXT_PUBLIC_` prefix for either secret.

## Deploy

1. Create a GPU-backed Docker service/Pod and connect this repository (or build from `workers/birefnet/Dockerfile`).
2. Set `WORKER_TOKEN` to a generated random secret; keep `REQUIRE_CUDA=1`.
3. Expose HTTP port `8080` and attach persistent storage to `/models`.
4. Wait for the model download and initial load. Check `https://YOUR-GPU-HOST/health`; it must return `"inference_ready": true` and `"device": "cuda"`.
5. Add `BACKGROUND_REMOVER_URL` and `BACKGROUND_REMOVER_TOKEN` to Vercel. Redeploy `soft3tt-platform`.
6. Open `/tools/background-remover`. The status should change to **AI worker ready**.

## API

`GET /health` reports whether the model loaded and whether CUDA is active.

`POST /v1/remove-background` requires `Authorization: Bearer <WORKER_TOKEN>` and multipart fields:

- `files`: one to three JPG, PNG or WEBP images (up to 15 MB each).
- `mode`: `transparent`, `solid`, or `image`.
- `backgroundColor`: `#RRGGBB` for `solid` mode.
- `background`: optional image file; required for `image` mode.

One input returns a PNG. Two or three inputs return a ZIP containing PNG files. The Vercel route uploads source files to the user's private Supabase Storage folder, signs them server-side, forwards them to this worker, and deletes those temporary source objects after processing.

## Notes

- First startup downloads the model weights and can take several minutes; subsequent startups are faster when `/models` is persistent.
- The API serializes GPU inference to avoid concurrent model calls exhausting VRAM.
- Limits are intentionally conservative for the Vercel Hobby request window. Increase them only after moving the orchestration API to a plan/runtime that supports longer requests or adding an asynchronous job queue.
- This worker has not been deployed to a GPU host by this patch. Until that is done and the Vercel variables are set, the web UI will display **GPU worker not connected** and keep the processing button disabled.
