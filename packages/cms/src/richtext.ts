import { z } from 'zod'

/**
 * Minimal ProseMirror/TipTap-style document. Stored as-is (permissive). XSS-unsafe
 * values (e.g. `javascript:` link hrefs, odd heading levels) are neutralized at RENDER
 * time by the CmsContent renderer — never render this doc with raw `v-html`.
 */
export type RichTextDoc = { type: 'doc'; content?: unknown[] }

export const richTextSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.any()).optional(),
}) as unknown as z.ZodType<RichTextDoc>

export const emptyDoc: RichTextDoc = { type: 'doc', content: [] }
