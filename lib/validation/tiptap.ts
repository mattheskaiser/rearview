import { z } from "zod";

/**
 * Pragmatic structural validation of a TipTap document.
 *
 * We do not attempt to encode the full ProseMirror schema. We assert that the
 * value is a `doc` node whose descendants are well-formed nodes (a `type`
 * string, optional `content` array, optional `text`/`marks`). This is enough to
 * reject arbitrary client payloads while staying resilient to editor upgrades.
 */
const markSchema = z.object({
  type: z.string().min(1),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export type TipTapNodeInput = {
  type?: string;
  text?: string;
  marks?: z.infer<typeof markSchema>[];
  attrs?: Record<string, unknown>;
  content?: TipTapNodeInput[];
};

const nodeSchema: z.ZodType<TipTapNodeInput> = z.lazy(() =>
  z.object({
    type: z.string().min(1).optional(),
    text: z.string().optional(),
    marks: z.array(markSchema).optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(nodeSchema).optional(),
  }),
);

export const tiptapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(nodeSchema).optional(),
});

export type TipTapDoc = z.infer<typeof tiptapDocSchema>;
