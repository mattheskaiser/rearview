import type { JSONContent } from "@tiptap/core";

import { Badge } from "@/app/components/atoms/Badge.atom";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { RichTextContent } from "@/app/components/molecules/RichTextContent.molecule";
import { Spinner } from "@/app/components/atoms/Spinner.atom";
import { Button } from "@/components/ui/button";
import type { ReflectionPhase } from "@/app/hooks/useReflectionStream";

type AnswerPanelProps = {
  answer: string;
  /** The settled answer as editor-native rich text; null while streaming. */
  answerDoc: JSONContent | null;
  phase: ReflectionPhase;
  error: string | null;
  canStop: boolean;
  canSave: boolean;
  canRegenerate: boolean;
  saving: boolean;
  onStop: () => void;
  onSave: () => void;
  onRegenerate: () => void;
};

/**
 * AI synthesis over journal evidence — visually distinct and explicitly
 * labelled. The answer streams in token by token; a Stop button aborts
 * generation while keeping whatever text arrived and the evidence cards.
 */
export const AnswerPanel = ({
  answer,
  answerDoc,
  phase,
  error,
  canStop,
  canSave,
  canRegenerate,
  saving,
  onStop,
  onSave,
  onRegenerate,
}: AnswerPanelProps) => {
  const waiting =
    answer === "" && (phase === "retrieving" || phase === "streaming");

  return (
    <div className="rounded-lg border border-border bg-secondary/25 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="accent">AI-generated</Badge>
        <div className="flex items-center gap-2">
          {canStop ? (
            <Button variant="outline" size="sm" onClick={onStop}>
              Stop
            </Button>
          ) : null}
          {canRegenerate ? (
            <Button variant="ghost" size="sm" onClick={onRegenerate}>
              Regenerate
            </Button>
          ) : null}
          {canSave ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save as Memory"}
            </Button>
          ) : null}
        </div>
      </div>

      {waiting ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {phase === "retrieving"
            ? "Finding relevant entries…"
            : "Writing the answer…"}
        </p>
      ) : null}

      {answerDoc ? (
        <div data-answer>
          <RichTextContent doc={answerDoc} />
        </div>
      ) : answer ? (
        <p data-answer className="text-sm leading-relaxed whitespace-pre-wrap">
          {answer}
          {canStop ? <span className="animate-pulse">▍</span> : null}
        </p>
      ) : null}

      {phase === "stopped" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Stopped. Save what’s here, or ask again.
        </p>
      ) : null}

      {error ? (
        <div className="mt-2">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}
    </div>
  );
};
