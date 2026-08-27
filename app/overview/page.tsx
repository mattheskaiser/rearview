import { OverviewTemplate } from "@/app/components/templates/Overview.template";
import { getOverviewData } from "@/lib/overview.service";

// Reads the database per request; never statically prerendered, so
// `npm run build` needs no live DB.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { name, goals, entryDates } = await getOverviewData();

  return (
    <OverviewTemplate name={name} goals={goals} entryDates={entryDates} />
  );
}
