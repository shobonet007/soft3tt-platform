import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Hobby function request payloads have a small body limit.
// This proxy keeps the total source + replacement image payload below 4 MB.
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 3;

export async function GET() {
  const baseUrl = process.env.BACKGROUND_REMOVER_URL?.replace(/\/+$/, "");
  const token = process.env.BACKGROUND_REMOVER_TOKEN;
  if (!baseUrl || !token) {
    return NextResponse.json({
      configured: false,
      ready: false,
      message: "GPU worker URL and token have not been configured in Vercel.",
    });
  }

  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return NextResponse.json({ configured: true, ready: false, message: `GPU worker health check returned HTTP ${response.status}.` });
    }
    const health = await response.json() as { inference_ready?: boolean; device?: string; model?: string };
    return NextResponse.json({
      configured: true,
      ready: health.inference_ready === true,
      device: health.device ?? "unknown",
      model: health.model ?? "BiRefNet",
      message: health.inference_ready ? "AI background remover is ready." : "Worker is online but the model is not ready yet.",
    });
  } catch {
    return NextResponse.json({ configured: true, ready: false, message: "Could not reach the GPU worker. Check its URL and service logs." });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before using the AI background remover." }, { status: 401 });
  }

  const baseUrl = process.env.BACKGROUND_REMOVER_URL?.replace(/\/+$/, "");
  const token = process.env.BACKGROUND_REMOVER_TOKEN;
  if (!baseUrl || !token) {
    return NextResponse.json({ error: "The GPU background-removal worker is not configured yet." }, { status: 503 });
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload form could not be read." }, { status: 400 });
  }

  const files = incoming.getAll("files").filter((item): item is File => item instanceof File);
  const fallback = incoming.get("file");
  const selected = files.length ? files : (fallback instanceof File ? [fallback] : []);
  if (!selected.length || selected.length > MAX_FILES) {
    return NextResponse.json({ error: "Select between one and three JPG, PNG or WEBP images." }, { status: 400 });
  }

  const backgroundValue = incoming.get("background");
  const background = backgroundValue instanceof File && backgroundValue.size > 0 ? backgroundValue : null;
  const mode = String(incoming.get("mode") || "transparent");
  const backgroundColor = String(incoming.get("backgroundColor") || "#ffffff");
  if (!["transparent", "solid", "image"].includes(mode)) {
    return NextResponse.json({ error: "Choose transparent, solid-colour or image background mode." }, { status: 400 });
  }
  if (mode === "image" && !background) {
    return NextResponse.json({ error: "Choose a replacement background image." }, { status: 400 });
  }

  const totalBytes = selected.reduce((sum, file) => sum + file.size, 0) + (background?.size ?? 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "The total upload must be 4 MB or less on the current Vercel Hobby route." }, { status: 413 });
  }

  const payload = new FormData();
  for (const file of selected) payload.append("files", file, file.name);
  if (background) payload.append("background", background, background.name);
  payload.set("mode", mode);
  payload.set("backgroundColor", backgroundColor);

  let workerResponse: Response;
  try {
    workerResponse = await fetch(`${baseUrl}/v1/remove-background`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return NextResponse.json({ error: "The GPU worker did not respond. Check that its service is running." }, { status: 502 });
  }

  if (!workerResponse.ok) {
    const body = await workerResponse.json().catch(() => null) as { detail?: unknown; error?: unknown } | null;
    const message = typeof body?.detail === "string" ? body.detail
      : typeof body?.error === "string" ? body.error
      : `Background removal failed (HTTP ${workerResponse.status}).`;
    return NextResponse.json({ error: message }, { status: workerResponse.status });
  }

  const contentType = workerResponse.headers.get("content-type") || "application/octet-stream";
  if (!contentType.includes("image/png") && !contentType.includes("application/zip")) {
    return NextResponse.json({ error: "The GPU worker returned an unexpected file type." }, { status: 502 });
  }

  const output = await workerResponse.arrayBuffer();
  const disposition = workerResponse.headers.get("content-disposition") ||
    (contentType.includes("zip")
      ? 'attachment; filename="Soft3TT-background-removal-batch.zip"'
      : 'attachment; filename="Soft3TT-background-removed.png"');

  return new NextResponse(output, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Content-Length": String(output.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
