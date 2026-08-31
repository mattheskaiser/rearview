"use client";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

import { cn } from "@/lib/utils";

type EditorToolbarProps = { editor: Editor };

type ToolButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

const ToolButton = ({ label, active, onClick, children }: ToolButtonProps) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-secondary/60",
    )}
  >
    {children}
  </button>
);

export const EditorToolbar = ({ editor }: EditorToolbarProps) => {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
    }),
  });

  return (
    <div className="flex items-center gap-1">
      <ToolButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolButton>
    </div>
  );
};
