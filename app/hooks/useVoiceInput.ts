"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { startCapture } from "@/lib/editor/whisper-capture";
import type { TranscribeLanguage } from "@/lib/editor/transcribe-language";
import { createWhisperSession, type WhisperSession } from "@/lib/editor/whisper-session";

export type VoiceStatus = "idle" | "loading" | "recording" | "transcribing" | "error";

/**
 * Microphone capture + real-time local transcription for the editor, backed
 * by whisper.cpp running in a Web Worker (CLAUDE.md > Privacy — nothing
 * leaves the machine). While recording it exposes a live mic `level` and
 * `elapsedMs`; `onText` fires every couple of seconds with the next chunk of
 * recognised speech so it lands in the document as you talk, rather than all
 * at once when you stop.
 */
export function useVoiceInput(
  onText: (text: string) => void,
  language: TranscribeLanguage = null,
) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** Model download progress (0–1) while `status` is "loading"; `null` once
   *  known to be cached (no download needed) or after loading finishes. */
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<ReturnType<typeof startCapture> | null>(null);
  const sessionRef = useRef<WhisperSession | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const emittedAnyRef = useRef(false);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const releaseMic = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => releaseMic, [releaseMic]);

  const start = useCallback(async () => {
    setError(null);
    setElapsedMs(0);
    setLoadingProgress(null);
    emittedAnyRef.current = false;
    setStatus("loading");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: true,
          noiseSuppression: true,
        },
      });
    } catch {
      setError("Microphone access was blocked.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    let session: WhisperSession;
    try {
      session = await createWhisperSession({
        language,
        onText: (text) => {
          onTextRef.current(emittedAnyRef.current ? ` ${text}` : text);
          emittedAnyRef.current = true;
        },
        onDownloadProgress: (fraction) => setLoadingProgress(fraction),
      });
    } catch (err) {
      releaseMic();
      setError(
        err instanceof Error ? err.message : "Could not start the speech model.",
      );
      setStatus("error");
      return;
    }
    sessionRef.current = session;
    setLoadingProgress(null);

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = audioCtx;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    startedAtRef.current = Date.now();

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (const sample of buffer) peak = Math.max(peak, Math.abs(sample - 128));
      setLevel(Math.min(1, peak / 96));
      setElapsedMs(Date.now() - startedAtRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    captureRef.current = startCapture(stream, session);
    setStatus("recording");
    rafRef.current = requestAnimationFrame(tick);
  }, [language, releaseMic]);

  const stop = useCallback(() => {
    if (status !== "recording") return;
    captureRef.current?.stop();
    captureRef.current = null;
    releaseMic();
    setStatus("transcribing");

    const session = sessionRef.current;
    sessionRef.current = null;
    void session?.stop().finally(() => setStatus("idle"));
  }, [status, releaseMic]);

  return { status, error, level, elapsedMs, loadingProgress, start, stop };
}
