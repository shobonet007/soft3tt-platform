"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type WorkerHealth = {
  configured: boolean;
  ready: boolean;
  device?: string;
  model?: string;
  message: string;
};

type OutputFile = { url: string; name: string; isZip: boolean };

const MAX_FILES = 3;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function BackgroundRemoverPage() {
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"transparent" | "solid" | "image">("transparent");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [output, setOutput] = useState<OutputFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/background-removal", { cache: "no-store" })
      .then(async (response) => {
        const value = await response.json();
        if (active) setHealth(value as WorkerHealth);
      })
      .catch(() => {
        if (active) setHealth({ configured: false, ready: false, message: "Could not check GPU worker status." });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => () => {
    if (output?.url) URL.revokeObjectURL(output.url);
  }, [output]);

  function selectFiles(list: FileList | null) {
    if (!list) return;
    const chosen = Array.from(list);
    setError("");
    setOutput(null);
    if (!chosen.length) { setFiles([]); return; }
    if (chosen.length > MAX_FILES) { setError("You can process a maximum of three images in one batch."); return; }
    if (chosen.some((file) => !ACCEPTED_TYPES.includes(file.type))) { setError("Only JPG, PNG and WEBP images are supported."); return; }
    const size = chosen.reduce((sum, file) => sum + file.size, 0) + (backgroundFile?.size ?? 0);
    if (size > MAX_TOTAL_BYTES) { setError("The total upload must be 4 MB or less on the current Vercel Hobby route."); return; }
    setFiles(chosen);
  }

  function selectBackground(file: File | null) {
    setError("");
    setOutput(null);
    if (file && !ACCEPTED_TYPES.includes(file.type)) { setError("The replacement background must be JPG, PNG or WEBP."); return; }
    const total = files.reduce((sum, item) => sum + item.size, 0) + (file?.size ?? 0);
    if (total > MAX_TOTAL_BYTES) { setError("The total upload, including the background, must be 4 MB or less."); return; }
    setBackgroundFile(file);
  }

  async function processImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setOutput(null);
    if (!health?.ready) { setError("The GPU worker is not ready. Check the worker deployment and Vercel environment variables."); return; }
    if (!files.length) { setError("Choose at least one image to continue."); return; }
    if (mode === "image" && !backgroundFile) { setError("Choose a replacement background image."); return; }

    setBusy(true);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file, file.name));
      body.set("mode", mode);
      body.set("backgroundColor", backgroundColor);
      if (mode === "image" && backgroundFile) body.set("background", backgroundFile, backgroundFile.name);

      const response = await fetch("/api/background-removal", { method: "POST", body });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || "Background removal failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const isZip = blob.type.includes("zip") || files.length > 1;
      const name = match?.[1] || (isZip ? "Soft3TT-background-removal-batch.zip" : "Soft3TT-background-removed.png");
      setOutput({ url: URL.createObjectURL(blob), name, isZip });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Background removal failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  const statusText = health === null ? "Checking GPU worker…"
    : health.ready ? `AI worker ready · ${health.device || "GPU"}`
    : health.configured ? "Worker connected, model not ready" : "GPU worker not connected";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="font-semibold text-blue-700 hover:underline">← Soft3TT home</Link>
        <div className="mt-8 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">Soft3TT AI tools</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">AI Background Remover</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">Remove an image background, keep a transparent PNG, or place your subject on a new colour or image.</p>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <span className={health?.ready ? "h-2.5 w-2.5 rounded-full bg-emerald-500" : "h-2.5 w-2.5 rounded-full bg-amber-500"} />
          <span className="font-semibold">{statusText}</span>
          {health?.message && <span className="text-sm text-slate-500">{health.message}</span>}
          {health?.model && <span className="ml-auto text-xs text-slate-400">{health.model}</span>}
        </div>

        <form onSubmit={processImages} className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">1. Upload images</h2>
              <span className="text-sm text-slate-500">Up to 3 images · 4 MB total</span>
            </div>
            <label className="mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-5 py-8 text-center hover:border-blue-400">
              <span className="text-4xl font-light text-blue-700">＋</span>
              <span className="mt-2 font-semibold">Choose images</span>
              <span className="mt-1 text-sm text-slate-500">JPG, PNG or WEBP</span>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} />
            </label>

            {files.length > 0 && <div className="mt-4 space-y-2">
              {files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate font-medium">{file.name}</span><span className="shrink-0 text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
              </div>)}
              <button type="button" onClick={() => { setFiles([]); setOutput(null); }} className="text-sm font-semibold text-blue-700 hover:underline">Clear images</button>
            </div>}

            {previews.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map((url, index) => <div key={url} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={files[index]?.name || "Selected image"} className="h-32 w-full object-contain" />
              </div>)}
            </div>}

            <h2 className="mt-8 text-xl font-bold">2. Choose background</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {([ ["transparent", "Transparent PNG"], ["solid", "Solid colour"], ["image", "Image background"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setMode(value); setOutput(null); }} className={mode === value ? "rounded-xl border-2 border-blue-600 bg-blue-50 px-3 py-3 text-sm font-bold text-blue-800" : "rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300"}>{label}</button>)}
            </div>

            {mode === "solid" && <label className="mt-4 flex items-center gap-3 text-sm font-semibold">Background colour
              <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="h-10 w-16 cursor-pointer rounded border border-slate-200 bg-white" />
              <span className="font-mono text-slate-500">{backgroundColor}</span>
            </label>}

            {mode === "image" && <label className="mt-4 block text-sm font-semibold">Replacement background image
              <input className="mt-2 block w-full rounded-lg border border-slate-200 p-3 text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectBackground(event.target.files?.[0] || null)} />
              {backgroundFile && <span className="mt-2 block font-normal text-slate-500">{backgroundFile.name}</span>}
            </label>}

            <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Current upload limit: 4 MB combined. This temporary limit applies while uploads pass through the Vercel Hobby function.</div>
            {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={busy || !health?.ready || !files.length} className="rounded-lg bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Removing background…" : "Remove background"}</button>
              <button type="button" onClick={() => { setFiles([]); setBackgroundFile(null); setOutput(null); setError(""); }} className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold">3. Preview and download</h2>
            {!output ? <div className="mt-5 flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm leading-6 text-slate-500">Your processed image will appear here after the GPU worker is connected and ready.</div>
              : <div className="mt-5">
                {output.isZip ? <div className="flex min-h-48 items-center justify-center rounded-xl bg-slate-50 p-6 text-center"><div><div className="text-4xl font-black text-blue-700">ZIP</div><p className="mt-3 font-semibold">Batch images processed</p><p className="mt-1 text-sm text-slate-500">Your results are packaged in one ZIP file.</p></div></div>
                  : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={output.url} alt="Background removed result" className="max-h-[28rem] w-full object-contain" /></div>}
                <p className="mt-3 break-all text-sm font-medium text-slate-600">{output.name}</p>
                <a href={output.url} download={output.name} className="mt-4 block rounded-lg bg-emerald-700 px-5 py-3 text-center font-bold text-white hover:bg-emerald-800">Download result</a>
              </div>}
          </aside>
        </form>
      </div>
    </main>
  );
}
