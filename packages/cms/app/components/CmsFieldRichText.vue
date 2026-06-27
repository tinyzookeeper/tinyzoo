<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

// Built-in rich-text editor (TipTap). The model IS the ProseMirror/TipTap JSON doc
// stored in the jsonb column — no conversion. Swap it out per host by registering
// `cms.fields.richtext.edit` in app.config.
const model = defineModel<any>()

const editor = useEditor({
  content: model.value || { type: 'doc', content: [] },
  immediatelyRender: false, // SSR-safe: defer view creation to the client
  extensions: [StarterKit],
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

type Tool = { icon: string; label: string; run: () => void; active: () => boolean }
const tools = computed<Tool[]>(() => {
  const ed = editor.value
  if (!ed) return []
  const chain = () => ed.chain().focus()
  return [
    { icon: 'i-lucide-bold', label: 'Bold', run: () => chain().toggleBold().run(), active: () => ed.isActive('bold') },
    { icon: 'i-lucide-italic', label: 'Italic', run: () => chain().toggleItalic().run(), active: () => ed.isActive('italic') },
    { icon: 'i-lucide-strikethrough', label: 'Strike', run: () => chain().toggleStrike().run(), active: () => ed.isActive('strike') },
    { icon: 'i-lucide-heading-2', label: 'Heading 2', run: () => chain().toggleHeading({ level: 2 }).run(), active: () => ed.isActive('heading', { level: 2 }) },
    { icon: 'i-lucide-heading-3', label: 'Heading 3', run: () => chain().toggleHeading({ level: 3 }).run(), active: () => ed.isActive('heading', { level: 3 }) },
    { icon: 'i-lucide-list', label: 'Bullet list', run: () => chain().toggleBulletList().run(), active: () => ed.isActive('bulletList') },
    { icon: 'i-lucide-list-ordered', label: 'Ordered list', run: () => chain().toggleOrderedList().run(), active: () => ed.isActive('orderedList') },
    { icon: 'i-lucide-quote', label: 'Quote', run: () => chain().toggleBlockquote().run(), active: () => ed.isActive('blockquote') },
    { icon: 'i-lucide-code', label: 'Inline code', run: () => chain().toggleCode().run(), active: () => ed.isActive('code') },
  ]
})
</script>

<template>
  <div class="w-full overflow-hidden rounded-lg border border-default bg-default">
    <ClientOnly>
      <div v-if="editor" class="flex flex-wrap items-center gap-0.5 border-b border-default bg-elevated/30 p-1">
        <UButton
          v-for="t in tools" :key="t.label"
          :icon="t.icon" size="xs" variant="ghost"
          :color="t.active() ? 'primary' : 'neutral'"
          :aria-label="t.label" @click="t.run()"
        />
        <div class="ml-auto flex gap-0.5">
          <UButton icon="i-lucide-undo-2" size="xs" variant="ghost" color="neutral" aria-label="Undo" @click="editor.chain().focus().undo().run()" />
          <UButton icon="i-lucide-redo-2" size="xs" variant="ghost" color="neutral" aria-label="Redo" @click="editor.chain().focus().redo().run()" />
        </div>
      </div>
      <EditorContent :editor="editor" />
      <template #fallback>
        <div class="min-h-32 px-3 py-2 text-sm text-muted">Loading editor…</div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.ProseMirror) { min-height: 8rem; padding: 0.5rem 0.75rem; outline: none; }
:deep(.ProseMirror > * + *) { margin-top: 0.5rem; }
:deep(.ProseMirror h2) { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
:deep(.ProseMirror h3) { font-size: 1.125rem; font-weight: 600; line-height: 1.3; }
:deep(.ProseMirror ul) { list-style: disc; padding-left: 1.5rem; }
:deep(.ProseMirror ol) { list-style: decimal; padding-left: 1.5rem; }
:deep(.ProseMirror blockquote) { border-left: 3px solid currentColor; opacity: 0.85; padding-left: 0.75rem; }
:deep(.ProseMirror code) { font-family: ui-monospace, monospace; background: rgb(127 127 127 / 0.15); padding: 0.1em 0.3em; border-radius: 0.25rem; font-size: 0.9em; }
:deep(.ProseMirror pre) { background: rgb(127 127 127 / 0.12); padding: 0.5rem 0.75rem; border-radius: 0.375rem; overflow-x: auto; }
:deep(.ProseMirror pre code) { background: none; padding: 0; }
</style>
