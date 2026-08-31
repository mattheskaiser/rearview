import type { JSONContent } from "@tiptap/core";

/**
 * Convert the lightweight Markdown an LLM produces into an editor-native TipTap
 * document — the same node vocabulary the journal editor uses (paragraph,
 * hardBreak, bulletList / orderedList / listItem, and bold / italic marks).
 *
 * This is the parse/convert layer between an AI response and the editor
 * (task: "Fix AI-generated output formatting"). The model is told to stay
 * concise and grounded, so the surface we support is deliberately small:
 *
 *  - blank line              -> block boundary
 *  - `- ` / `* ` / `+ `      -> bulletList item
 *  - `1.` / `1)`             -> orderedList item (its number seeds `start`)
 *  - `#`..`######` heading   -> a bold paragraph (the editor has no headings)
 *  - `**x**` / `__x__`       -> bold
 *  - `*x*` / `_x_`           -> italic
 *  - `***x***` / `___x___`   -> bold + italic
 *  - `` `x` ``               -> plain text (the editor has no inline code)
 *  - single newline in a paragraph -> hardBreak
 *
 * Pure and deterministic. Also a safe converter for legacy plain text, which is
 * just Markdown with no markup.
 */
export function markdownToTiptap(input: string): JSONContent {
  const text = (input ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return { type: "doc", content: [{ type: "paragraph" }] };

  const lines = text.split("\n");
  const content: JSONContent[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    content.push({ type: "paragraph", content: inlineWithBreaks(paragraph) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);

    if (bullet) {
      flushParagraph();
      const items: string[] = [bullet[1]];
      while (i + 1 < lines.length) {
        const next = /^\s*[-*+]\s+(.*)$/.exec(lines[i + 1]);
        if (!next) break;
        items.push(next[1]);
        i += 1;
      }
      content.push({
        type: "bulletList",
        content: items.map((item) => listItem(item)),
      });
      continue;
    }

    if (ordered) {
      flushParagraph();
      const items: string[] = [ordered[2]];
      const start = Number(ordered[1]);
      while (i + 1 < lines.length) {
        const next = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[i + 1]);
        if (!next) break;
        items.push(next[2]);
        i += 1;
      }
      content.push({
        type: "orderedList",
        ...(start > 1 ? { attrs: { start } } : {}),
        content: items.map((item) => listItem(item)),
      });
      continue;
    }

    if (heading) {
      flushParagraph();
      content.push({
        type: "paragraph",
        content: inlineNodes(heading[1]).map((node) =>
          node.type === "text"
            ? { ...node, marks: [...(node.marks ?? []), { type: "bold" }] }
            : node,
        ),
      });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

/** A `listItem` wrapping a single paragraph of inline content. */
function listItem(raw: string): JSONContent {
  return { type: "listItem", content: [{ type: "paragraph", content: inlineNodes(raw) }] };
}

/** Join paragraph lines with hardBreak nodes between them. */
function inlineWithBreaks(lines: string[]): JSONContent[] {
  const nodes: JSONContent[] = [];
  lines.forEach((line, index) => {
    if (index > 0) nodes.push({ type: "hardBreak" });
    nodes.push(...inlineNodes(line));
  });
  return nodes;
}

const INLINE_RE =
  /(\*\*\*|___)([\s\S]+?)\1|(\*\*|__)([\s\S]+?)\3|(\*|_)([\s\S]+?)\5|`([^`]+)`/;

/** Parse emphasis / code spans in one line into text nodes with marks. */
function inlineNodes(input: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let rest = input;

  const pushText = (value: string, marks?: string[]) => {
    if (!value) return;
    nodes.push({
      type: "text",
      text: value,
      ...(marks && marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
    });
  };

  for (;;) {
    const match = INLINE_RE.exec(rest);
    if (!match) {
      pushText(rest);
      break;
    }
    if (match.index > 0) pushText(rest.slice(0, match.index));

    if (match[1]) pushText(match[2], ["bold", "italic"]);
    else if (match[3]) pushText(match[4], ["bold"]);
    else if (match[5]) pushText(match[6], ["italic"]);
    else if (match[7] !== undefined) pushText(match[7]);

    rest = rest.slice(match.index + match[0].length);
  }

  return nodes.length ? nodes : [];
}
