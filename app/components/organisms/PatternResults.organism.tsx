import { Badge } from "@/app/components/atoms/Badge.atom";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { Spinner } from "@/app/components/atoms/Spinner.atom";
import { PatternObservation } from "@/app/components/molecules/PatternObservation.molecule";
import { Button } from "@/components/ui/button";
import type { PatternAnalysisResult } from "@/lib/ai/parse-pattern-response";

type PatternResultsProps = {
  loading: boolean;
  result: PatternAnalysisResult | null;
  error: string | null;
  canSave: boolean;
  saving: boolean;
  saveStatus: { tone: "success" | "error"; text: string } | null;
  onSave: () => void;
};

/**
 * "Find patterns" results: one card per observation (never a plain chatbot
 * paragraph — CLAUDE.md AI section), then follow-up questions. Not a
 * summary of the retrieved entries; each card is a synthesis claim the model
 * made across them, grounded back to the specific dates that support it.
 */
export const PatternResults = ({
  loading,
  result,
  error,
  canSave,
  saving,
  saveStatus,
  onSave,
}: PatternResultsProps) => {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Looking across your journal for patterns — this can take a little
        longer than a single question…
      </p>
    );
  }

  if (error) return <FormMessage tone="error">{error}</FormMessage>;

  if (!result) return null;

  if (result.observations.length === 0) {
    return (
      <FormMessage tone="error">
        No clear, well-supported pattern turned up for that yet. Try a
        broader question, or write a few more entries first.
      </FormMessage>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="accent">AI-generated</Badge>
        {canSave ? (
          <Button variant="outline" size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save as Memory"}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {result.observations.map((observation, index) => (
          <PatternObservation key={index} {...observation} />
        ))}
      </div>

      {result.followUps.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
            Questions to explore
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {result.followUps.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveStatus ? (
        <FormMessage tone={saveStatus.tone}>{saveStatus.text}</FormMessage>
      ) : null}
    </div>
  );
};
