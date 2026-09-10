"use client";
import { Loader2, Mic, Square } from "lucide-react";

import { useVoiceInput } from "@/app/hooks/useVoiceInput";
import type { TranscribeLanguage } from "@/lib/editor/transcribe";
import { cn } from "@/lib/utils";

type VoiceInputProps = {
  /** Called with recognised text once a recording is transcribed. */
  onTranscript: (text: string) => void;
  /** Optional language hint; omitted means auto-detect (EN + DE covered). */
  language?: TranscribeLanguage;
};

/**
 * Mic button for the editor toolbar. Speech recognition runs locally in a Web
 * Worker (CLAUDE.md > Privacy) — no audio or text is sent anywhere. The first
 * use downloads the model weights (public files) and can take a moment.
 */
export const VoiceInput = ({ onTranscript, language }: VoiceInputProps) => {
  const { status, error, start, stop } = useVoiceInput(
    onTranscript,
    language ?? null,
  );
  const recording = status === "recording";
  const transcribing = status === "transcribing";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={recording ? "Stop recording" : "Start voice input"}
        aria-pressed={recording}
        onClick={recording ? stop : start}
        disabled={transcribing}
        className={cn(
          "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          recording
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-secondary/60",
        )}
      >
        {transcribing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : recording ? (
          <Square className="size-4" />
        ) : (
          <Mic className="size-4" />
        )}
      </button>
      {transcribing ? (
        <span className="text-xs text-muted-foreground">Transcribing…</span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
};
