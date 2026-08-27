"use client";
import { useState, useTransition } from "react";

import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { saveGoalsAction } from "@/app/overview/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type GoalCardProps = {
  initialValue?: string;
  placeholder?: string;
};

type Status = { tone: "success" | "error"; text: string };

/**
 * Lightweight editable goals card. Persists through a server action; the card
 * only tracks its own draft / saved / status state (CLAUDE.md > Current Goals).
 */
export const GoalCard = ({
  initialValue = "",
  placeholder = "What direction do you care about right now?",
}: GoalCardProps) => {
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value !== savedValue;

  const handleSave = () => {
    setStatus(null);
    const submitted = value;
    startTransition(async () => {
      const result = await saveGoalsAction({ text: submitted });
      if (result.ok) {
        setSavedValue(submitted);
        setStatus({ tone: "success", text: "Goals saved." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={pending}
        className="min-h-24 border-0 p-0 focus-visible:ring-0"
      />
      <div className="mt-3 flex items-center justify-between gap-4">
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
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
};
