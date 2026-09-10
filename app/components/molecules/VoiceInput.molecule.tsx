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

const formatClock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
};

/**
 * Mic control for the editor toolbar. Speech recognition runs locally in a Web
 * Worker (CLAUDE.md > Privacy). While recording it shows a live input meter, a
 * timer, and a rolling preview of the transcript so you can see you are being
 * heard. The first use downloads the model weights (public files).
 */
export const VoiceInput = ({ onTranscript, language }: VoiceInputProps) => {
  const { status, error, level, elapsedMs, partial, start, stop } =
    useVoiceInput(onTranscript, language ?? null);
  const recording = status === "recording";
  const transcribing = status === "transcribing";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {recording ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </span>
            <span className="tabular-nums">{formatClock(elapsedMs)}</span>
          </span>
        ) : null}

        <button
          type="button"
          aria-label={recording ? "Stop recording" : "Start voice input"}
          aria-pressed={recording}
          onClick={recording ? stop : start}
          disabled={transcribing}
          className={cn(
            "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            recording
              ? "border-destructive/40 bg-destructive/10 text-destructive"
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
      </div>

      {transcribing ? (
        <span className="text-xs text-muted-foreground">Transcribing…</span>
      ) : null}
      {recording && partial ? (
        <p className="max-w-xs text-right text-xs text-muted-foreground italic line-clamp-2">
          {partial}
        </p>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
};
