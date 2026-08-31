-- Saved Memories keep the AI answer as editor-native rich text (TipTap document
-- JSON) alongside the plain-text `answer`, so paragraphs, line breaks and lists
-- survive save -> reload -> re-render instead of being flattened.
--
-- Nullable and with no default: existing rows keep `answerDoc = NULL` and are
-- converted from `answer` on read (lib/memory.service.ts). New rows always write
-- both columns.

ALTER TABLE "Memory" ADD COLUMN "answerDoc" JSONB;
