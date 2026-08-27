export const ActivityLegend = () => {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-primary bg-primary" />
        Entry
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-border bg-neutral-200" />
        No entry
      </span>
    </div>
  );
};
