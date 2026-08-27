import { Badge } from "@/app/components/atoms/Badge.atom";
import { Button } from "@/components/ui/button";

type AnswerPanelProps = {
  answer: string;
  onSaveAsMemory: () => void;
  saving?: boolean;
};

/**
 * AI synthesis over journal evidence. Visually distinct and explicitly
 * labelled — this is generated text, not journal content.
 */
export const AnswerPanel = ({
  answer,
  onSaveAsMemory,
  saving = false,
}: AnswerPanelProps) => {
  return (
    <div className="rounded-lg border border-border bg-secondary/25 p-4">
      <div className="mb-2 flex items-center justify-between">
        <Badge variant="accent">AI-generated</Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveAsMemory}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save as Memory"}
        </Button>
      </div>
      <p className="text-sm leading-relaxed">{answer}</p>
    </div>
  );
};
