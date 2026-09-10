"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  transcribe,
  type TranscribeLanguage,
} from "@/lib/editor/transcribe";

export type VoiceStatus = "idle" | "recording" | "transcribing" | "error";

/**
 * Microphone capture + local transcription for the editor. Records with
 * `MediaRecorder`, then hands the blob to the in-browser Whisper worker and
 * emits the recognised text. No audio or text leaves the machine.
 */
export function useVoiceInput(
  onText: (text: string) => void,
  language: TranscribeLanguage = null,
) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(
    () => () => recorderRef.current?.stream.getTracks().forEach((t) => t.stop()),
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked.");
      setStatus("error");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    });
    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      setStatus("transcribing");
      try {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const text = await transcribe(blob, language);
        if (text) onTextRef.current(text);
        setStatus("idle");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not transcribe the audio.",
        );
        setStatus("error");
      }
    });

    recorder.start();
    recorderRef.current = recorder;
    setStatus("recording");
  }, [language]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  return { status, error, start, stop };
}
