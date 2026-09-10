"use client";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";

import { EditorToolbar } from "@/app/components/molecules/EditorToolbar.molecule";
import { VoiceInput } from "@/app/components/molecules/VoiceInput.molecule";
import { editorExtensions } from "@/lib/editor/editor-extensions";
import { toPlainDocument } from "@/lib/editor/plain-document";
import { PROSE_CLASS } from "@/lib/editor/prose";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  /** Initial document as TipTap JSON. */
  content?: JSONContent;
  onChange?: (doc: JSONContent) => void;
  /** Accessible name for the editing surface. */
  ariaLabel?: string;
  /** Extra classes for the editing surface (e.g. a shorter `min-h-*`). */
  className?: string;
};

/**
 * Minimal reusable rich-text editor (Tiptap). Supports paragraphs, bold,
 * italic, bulleted and numbered lists, and line breaks only. Emits TipTap
 * document JSON — the stored representation that `extractPlainText` turns into
 * plain text (CLAUDE.md > Rich Text).
 *
 * The editing surface has a sensible default height and a bounded maximum: past
 * that it scrolls internally instead of stretching the page, and the user can
 * drag the bottom edge to a custom height (task: "Prevent the editor from
 * stretching the page excessively").
 *
 * Deliberately domain-agnostic: it knows nothing about journal entries or
 * goals. Callers own persistence and any surrounding form state. Callers clear
 * the editor by unmounting it, not through an imperative signal.
 */
export const RichTextEditor = ({
  content,
  onChange,
  ariaLabel,
  className,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: editorExtensions,
    content: content ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        // Native, fully-offline spell check (CLAUDE.md > Privacy): the browser
        // flags misspellings and "Add to dictionary" is the per-profile ignore.
        spellcheck: "true",
        // The surface owns its default height; the wrapper caps and scrolls it.
        class: cn(PROSE_CLASS, "min-h-52 outline-none", className),
      },
    },
    // `toPlainDocument` strips the null-prototype attrs TipTap emits (e.g. on
    // `orderedList`) so the document survives a server-action boundary.
    onUpdate: ({ editor: e }) => onChange?.(toPlainDocument(e.getJSON())),
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EditorToolbar editor={editor} />
        <VoiceInput
          onTranscript={(text) =>
            editor.chain().focus().insertContent(text).run()
          }
        />
      </div>
      <div className="max-h-[60vh] resize-y overflow-y-auto rounded-lg border border-border px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/30">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
