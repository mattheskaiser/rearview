/**
 * Shared typography for rendered rich text. The editable surface
 * (`RichTextEditor`) and the read-only viewer (`RichTextContent`) both apply
 * this so a journal entry — or a converted AI answer — looks identical whether
 * it is being written, browsed, or shown inside a saved Memory.
 *
 * Covers every node the editor supports: paragraphs, hard breaks, bulleted and
 * numbered lists, bold, italic.
 */
export const PROSE_CLASS =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:mb-1 [&_li_p]:mb-0 [&_strong]:font-semibold [&_em]:italic";
