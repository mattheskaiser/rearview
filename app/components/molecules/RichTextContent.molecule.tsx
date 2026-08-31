import type { JSONContent } from "@tiptap/core";
import { Fragment, type ReactNode } from "react";

import { PROSE_CLASS } from "@/lib/editor/prose";
import { cn } from "@/lib/utils";

type RichTextContentProps = {
  /** A TipTap document — the same format the editor persists. */
  doc: JSONContent | null | undefined;
  /** Extra classes for the wrapper. */
  className?: string;
};

/**
 * Read-only renderer for TipTap document JSON. Shares `PROSE_CLASS` with the
 * editor so a journal entry — or an AI answer converted by
 * {@link markdownToTiptap} — renders identically whether it is being written,
 * browsed on the Journal tab, or shown inside a saved Memory.
 *
 * Supports exactly the editor's node set: paragraph, hardBreak, bulletList,
 * orderedList, listItem, and the bold / italic marks. Unknown nodes are
 * traversed for any text they carry.
 */
export const RichTextContent = ({ doc, className }: RichTextContentProps) => {
  return (
    <div className={cn(PROSE_CLASS, className)}>{renderBlocks(doc?.content)}</div>
  );
};

function renderMarks(text: ReactNode, marks?: { type: string }[]): ReactNode {
  let node = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") node = <strong>{node}</strong>;
    else if (mark.type === "italic") node = <em>{node}</em>;
  }
  return node;
}

function renderInline(nodes: JSONContent[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === "hardBreak") return <br key={index} />;
    if (node.type === "text") {
      return (
        <Fragment key={index}>{renderMarks(node.text ?? "", node.marks)}</Fragment>
      );
    }
    return <Fragment key={index}>{renderInline(node.content)}</Fragment>;
  });
}

function renderBlocks(nodes: JSONContent[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    switch (node.type) {
      case "paragraph":
        return <p key={index}>{renderInline(node.content)}</p>;
      case "bulletList":
        return <ul key={index}>{renderListItems(node.content)}</ul>;
      case "orderedList":
        return (
          <ol key={index} start={numberAttr(node.attrs?.start)}>
            {renderListItems(node.content)}
          </ol>
        );
      case "listItem":
        return <Fragment key={index}>{renderBlocks(node.content)}</Fragment>;
      default:
        return node.content ? (
          <Fragment key={index}>{renderBlocks(node.content)}</Fragment>
        ) : null;
    }
  });
}

function renderListItems(items: JSONContent[] | undefined): ReactNode[] {
  return (items ?? []).map((item, index) => (
    <li key={index}>{renderBlocks(item.content)}</li>
  ));
}

function numberAttr(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 1 ? n : undefined;
}
