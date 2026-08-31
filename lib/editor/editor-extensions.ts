import { StarterKit } from "@tiptap/starter-kit";

/**
 * Tiptap configuration for the journal editor.
 *
 * The editor is intentionally minimal (CLAUDE.md > Rich Text): paragraphs,
 * bold, italic, bulleted and numbered lists, hard line breaks, and undo/redo
 * history — and nothing else. Every other StarterKit extension is disabled so
 * the stored document stays trivial to convert to plain text for search and
 * embeddings.
 *
 * Numbered lists are supported so an AI answer (Markdown `1.` lists) round-trips
 * into editor-native structure rather than leaking raw Markdown syntax
 * (task: "Fix AI-generated output formatting").
 *
 * Kept: Document, Paragraph, Text, Bold, Italic, BulletList, OrderedList,
 * ListItem, HardBreak, History (undoRedo).
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
    strike: false,
    trailingNode: false,
    underline: false,
  }),
];
