import { describe, expect, it } from "vitest";

import { toPlainDocument } from "@/lib/editor/plain-document";
import { journalContentSchema } from "@/lib/validation/journal";

describe("toPlainDocument", () => {
  it("rebuilds null-prototype node attrs as plain objects", () => {
    // What TipTap actually emits for a numbered list.
    const attrs = Object.create(null) as Record<string, unknown>;
    attrs.start = 1;
    attrs.type = null;
    const doc = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs,
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "step one" }] },
              ],
            },
          ],
        },
      ],
    };

    expect(Object.getPrototypeOf(doc.content[0].attrs)).toBeNull();

    const plain = toPlainDocument(doc);
    const orderedList = (plain.content ?? [])[0] as { attrs: object };

    expect(Object.getPrototypeOf(orderedList.attrs)).toBe(Object.prototype);
    expect(orderedList.attrs).toEqual({ start: 1, type: null });
  });

  it("produces a document the journal content schema accepts", () => {
    const attrs = Object.create(null) as Record<string, unknown>;
    attrs.start = 1;
    attrs.type = null;
    const doc = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs,
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "step one" }] },
              ],
            },
          ],
        },
      ],
    };

    expect(journalContentSchema.safeParse(toPlainDocument(doc)).success).toBe(true);
  });
});
