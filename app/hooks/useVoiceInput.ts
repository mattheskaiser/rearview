"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  transcribe,
  type TranscribeLanguage,
} from "@/lib/editor/transcribe";

export type VoiceStatus = "idle" | "recording" | "transcribing" | "error";

/** Re-transcribe the buffer at most this often, and only while short. */
const INTERIM_EVERY_MS = 2500;
const INTERIM_MAX_MS = 45_000;

/**
 * Microphone capture + local transcription for the editor. While recording it
 * exposes a live mic `level` and `elapsedMs` so you can see input is being
 * picked up, plus a best-effort `partial` transcript that updates as you speak.
 * On stop it runs a final pass and emits the text. Nothing leaves the machine.
 */
export function useVoiceInput(
  onText: (text: string) => void,
  language: TranscribeLanguage = null,
) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [partial, setPartial] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const lastInterimRef = useRef(0);
  const interimBusyRef = useRef(false);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => teardown, [teardown]);

  const runInterim = useCallback(
    async (language_: TranscribeLanguage) => {
      if (interimBusyRef.current) return;
      if (Date.now() - startedAtRef.current > INTERIM_MAX_MS) return;
      if (Date.now() - lastInterimRef.current < INTERIM_EVERY_MS) return;
      interimBusyRef.current = true;
      lastInterimRef.current = Date.now();
      try {
        const blob = new Blob(chunksRef.current, {
          type: recorderRef.current?.mimeType,
        });
        const text = await transcribe(blob, language_);
        if (recorderRef.current?.state === "recording" && text) setPartial(text);
      } catch {
        // Interim previews are best-effort; the final pass still runs.
      } finally {
        interimBusyRef.current = false;
      }
    },
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    setPartial("");
    setElapsedMs(0);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked.");
      setStatus("error");
      return;
    }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = audioCtx;
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (const sample of buffer) peak = Math.max(peak, Math.abs(sample - 128));
      setLevel(Math.min(1, peak / 96));
      setElapsedMs(Date.now() - startedAtRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    lastInterimRef.current = Date.now();

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
      if (recorder.state === "recording") void runInterim(language);
    });
    recorder.addEventListener("stop", async () => {
      teardown();
      setStatus("transcribing");
      try {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const text = await transcribe(blob, language);
        if (text) onTextRef.current(text);
        setPartial("");
        setStatus("idle");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not transcribe the audio.",
        );
        setStatus("error");
      }
    });

    recorder.start(2000);
    recorderRef.current = recorder;
    setStatus("recording");
    rafRef.current = requestAnimationFrame(tick);
  }, [language, runInterim, teardown]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  return { status, error, level, elapsedMs, partial, start, stop };
}
