"use client";
import { cn } from "@/lib/utils";

export type QueryMode = "ask" | "patterns";

type QueryModeToggleProps = {
  mode: QueryMode;
  onChange: (mode: QueryMode) => void;
};

/**
 * Explicit switch between a single grounded answer ("Ask") and a broader
 * synthesis across the whole journal ("Find patterns") — two different
 * retrieval shapes and prompts (lib/reflection.service vs
 * lib/ai/pattern-analysis.service), picked by the user rather than guessed
 * from the question text. An LLM-based router would be one more thing that
 * can fail; a click can't be misclassified.
 */
export const QueryModeToggle = ({ mode, onChange }: QueryModeToggleProps) => {
  return (
    <div role="group" aria-label="Query mode" className="flex gap-2">
      <Pill active={mode === "ask"} onClick={() => onChange("ask")}>
        Ask
      </Pill>
      <Pill active={mode === "patterns"} onClick={() => onChange("patterns")}>
        Find patterns
      </Pill>
    </div>
  );
};

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
