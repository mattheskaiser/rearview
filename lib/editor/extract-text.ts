/**
 * Deterministic TipTap-document-JSON -> plain text.
 *
 * This is the single source of `contentText`, which in turn feeds search and
 * embedding generation (CLAUDE.md > Rich Text). It must be pure and stable:
 * the same document always yields the same string.
 *
 * Rules:
 * - Paragraphs become lines; a `hardBreak` is a newline within a line.
 * - Bullet list items are prefixed with "- "; numbered list items with "N. ";
 *   nested content is flattened.
 * - Marks (bold, italic) carry no textual meaning and are ignored.
 * - Unknown node types are traversed for any `text` they contain.
 */

export type TipTapMark = { type: string; attrs?: Record<string, unknown> };

export type TipTapNode = {
  type?: string;
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

/** Inline text of a single block node (paragraph / heading-like). */
function inlineText(node: TipTapNode): string {
  if (!node.content) return node.text ?? "";
  return node.content
    .map((child) => {
      if (child.type === "hardBreak") return "\n";
      if (typeof child.text === "string") return child.text;
      return inlineText(child);
    })
    .join("");
}

/** Extract block-level lines from an arbitrary node. */
function blockLines(node: TipTapNode): string[] {
  switch (node.type) {
    case "paragraph":
      return [inlineText(node)];

    case "bulletList": {
      const items = node.content ?? [];
      return items.flatMap((item) => {
        const lines = (item.content ?? []).flatMap(blockLines);
        const nonEmpty = lines.length ? lines : [""];
        return nonEmpty.map((line, i) => (i === 0 ? `- ${line}` : `  ${line}`));
      });
    }

    case "orderedList": {
      const items = node.content ?? [];
      const startRaw = Number(node.attrs?.start);
      let n = Number.isFinite(startRaw) ? startRaw : 1;
      return items.flatMap((item) => {
        const lines = (item.content ?? []).flatMap(blockLines);
        const nonEmpty = lines.length ? lines : [""];
        const prefix = `${n}. `;
        n += 1;
        const indent = " ".repeat(prefix.length);
        return nonEmpty.map((line, i) => (i === 0 ? `${prefix}${line}` : `${indent}${line}`));
      });
    }

    default: {
      if (node.content) return node.content.flatMap(blockLines);
      if (typeof node.text === "string") return [node.text];
      return [];
    }
  }
}

/** Convert a TipTap document node to plain text. */
export function extractPlainText(doc: TipTapNode | null | undefined): string {
  if (!doc || !doc.content) return "";
  return doc.content.flatMap(blockLines).join("\n").trim();
}
