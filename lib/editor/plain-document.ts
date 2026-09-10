import type { JSONContent } from "@tiptap/core";

/**
 * Normalize a TipTap document to a plain-object structure before it crosses a
 * server-action boundary.
 *
 * TipTap emits some node attributes as **null-prototype** objects — most
 * visibly `orderedList`'s `{ start, type }`. Next.js Server Actions cannot
 * serialize a null-prototype object as data: it is sent as an opaque temporary
 * reference and arrives on the server as a *function*, which then fails
 * validation (`Invalid input: expected record, received function`).
 *
 * Round-tripping through JSON rebuilds every object with a normal prototype and
 * drops anything non-serializable, leaving exactly the plain document the rest
 * of the app (`extractPlainText`, embeddings, storage) already assumes.
 */
export function toPlainDocument(doc: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}
