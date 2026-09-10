"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useMemo } from "react";

import { getReadyChecker } from "@/lib/editor/spellcheck/dictionary";
import type { SpellcheckWordClick } from "@/lib/editor/spellcheck/extension";

type SpellcheckPopoverProps = {
  info: SpellcheckWordClick | null;
  editor: Editor;
  onClose: () => void;
};

/**
 * Correction menu for a flagged word: a few suggestions to replace it with,
 * plus "Ignore once" (this session) and "Add to dictionary" (persisted). All
 * local — nothing is sent anywhere.
 */
export const SpellcheckPopover = ({
  info,
  editor,
  onClose,
}: SpellcheckPopoverProps) => {
  const suggestions = useMemo(
    () => (info ? (getReadyChecker()?.suggest(info.word) ?? []) : []),
    [info],
  );

  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [info, onClose]);

  if (!info) return null;

  const replace = (word: string) => {
    editor
      .chain()
      .focus()
      .insertContentAt({ from: info.from, to: info.to }, word)
      .run();
    onClose();
  };

  const afterDictionaryChange = () => {
    editor.commands.recheckSpelling();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        role="menu"
        className="fixed z-50 w-52 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
        style={{
          top: Math.round(info.rect.bottom + 4),
          left: Math.round(info.rect.left),
        }}
      >
        {suggestions.length > 0 ? (
          suggestions.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => replace(word)}
              className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {word}
            </button>
          ))
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No suggestions
          </p>
        )}
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          onClick={() => {
            getReadyChecker()?.ignore(info.word);
            afterDictionaryChange();
          }}
          className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left hover:bg-muted"
        >
          Ignore once
        </button>
        <button
          type="button"
          onClick={() => {
            getReadyChecker()?.add(info.word);
            afterDictionaryChange();
          }}
          className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left hover:bg-muted"
        >
          Add to dictionary
        </button>
      </div>
    </>
  );
};
