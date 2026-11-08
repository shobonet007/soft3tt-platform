import { notFound } from "next/navigation";
import ConverterWorkbench from "@/components/converter-workbench";
import { bySlug } from "@/lib/conversion/registry";

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  const item = bySlug(slug);
  if (!item || item.kind !== "conversion") notFound();
  return <ConverterWorkbench tool={item} />;
}
