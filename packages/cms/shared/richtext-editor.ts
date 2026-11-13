import { getSchema, type AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

/**
 * The rich-text editor's extensions, shared by the browser (the editor) and the
 * server (shared editing builds documents with exactly the same schema).
 */

// Image node that also records the cms_media id (as data-media-id) so the media GC
// can see images embedded in body text and never orphans them.
export const MediaImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el: { getAttribute: (name: string) => string | null }) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: Record<string, any>) => (attrs.mediaId ? { 'data-media-id': attrs.mediaId } : {}),
      },
    }
  },
})

// Links render with fixed target/rel and never with a class: shared text arrives from
// other people's browsers, and a crafted class (e.g. a full-screen overlay) or target
// must not reach the page. Same attributes, so stored JSON keeps its shape.
export const SafeLink = Link.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      target: { default: '_blank', parseHTML: () => '_blank', renderHTML: () => ({ target: '_blank' }) },
      rel: { default: 'noopener noreferrer', parseHTML: () => 'noopener noreferrer', renderHTML: () => ({ rel: 'noopener noreferrer' }) },
      class: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
    }
  },
})

export function richTextExtensions(opts: { collaborative?: boolean } = {}): AnyExtension[] {
  return [
    // StarterKit v3 bundles Link (configured below) and an undo history, which shared
    // editing replaces with its own (per person, not per document).
    StarterKit.configure({ link: false, ...(opts.collaborative ? { undoRedo: false } : {}) }),
    SafeLink.configure({ openOnClick: false, autolink: true }),
    MediaImage.configure({ HTMLAttributes: { class: 'cms-embed-img' } }),
  ]
}

let schema: ReturnType<typeof getSchema> | undefined
/** The ProseMirror schema of stored rich text. */
export function editorSchema() {
  return (schema ??= getSchema(richTextExtensions()))
}
