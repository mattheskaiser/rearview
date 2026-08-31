"use client";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";

import { EditorToolbar } from "@/app/components/molecules/EditorToolbar.molecule";
import { editorExtensions } from "@/lib/editor/editor-extensions";
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
  /**
   * Bump this to imperatively clear the editor — e.g. after a successful save,
   * so the form returns to its empty state without losing anything on failure.
   * The first value is ignored so existing content survives mount.
   */
  resetSignal?: number;
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
 * goals. Callers own persistence and any surrounding form state.
 */
export const RichTextEditor = ({
  content,
  onChange,
  ariaLabel,
  className,
  resetSignal,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: editorExtensions,
    content: content ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        // The surface owns its default height; the wrapper caps and scrolls it.
        class: cn(PROSE_CLASS, "min-h-52 outline-none", className),
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
  });

  const seenReset = useRef(false);
  useEffect(() => {
    if (!editor) return;
    if (!seenReset.current) {
      seenReset.current = true;
      return;
    }
    // No emitUpdate: the caller has already reset its own draft state to empty,
    // and firing onChange here would race it back to a non-null empty doc.
    editor.commands.clearContent(false);
  }, [editor, resetSignal]);

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <EditorToolbar editor={editor} />
      <div className="max-h-[60vh] resize-y overflow-y-auto rounded-lg border border-border px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/30">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
