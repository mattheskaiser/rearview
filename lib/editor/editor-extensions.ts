import { StarterKit } from "@tiptap/starter-kit";

/**
 * Tiptap configuration for the journal editor.
 *
 * The editor is intentionally minimal (CLAUDE.md > Rich Text): paragraphs,
 * bold, italic, bulleted lists, hard line breaks, and undo/redo history — and
 * nothing else. Every other StarterKit extension is disabled so the stored
 * document stays trivial to convert to plain text for search and embeddings.
 *
 * Kept: Document, Paragraph, Text, Bold, Italic, BulletList, ListItem,
 * HardBreak, History (undoRedo).
 */
export const editorExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    heading: false,
    horizontalRule: false,
    link: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
    underline: false,
  }),
];
