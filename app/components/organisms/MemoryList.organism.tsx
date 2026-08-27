"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { SavedMemoryCard } from "@/app/components/molecules/SavedMemoryCard.molecule";
import { deleteMemoryAction } from "@/app/memories/actions";
import type { SavedMemory } from "@/lib/types/memory";

type MemoryListProps = {
  memories: SavedMemory[];
};

export const MemoryList = ({ memories }: MemoryListProps) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    setError(null);
    setRemoved((current) => new Set(current).add(id));
    startTransition(async () => {
      const result = await deleteMemoryAction(id);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
        setRemoved((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
  };

  const visible = memories.filter((memory) => !removed.has(memory.id));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
        Saved memories
      </h2>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {visible.length ? (
        <div className="flex flex-col gap-3">
          {visible.map((memory) => (
            <SavedMemoryCard
              key={memory.id}
              memory={memory}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved memories yet"
          description="Ask a question and save the answer to keep it here."
        />
      )}
    </section>
  );
};
