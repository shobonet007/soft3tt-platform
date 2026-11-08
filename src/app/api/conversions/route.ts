import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startLegacy } from "@/lib/conversion/legacy-adapter";
import { bySlug } from "@/lib/conversion/registry";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const toolId = String(form.get("tool") || form.get("toolId") || "");
  const tool = bySlug(toolId);
  if (!(file instanceof File) || !tool || tool.kind !== "conversion") {
    return NextResponse.json({ error: "Invalid file or conversion tool." }, { status: 400 });
  }

  // Direct browser upload is the normal path for files above this function limit.
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "For files above 4 MB, use the direct converter upload." }, { status: 413 });
  }
  const extension = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (!tool.inputExtensions?.includes(extension)) {
    return NextResponse.json({ error: "Unsupported input extension for " + tool.name + "." }, { status: 400 });
  }

  const { data: job, error: insertError } = await supabase.from("conversion_jobs").insert({
    user_id: user.id,
    tool_id: toolId,
    status: "queued",
    original_filename: file.name,
    input_mime_type: file.type,
    input_size_bytes: file.size,
  }).select("id").single();
  if (insertError || !job) return NextResponse.json({ error: "Could not create conversion history record." }, { status: 500 });

  try {
    const result = await startLegacy(file, toolId, {
      quality: String(form.get("quality") || ""),
      audio: String(form.get("audio") || ""),
    });
    await supabase.from("conversion_jobs").update({
      legacy_job_id: result.jobId,
      output_filename: result.filename,
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", job.id).eq("user_id", user.id);
    return NextResponse.json({ ...result, historyJobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed.";
    await supabase.from("conversion_jobs").update({ status: "failed", error_message: message }).eq("id", job.id).eq("user_id", user.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
