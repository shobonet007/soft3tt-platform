
export type Tool = {
  id: string;
  name: string;
  description: string;
  kind: "conversion" | "background";
};

const conversionTools: Tool[] = [
  {
    id: "mov-to-mp4",
    name: "MOV to MP4",
    description: "Convert MOV to MP4",
    kind: "conversion",
  },
  {
    id: "mp4-to-webm",
    name: "MP4 to WEBM",
    description: "Convert MP4 to WEBM",
    kind: "conversion",
  },
  {
    id: "video-to-mp3",
    name: "Video to MP3",
    description: "Extract audio",
    kind: "conversion",
  },
  {
    id: "video-to-gif",
    name: "Video to GIF",
    description: "Create GIF",
    kind: "conversion",
  },
  {
    id: "wav-to-mp3",
    name: "WAV to MP3",
    description: "Convert WAV to MP3",
    kind: "conversion",
  },
  {
    id: "m4a-to-mp3",
    name: "M4A to MP3",
    description: "Convert M4A to MP3",
    kind: "conversion",
  },
  {
    id: "jpg-to-png",
    name: "JPG to PNG",
    description: "Convert JPG to PNG",
    kind: "conversion",
  },
  {
    id: "png-to-jpg",
    name: "PNG to JPG",
    description: "Convert PNG to JPG",
    kind: "conversion",
  },
  {
    id: "webp-to-jpg",
    name: "WEBP to JPG",
    description: "Convert WEBP to JPG",
    kind: "conversion",
  },
  {
    id: "heic-to-jpg",
    name: "HEIC to JPG",
    description: "Convert HEIC to JPG",
    kind: "conversion",
  },
  {
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    description: "Convert JPG to PDF",
    kind: "conversion",
  },
  {
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    description: "Convert PDF to JPG",
    kind: "conversion",
  },
  {
    id: "word-to-pdf",
    name: "Word to PDF",
    description: "Convert Word to PDF",
    kind: "conversion",
  },
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

export const bySlug = (slug: string) =>
  tools.find((tool) => tool.id === slug);
