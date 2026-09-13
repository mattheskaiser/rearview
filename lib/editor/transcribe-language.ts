/** Whisper language hint; `null` lets the model auto-detect per utterance. */
export type TranscribeLanguage = "english" | "german" | "spanish" | null;

/** Map the UI-facing language name to the ISO 639-1 code whisper.cpp expects. */
export function toWhisperLanguageCode(language: TranscribeLanguage): string {
  switch (language) {
    case "english":
      return "en";
    case "german":
      return "de";
    case "spanish":
      return "es";
    default:
      return "auto";
  }
}
