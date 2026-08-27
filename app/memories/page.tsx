import { MemoriesTemplate } from "@/app/components/templates/Memories.template";
import { listSavedMemories } from "@/lib/memory.service";

// Reads the database per request; never statically prerendered, so
// `npm run build` needs no live DB.
export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const savedMemories = await listSavedMemories();

  return <MemoriesTemplate savedMemories={savedMemories} />;
}
