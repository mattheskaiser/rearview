import type { JSONContent } from "@tiptap/core";

/**
 * Plain text → Tiptap document JSON, matching the editor's supported nodes
 * (paragraph, bulletList/listItem, hardBreak) and the inverse of
 * `lib/editor/extract-text.ts`:
 *
 *  - Blank lines (`\n\n`) separate blocks.
 *  - A block whose every line starts with "- " becomes a bulleted list.
 *  - Any other multi-line block keeps its line breaks as hard breaks.
 *
 * Round-trips: `extractPlainText(plainToTiptap(text)) === text` for the corpus,
 * so the seeded `contentText` is byte-for-byte what the app would extract.
 */
export function plainToTiptap(text: string): JSONContent {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return { type: "doc", content: [] };

  const blocks = normalized.split(/\n{2,}/);
  const content: JSONContent[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const isBulletList =
      lines.length > 0 && lines.every((line) => line.startsWith("- "));

    if (isBulletList) {
      content.push({
        type: "bulletList",
        content: lines.map((line) => ({
          type: "listItem",
          content: [paragraph(line.slice(2))],
        })),
      });
    } else {
      content.push(paragraphWithBreaks(lines));
    }
  }

  return { type: "doc", content };
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function paragraphWithBreaks(lines: string[]): JSONContent {
  const nodes: JSONContent[] = [];
  lines.forEach((line, index) => {
    if (index > 0) nodes.push({ type: "hardBreak" });
    if (line) nodes.push({ type: "text", text: line });
  });
  return { type: "paragraph", content: nodes };
}
