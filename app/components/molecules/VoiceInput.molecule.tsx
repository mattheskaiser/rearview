"use client";
import { Loader2, Mic, Square } from "lucide-react";

import { useVoiceInput } from "@/app/hooks/useVoiceInput";
import type { TranscribeLanguage } from "@/lib/editor/transcribe-language";
import { VOICE_MODEL_SIZE_MB } from "@/lib/editor/voice-config";
import { cn } from "@/lib/utils";

type VoiceInputProps = {
  /**
   * Called with each chunk of recognised text as it's transcribed — every
   * few seconds while recording, plus once more for the tail after you stop.
   */
  onTranscript: (text: string) => void;
  /** Optional language hint; omitted means auto-detect (EN + DE + ES covered). */
  language?: TranscribeLanguage;
};

const formatClock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
};

/**
 * Mic control for the editor toolbar. Speech recognition runs locally via
 * whisper.cpp compiled to WebAssembly, in a Web Worker (CLAUDE.md > Privacy).
 * While recording it shows a live input meter and timer, and `onTranscript`
 * fires every couple of seconds with the next chunk of text so it lands in
 * the document as you speak. The first use downloads the model weights
 * (public files, then cached in IndexedDB).
 */
export const VoiceInput = ({ onTranscript, language }: VoiceInputProps) => {
  const { status, error, level, elapsedMs, loadingProgress, start, stop } = useVoiceInput(
    onTranscript,
    language ?? null,
  );
  const recording = status === "recording";
  const loading = status === "loading";
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
          disabled={loading || transcribing}
          className={cn(
            "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            recording
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "text-foreground hover:bg-secondary/60",
          )}
        >
          {loading || transcribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : recording ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
      </div>

      {loading ? (
        <span className="text-xs text-muted-foreground">
          {loadingProgress != null
            ? `Downloading speech model… ${Math.round(loadingProgress * 100)}%`
            : `Loading speech model (~${VOICE_MODEL_SIZE_MB} MB the first time)…`}
        </span>
      ) : null}
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
