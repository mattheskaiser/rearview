"use client";
import type { JSONContent } from "@tiptap/core";
import { useState, useTransition } from "react";

import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { RichTextEditor } from "@/app/components/organisms/RichTextEditor.organism";
import { saveGoalsAction } from "@/app/(app)/overview/actions";
import { Button } from "@/components/ui/button";

type CurrentGoalsProps = {
  /** Saved goals document, or null when nothing is written yet. */
  initialContent: JSONContent | null;
};

type Status = { tone: "success" | "error"; text: string };

const serialize = (doc: JSONContent | null) => (doc ? JSON.stringify(doc) : "");

/**
 * Current Goals editor. Uses the shared rich-text editor (same as journal
 * entries) and persists through a server action. Intentionally lightweight —
 * it only tracks its own draft / saved / status state (CLAUDE.md > Current
 * Goals).
 */
export const CurrentGoals = ({ initialContent }: CurrentGoalsProps) => {
  const [doc, setDoc] = useState<JSONContent | null>(initialContent);
  const [savedDoc, setSavedDoc] = useState<JSONContent | null>(initialContent);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = serialize(doc) !== serialize(savedDoc);

  const handleSave = () => {
    setStatus(null);
    const submitted = doc;
    startTransition(async () => {
      const result = await saveGoalsAction({ content: submitted ?? {} });
      if (result.ok) {
        setSavedDoc(submitted);
        setStatus({ tone: "success", text: "Goals saved." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
        Current goals
      </h2>
      <RichTextEditor
        content={initialContent ?? undefined}
        onChange={setDoc}
        ariaLabel="Current goals"
        className="min-h-32"
      />
      <div className="flex items-center justify-between gap-4">
        {status ? (
          <FormMessage tone={status.tone}>{status.text}</FormMessage>
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!dirty || pending}
        >
          {pending ? "Saving…" : "Save goals"}
        </Button>
      </div>
    </section>
  );
};
