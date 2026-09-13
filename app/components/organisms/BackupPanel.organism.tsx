"use client";
import { useState, useTransition } from "react";

import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { triggerBackupAction } from "@/app/(app)/overview/actions";
import type { BackupSummary } from "@/lib/backup.service";
import { Button } from "@/components/ui/button";

type BackupPanelProps = {
  /** Most recent backup, or null if one has never run. */
  lastBackup: BackupSummary | null;
};

type Status = { tone: "success" | "error"; text: string };

/**
 * Manual backup trigger for the Overview page. Snapshots journal entries,
 * Memories and Current Goals into Postgres — a safety net the user reaches
 * for right after writing something they don't want to lose (CLAUDE.md:
 * Overview stays simple; this is one button plus a status line, not a backup
 * management UI).
 */
export const BackupPanel = ({ lastBackup: initialLastBackup }: BackupPanelProps) => {
  const [lastBackup, setLastBackup] = useState(initialLastBackup);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  const handleBackup = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await triggerBackupAction();
      if (result.ok) {
        setLastBackup(result.summary);
        setStatus({ tone: "success", text: "Backup saved." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
        Backup
      </h2>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lastBackup
            ? `Last backup: ${lastBackup.formattedCreatedAt} (${lastBackup.entryCount} ${
                lastBackup.entryCount === 1 ? "entry" : "entries"
              }, ${lastBackup.memoryCount} ${
                lastBackup.memoryCount === 1 ? "memory" : "memories"
              })`
            : "No backup yet."}
        </p>
        <Button variant="outline" size="sm" onClick={handleBackup} disabled={pending}>
          {pending ? "Backing up…" : "Back up now"}
        </Button>
      </div>
      {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
    </section>
  );
};
