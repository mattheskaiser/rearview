import { OverviewTemplate } from "@/app/components/templates/Overview.template";
import { requireSession } from "@/lib/auth/session";
import { getOverviewData } from "@/lib/overview.service";

// Reads the session + database per request; never statically prerendered, so
// `npm run build` needs no live DB.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  // proxy.ts already redirected an unauthenticated request; this is the
  // server-side guarantee, close to the data.
  const { userId, name } = await requireSession();

  const overview = await getOverviewData(userId, name);

  return (
    <OverviewTemplate
      name={overview.name}
      greeting={overview.greeting}
      goalsContent={overview.goalsContent}
      entryDates={overview.entryDates}
      today={overview.today}
    />
  );
}
