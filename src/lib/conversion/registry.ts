export type Tool = {
  id: string;
  name: string;
  description: string;
  kind: "conversion" | "background";
  inputExtensions?: string[];
  supportsQuality?: boolean;
  supportsAudioBitrate?: boolean;
};

// IDs and accepted source extensions are aligned with TOOL_DEFS and
// validateInput() in soft3tt-conversion-api/src/server.js.
const conversionTools: Tool[] = [
  { id: "mov-to-mp4", name: "MOV to MP4", description: "Convert MOV videos to MP4", kind: "conversion", inputExtensions: [".mov"], supportsQuality: true, supportsAudioBitrate: true },
  { id: "mp4-to-webm", name: "MP4 to WEBM", description: "Convert MP4 videos to WEBM", kind: "conversion", inputExtensions: [".mp4"] },
  { id: "video-to-mp3", name: "Video to MP3", description: "Extract MP3 audio from a video", kind: "conversion", inputExtensions: [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"], supportsAudioBitrate: true },
  { id: "mp4-to-mp3", name: "MP4 to MP3", description: "Extract MP3 audio from MP4", kind: "conversion", inputExtensions: [".mp4"], supportsAudioBitrate: true },
  { id: "video-to-gif", name: "Video to GIF", description: "Create an animated GIF from a video", kind: "conversion", inputExtensions: [".mp4", ".mov", ".mkv", ".webm"] },
  { id: "wav-to-mp3", name: "WAV to MP3", description: "Convert WAV audio to MP3", kind: "conversion", inputExtensions: [".wav"], supportsAudioBitrate: true },
  { id: "m4a-to-mp3", name: "M4A to MP3", description: "Convert M4A audio to MP3", kind: "conversion", inputExtensions: [".m4a"], supportsAudioBitrate: true },
  { id: "jpg-to-png", name: "JPG to PNG", description: "Convert JPG images to PNG", kind: "conversion", inputExtensions: [".jpg", ".jpeg"] },
  { id: "png-to-jpg", name: "PNG to JPG", description: "Convert PNG images to JPG", kind: "conversion", inputExtensions: [".png"] },
  { id: "webp-to-jpg", name: "WEBP to JPG", description: "Convert WEBP images to JPG", kind: "conversion", inputExtensions: [".webp"] },
  { id: "heic-to-jpg", name: "HEIC to JPG", description: "Convert HEIC/HEIF images to JPG", kind: "conversion", inputExtensions: [".heic", ".heif"] },
  { id: "jpg-to-pdf", name: "JPG to PDF", description: "Convert a JPG image to PDF", kind: "conversion", inputExtensions: [".jpg", ".jpeg"] },
  { id: "pdf-to-jpg", name: "PDF to JPG", description: "Convert the first PDF page to JPG", kind: "conversion", inputExtensions: [".pdf"] },
  { id: "word-to-pdf", name: "Word to PDF", description: "Convert DOC/DOCX documents to PDF", kind: "conversion", inputExtensions: [".doc", ".docx"] },
];

export const tools: Tool[] = [
  ...conversionTools,
  {
    id: "background-remover",
    name: "AI Background Remover",
    description: "Remove or replace image backgrounds",
    kind: "background",
  },
];

export const bySlug = (slug: string) => tools.find((tool) => tool.id === slug);
