import Link from "next/link";

type ToolCard = { name: string; description: string; href: string };
type ToolGroup = { title: string; items: ToolCard[] };

const groups: ToolGroup[] = [
  {
    title: "Image tools",
    items: [
      { name: "AI Background Remover", description: "Remove or replace image backgrounds", href: "/tools/background-remover" },
      { name: "JPG to PNG", description: "Convert JPG images to PNG", href: "/tools/jpg-to-png" },
      { name: "PNG to JPG", description: "Convert PNG images to JPG", href: "/tools/png-to-jpg" },
      { name: "WEBP to JPG", description: "Convert WEBP images to JPG", href: "/tools/webp-to-jpg" },
      { name: "HEIC to JPG", description: "Convert HEIC images to JPG", href: "/tools/heic-to-jpg" },
      { name: "JPG to PDF", description: "Convert JPG images to PDF", href: "/tools/jpg-to-pdf" },
      { name: "PDF to JPG", description: "Convert the first PDF page to JPG", href: "/tools/pdf-to-jpg" },
    ],
  },
  {
    title: "Video tools",
    items: [
      { name: "MOV to MP4", description: "Convert MOV videos to MP4", href: "/tools/mov-to-mp4" },
      { name: "MP4 to WEBM", description: "Convert MP4 videos to WEBM", href: "/tools/mp4-to-webm" },
      { name: "Video to MP3", description: "Extract audio from video", href: "/tools/video-to-mp3" },
      { name: "MP4 to MP3", description: "Extract audio from MP4", href: "/tools/mp4-to-mp3" },
      { name: "Video to GIF", description: "Create GIFs from video", href: "/tools/video-to-gif" },
    ],
  },
  {
    title: "Audio tools",
    items: [
      { name: "WAV to MP3", description: "Convert WAV audio to MP3", href: "/tools/wav-to-mp3" },
      { name: "M4A to MP3", description: "Convert M4A audio to MP3", href: "/tools/m4a-to-mp3" },
    ],
  },
  {
    title: "Document tools",
    items: [{ name: "Word to PDF", description: "Convert DOC/DOCX documents to PDF", href: "/tools/word-to-pdf" }],
  },
];

export default function Home() {
  return (
    <main>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-5">
          <Link href="/" className="text-2xl font-black text-blue-700">Soft3TT.</Link>
          <nav className="flex gap-5 text-sm">
            <a href="#tools">All tools</a>
            <Link href="/workspace">My workspace</Link>
            <Link href="/auth/sign-in">Sign in</Link>
          </nav>
        </div>
      </header>
      <section className="bg-gradient-to-br from-slate-950 to-blue-800 px-6 py-20 text-center text-white">
        <h1 className="text-4xl font-black md:text-5xl">Make files work for you.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-blue-100">Convert images, video, audio and documents using the Soft3TT conversion service. Remove image backgrounds with AI in a dedicated workspace.</p>
        <Link className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-bold text-blue-800" href="/tools/background-remover">Try AI Background Remover</Link>
      </section>
      <section id="tools" className="mx-auto max-w-7xl px-6 py-14">
        <h2 className="mb-8 text-3xl font-black">Tools for every file</h2>
        <div className="grid gap-7 md:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} className="rounded-2xl border bg-white p-6">
              <h3 className="mb-4 text-xl font-bold">{group.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-xl border p-4 hover:border-blue-400 hover:bg-blue-50">
                    <b>{item.name}</b>
                    <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
