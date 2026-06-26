import { z } from 'zod'

/**
 * Minimal ProseMirror/TipTap-style document. Kept permissive on read; the server
 * sanitizes on write (XSS) — see CRUD create/update handlers.
 */
export type RichTextDoc = { type: 'doc'; content?: unknown[] }

export const richTextSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.any()).optional(),
}) as unknown as z.ZodType<RichTextDoc>

export const emptyDoc: RichTextDoc = { type: 'doc', content: [] }
