<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

// Built-in rich-text editor (TipTap). The model IS the ProseMirror/TipTap JSON doc
// stored in the jsonb column — no conversion. Swap it out per host by registering
// `cms.fields.richtext.edit` in app.config.
const model = defineModel<any>()
const libraryOpen = ref(false)
const { t } = useCmsI18n()

// Image node that also records the cms_media id (as data-media-id) so the media GC
// can see images embedded in body text and never orphans them.
const MediaImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: Record<string, any>) => (attrs.mediaId ? { 'data-media-id': attrs.mediaId } : {}),
      },
    }
  },
})

const editor = useEditor({
  content: model.value || { type: 'doc', content: [] },
  extensions: [
    // StarterKit v3 bundles Link; ours is configured below, so turn the bundled one off.
    StarterKit.configure({ link: false }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    MediaImage.configure({ HTMLAttributes: { class: 'cms-embed-img' } }),
  ],
  onUpdate: ({ editor }) => {
    model.value = editor.getJSON()
  },
})

// Reflect external model changes (async form load / reset) into the editor.
watch(model, (val) => {
  const ed = editor.value
  if (!ed) return
  const next = val || { type: 'doc', content: [] }
  if (JSON.stringify(ed.getJSON()) !== JSON.stringify(next)) {
    ed.commands.setContent(next, { emitUpdate: false })
  }
})

onBeforeUnmount(() => editor.value?.destroy())

function setLink() {
  const ed = editor.value
  if (!ed) return
  const prev = ed.getAttributes('link').href as string | undefined
  const url = window.prompt(t('fields.linkPrompt'), prev ?? 'https://')
  if (url === null) return // cancelled
  if (url.trim() === '') {
    ed.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  ed.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

function onImageSelect(m: any) {
  editor.value?.chain().focus().setImage({ src: m.url, alt: m.alt ?? '', mediaId: m.id } as any).run()
}

type Tool = { icon: string, label: string, run: () => void, active: () => boolean }
const tools = computed<Tool[]>(() => {
  const ed = editor.value
  if (!ed) return []
  const chain = () => ed.chain().focus()
  return [
    { icon: 'i-lucide-bold', label: t('fields.toolbar.bold'), run: () => chain().toggleBold().run(), active: () => ed.isActive('bold') },
    { icon: 'i-lucide-italic', label: t('fields.toolbar.italic'), run: () => chain().toggleItalic().run(), active: () => ed.isActive('italic') },
    { icon: 'i-lucide-strikethrough', label: t('fields.toolbar.strike'), run: () => chain().toggleStrike().run(), active: () => ed.isActive('strike') },
    { icon: 'i-lucide-heading-2', label: t('fields.toolbar.h2'), run: () => chain().toggleHeading({ level: 2 }).run(), active: () => ed.isActive('heading', { level: 2 }) },
    { icon: 'i-lucide-heading-3', label: t('fields.toolbar.h3'), run: () => chain().toggleHeading({ level: 3 }).run(), active: () => ed.isActive('heading', { level: 3 }) },
    { icon: 'i-lucide-list', label: t('fields.toolbar.bulletList'), run: () => chain().toggleBulletList().run(), active: () => ed.isActive('bulletList') },
    { icon: 'i-lucide-list-ordered', label: t('fields.toolbar.orderedList'), run: () => chain().toggleOrderedList().run(), active: () => ed.isActive('orderedList') },
    { icon: 'i-lucide-quote', label: t('fields.toolbar.quote'), run: () => chain().toggleBlockquote().run(), active: () => ed.isActive('blockquote') },
    { icon: 'i-lucide-code', label: t('fields.toolbar.code'), run: () => chain().toggleCode().run(), active: () => ed.isActive('code') },
    { icon: 'i-lucide-link', label: t('fields.toolbar.link'), run: setLink, active: () => ed.isActive('link') },
  ]
})
</script>

<template>
  <div class="w-full overflow-hidden rounded-lg border border-default bg-default">
    <CmsMediaLibrary v-model:open="libraryOpen" accept="image/*" @select="onImageSelect" />
    <ClientOnly>
      <div v-if="editor" class="flex flex-wrap items-center gap-0.5 border-b border-default bg-elevated/30 p-1">
        <UButton
          v-for="tool in tools" :key="tool.icon"
          :icon="tool.icon" size="xs" variant="ghost"
          :color="tool.active() ? 'primary' : 'neutral'"
          :aria-label="tool.label" :aria-pressed="tool.active()" @click="tool.run()"
        />
        <UButton
          icon="i-lucide-image" size="xs" variant="ghost" color="neutral"
          :aria-label="t('fields.toolbar.image')" @click="libraryOpen = true"
        />
        <div class="ml-auto flex gap-0.5">
          <UButton icon="i-lucide-undo-2" size="xs" variant="ghost" color="neutral" :aria-label="t('fields.toolbar.undo')" @click="editor.chain().focus().undo().run()" />
          <UButton icon="i-lucide-redo-2" size="xs" variant="ghost" color="neutral" :aria-label="t('fields.toolbar.redo')" @click="editor.chain().focus().redo().run()" />
        </div>
      </div>
      <EditorContent :editor="editor" class="cms-prose" />
      <template #fallback>
        <div class="min-h-32 px-3 py-2 text-sm text-muted">{{ t('fields.loadingEditor') }}</div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.ProseMirror) { min-height: 10rem; padding: 0.75rem 1rem; outline: none; }
:deep(.ProseMirror > * + *) { margin-top: 0.5rem; }
:deep(.ProseMirror h2) { font-size: 1.5rem; font-weight: 500; line-height: 1.25; margin-top: 1rem; }
:deep(.ProseMirror h3) { font-size: 1.25rem; font-weight: 500; line-height: 1.3; margin-top: 0.75rem; }
:deep(.ProseMirror ul) { list-style: disc; padding-left: 1.5rem; }
:deep(.ProseMirror ol) { list-style: decimal; padding-left: 1.5rem; }
:deep(.ProseMirror blockquote) { border-left: 3px solid currentColor; opacity: 0.85; padding-left: 0.75rem; }
:deep(.ProseMirror code) { font-family: ui-monospace, monospace; background: rgb(127 127 127 / 0.15); padding: 0.1em 0.3em; border-radius: 0.25rem; font-size: 0.9em; }
:deep(.ProseMirror pre) { background: rgb(127 127 127 / 0.12); padding: 0.5rem 0.75rem; border-radius: 0.375rem; overflow-x: auto; }
:deep(.ProseMirror pre code) { background: none; padding: 0; }
:deep(.ProseMirror a) { color: var(--ui-primary, currentColor); text-decoration: underline; }
:deep(.ProseMirror img) { max-width: 100%; height: auto; border-radius: 0.375rem; }
:deep(.ProseMirror img.ProseMirror-selectednode) { outline: 2px solid var(--ui-primary, currentColor); }
</style>
