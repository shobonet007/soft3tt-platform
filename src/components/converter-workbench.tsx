"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Tool } from "@/lib/conversion/registry";

const API_BASE = (process.env.NEXT_PUBLIC_CONVERSION_API_URL || "https://api.soft3tt.online").replace(/\/+$/, "");

type ConvertResponse = {
  ok?: boolean;
  jobId?: string;
  tool?: string;
  downloadUrl?: string;
  filename?: string;
  expiresInMinutes?: number;
  message?: string;
};

type ApiState = "checking" | "ready" | "unavailable" | "unsupported";
type WorkState = "idle" | "uploading" | "processing" | "done";

export default function ConverterWorkbench({ tool }: { tool: Tool }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [apiMessage, setApiMessage] = useState("Checking Soft3TT conversion service...");
  const [maxFileMB, setMaxFileMB] = useState(500);
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState("original");
  const [audio, setAudio] = useState("original");
  const [workState, setWorkState] = useState<WorkState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; filename: string; expires: number } | null>(null);

  useEffect(() => {
    let active = true;
    async function checkApi() {
      try {
        const [healthResponse, toolsResponse] = await Promise.all([
          fetch(API_BASE + "/api/health", { cache: "no-store" }),
          fetch(API_BASE + "/api/tools", { cache: "no-store" }),
        ]);
        if (!healthResponse.ok || !toolsResponse.ok) throw new Error("The conversion service returned an unhealthy response.");
        const health = await healthResponse.json();
        const toolPayload = await toolsResponse.json();
        const availableTools = toolPayload?.tools as Record<string, unknown> | undefined;
        if (!active) return;
        setMaxFileMB(Number(health?.maxFileMB) > 0 ? Number(health.maxFileMB) : 500);
        if (!availableTools || !Object.prototype.hasOwnProperty.call(availableTools, tool.id)) {
          setApiState("unsupported");
          setApiMessage("This conversion is not enabled on the connected API.");
          return;
        }
        setApiState("ready");
        setApiMessage("Connected to the Soft3TT conversion service.");
      } catch {
        if (!active) return;
        setApiState("unavailable");
        setApiMessage("The API could not be reached. Check the Render CORS allowlist and service health.");
      }
    }
    checkApi();
    return () => { active = false; };
  }, [tool.id]);

  function chooseFile(nextFile?: File) {
    setError("");
    setResult(null);
    setProgress(0);
    setWorkState("idle");
    if (!nextFile) { setFile(null); return; }
    const extension = "." + (nextFile.name.split(".").pop() || "").toLowerCase();
    if (!tool.inputExtensions?.includes(extension)) {
      setFile(null);
      setError("This tool accepts: " + (tool.inputExtensions || []).join(", "));
      return;
    }
    if (nextFile.size > maxFileMB * 1024 * 1024) {
      setFile(null);
      setError("The selected file is larger than the API limit of " + maxFileMB + " MB.");
      return;
    }
    setFile(nextFile);
  }

  function startConversion() {
    if (!file || apiState !== "ready" || workState === "uploading" || workState === "processing") return;
    setError(""); setResult(null); setProgress(0); setWorkState("uploading");
    const form = new FormData();
    form.append("file", file);
    form.append("tool", tool.id); // Exact multipart key expected by Express API.
    if (tool.supportsQuality) form.append("quality", quality);
    if (tool.supportsAudioBitrate) form.append("audio", audio);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_BASE + "/api/convert");
    xhr.responseType = "json";
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    xhr.upload.addEventListener("load", () => { setProgress(100); setWorkState("processing"); });
    xhr.addEventListener("load", () => {
      let payload = xhr.response as ConvertResponse | null;
      if (!payload && xhr.responseText) { try { payload = JSON.parse(xhr.responseText) as ConvertResponse; } catch { payload = null; } }
      if (xhr.status < 200 || xhr.status >= 300 || !payload?.ok) {
        setWorkState("idle"); setError(payload?.message || "Conversion failed with HTTP " + xhr.status + "."); return;
      }
      if (!payload.downloadUrl || !payload.filename || !payload.jobId) {
        setWorkState("idle"); setError("The conversion API returned an incomplete success response."); return;
      }
      try {
        const download = new URL(payload.downloadUrl);
        if (download.protocol !== "https:" || download.origin !== new URL(API_BASE).origin) throw new Error("Invalid download host");
        setResult({ url: download.toString(), filename: payload.filename, expires: Number(payload.expiresInMinutes) || 60 });
        setWorkState("done");
      } catch {
        setWorkState("idle"); setError("The API returned an invalid download URL.");
      }
    });
    xhr.addEventListener("error", () => { setWorkState("idle"); setError("The browser could not reach Render. Confirm this Vercel origin is included in ALLOWED_ORIGINS on the Render service."); });
    xhr.addEventListener("timeout", () => { setWorkState("idle"); setError("The conversion timed out. Try again with a smaller file."); });
    xhr.send(form);
  }

  const working = workState === "uploading" || workState === "processing";
  const accepted = (tool.inputExtensions || []).join(", ");

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/" className="font-semibold text-blue-700">← Soft3TT</Link>
      <div className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Soft3TT file tools</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">{tool.name}</h1>
        <p className="mt-3 text-slate-600">{tool.description}. Upload a file and convert it with the Soft3TT conversion service.</p>
      </div>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Upload your file</h2>
          <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (apiState === "ready" ? "bg-green-100 text-green-800" : apiState === "checking" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>
            {apiState === "checking" ? "Checking service" : apiState === "ready" ? "API connected" : apiState === "unsupported" ? "Tool unavailable" : "API not reachable"}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">{apiMessage}</p>

        <label htmlFor="soft3tt-file" className="mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center hover:border-blue-400 hover:bg-blue-50" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }}>
          <span className="text-4xl text-blue-700">＋</span>
          <span className="mt-3 font-bold">{file ? file.name : "Choose a file or drag it here"}</span>
          <span className="mt-2 text-sm text-slate-500">Accepted: {accepted} · Up to {maxFileMB} MB</span>
          {file && <span className="mt-1 text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>}
        </label>
        <input ref={inputRef} id="soft3tt-file" type="file" accept={accepted} className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />

        {tool.supportsQuality && <label className="mt-5 block text-sm font-semibold">Video quality<select value={quality} onChange={(event) => setQuality(event.target.value)} className="mt-2 block w-full rounded-lg border p-3 font-normal"><option value="original">Original quality</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label>}
        {tool.supportsAudioBitrate && <label className="mt-5 block text-sm font-semibold">Audio bitrate<select value={audio} onChange={(event) => setAudio(event.target.value)} className="mt-2 block w-full rounded-lg border p-3 font-normal"><option value="original">Standard (192 kbps)</option><option value="128">128 kbps</option><option value="192">192 kbps</option><option value="256">256 kbps</option></select></label>}

        {working && <div className="mt-6" aria-live="polite"><div className="flex justify-between text-sm font-medium"><span>{workState === "uploading" ? "Uploading file..." : "Converting on the server..."}</span><span>{workState === "uploading" ? progress + "%" : "Please wait"}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: (workState === "uploading" ? progress : 100) + "%" }} /></div></div>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {result && <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5"><p className="font-bold text-green-900">Conversion completed successfully.</p><p className="mt-1 break-all text-sm text-green-800">{result.filename}</p><a href={result.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-800">Download converted file</a><p className="mt-2 text-xs text-green-800">This download link expires in approximately {result.expires} minutes.</p></div>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={startConversion} disabled={!file || apiState !== "ready" || working} className="rounded-lg bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">{workState === "uploading" ? "Uploading..." : workState === "processing" ? "Converting..." : "Convert file"}</button>
          <button type="button" onClick={() => { chooseFile(undefined); if (inputRef.current) inputRef.current.value = ""; }} disabled={working} className="rounded-lg border px-6 py-3 font-semibold text-slate-700 disabled:opacity-50">Reset</button>
        </div>
      </section>
      <p className="mt-5 text-xs leading-5 text-slate-500">One file is processed per conversion. The Render service automatically removes temporary results after the configured expiry period.</p>
    </main>
  );
}
