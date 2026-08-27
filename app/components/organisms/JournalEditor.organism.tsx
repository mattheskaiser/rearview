"use client";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";

import { EditorToolbar } from "@/app/components/molecules/EditorToolbar.molecule";
import { editorExtensions } from "@/lib/editor/editor-extensions";

type JournalEditorProps = {
  /** Initial document as TipTap JSON. */
  content?: JSONContent;
  onChange?: (doc: JSONContent) => void;
};

/**
 * Minimal rich-text journal editor (Tiptap). Supports paragraphs, bold,
 * italic, bulleted lists, and line breaks only. Emits TipTap document JSON —
 * the stored representation that `extractPlainText` turns into search /
 * embedding text (CLAUDE.md > Rich Text).
 */
export const JournalEditor = ({ content, onChange }: JournalEditorProps) => {
  const editor = useEditor({
    extensions: editorExtensions,
    content: content ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-52 rounded-lg border border-border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
