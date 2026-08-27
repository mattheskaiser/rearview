"use client";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type QuestionInputProps = {
  onAsk: (question: string) => void;
  pending?: boolean;
};

export const QuestionInput = ({ onAsk, pending = false }: QuestionInputProps) => {
  const [question, setQuestion] = useState("");
  const trimmed = question.trim();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onAsk(trimmed);
      }}
    >
      <Textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Ask your journal a question…"
        className="min-h-20"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!trimmed || pending}>
          Ask
        </Button>
      </div>
    </form>
  );
};
