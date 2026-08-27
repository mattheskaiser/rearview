type MemoryMetadataProps = {
  /** ISO timestamp of when the memory was saved. */
  savedAt: string;
  entryCount: number;
};

export const MemoryMetadata = ({ savedAt, entryCount }: MemoryMetadataProps) => {
  const saved = new Date(savedAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <p className="text-xs text-muted-foreground">
      Saved {saved} · {entryCount} {entryCount === 1 ? "entry" : "entries"}
    </p>
  );
};
