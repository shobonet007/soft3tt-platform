const BASE = (process.env.CONVERSION_API_URL || "https://api.soft3tt.online").replace(/\/$/, "");

export type LegacyConversionResult = {
  ok: true;
  jobId: string;
  tool: string;
  downloadUrl: string;
  filename: string;
  expiresInMinutes: number;
};

// Render runs the conversion synchronously. There is no separate status endpoint.
export async function startLegacy(file: File, toolId: string, options: { quality?: string; audio?: string } = {}): Promise<LegacyConversionResult> {
  const form = new FormData();
  form.set("file", file);
  form.set("tool", toolId);
  if (options.quality) form.set("quality", options.quality);
  if (options.audio) form.set("audio", options.audio);

  const response = await fetch(BASE + "/api/convert", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(Number(process.env.CONVERSION_API_TIMEOUT_MS || 12 * 60 * 1000)),
  });
  const payload = await response.json().catch(() => null) as (Partial<LegacyConversionResult> & { message?: string }) | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Conversion API returned HTTP " + response.status);
  if (!payload.jobId || !payload.downloadUrl || !payload.filename) throw new Error("Conversion API returned an incomplete success response.");
  return {
    ok: true,
    jobId: payload.jobId,
    tool: payload.tool || toolId,
    downloadUrl: payload.downloadUrl,
    filename: payload.filename,
    expiresInMinutes: Number(payload.expiresInMinutes) || 60,
  };
}
