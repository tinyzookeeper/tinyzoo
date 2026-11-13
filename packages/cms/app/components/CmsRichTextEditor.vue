<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { richTextExtensions } from '../../shared/richtext-editor'

// The rich-text editor itself (TipTap). The model IS the ProseMirror/TipTap JSON doc
// stored in the jsonb column — no conversion. Used by CmsFieldRichText, which picks
// the mode:
//  - alone: the editor holds the text, and the form's value fills it;
//  - shared (`collab` given): the text lives in the shared Yjs document that
//    everyone types into, with their cursors; the form's value only follows it.
const props = defineProps<{
  collab?: { doc: any; provider: any; field: string; user: { name: string; color: string }; readOnly: boolean } | null
}>()
const model = defineModel<any>()
const libraryOpen = ref(false)
const { t } = useCmsI18n()
const json = stableJson

const editor = useEditor({
  // Shared: the content comes from the shared document, never from here.
  content: props.collab ? undefined : (model.value || { type: 'doc', content: [] }),
  editable: !props.collab?.readOnly,
  extensions: [
    ...richTextExtensions({ collaborative: !!props.collab }),
    ...(props.collab
      ? [
          Collaboration.configure({ document: props.collab.doc, field: props.collab.field }),
          CollaborationCaret.configure({ provider: props.collab.provider, user: props.collab.user }),
        ]
      : []),
  ],
  onUpdate: ({ editor }) => {
    const next = editor.getJSON()
    // Only real changes reach the form (an identical value would still mark it dirty).
    if (json(next) !== json(model.value)) model.value = next
  },
})

watch(model, (val) => {
  const ed = editor.value
  if (!ed) return
  if (props.collab) {
    // The shared document is the truth: when the form loads another value (a newer
    // version, a merge), the form takes the shared text back instead of overwriting
    // what everyone is typing.
    if (json(val) !== json(ed.getJSON())) model.value = ed.getJSON()
    return
  }
  const next = val || { type: 'doc', content: [] }
  if (json(ed.getJSON()) !== json(next)) ed.commands.setContent(next, { emitUpdate: false })
})

// Shared: once the editor shows the shared text, the form takes it (it may hold
// changes not saved yet, typed by anyone).
if (props.collab) {
  watch(editor, (ed) => {
    if (!ed) return
    const v = ed.getJSON()
    if (json(v) !== json(model.value)) model.value = v
  }, { once: true })
}

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
      <div v-if="editor && !collab?.readOnly" class="flex flex-wrap items-center gap-0.5 border-b border-default bg-elevated/30 p-1">
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
:deep(.ProseMirror h2) { font-size: 1.25rem; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; margin-top: 1rem; }
:deep(.ProseMirror h3) { font-size: 1.0625rem; font-weight: 600; line-height: 1.35; margin-top: 0.75rem; }
:deep(.ProseMirror ul) { list-style: disc; padding-left: 1.5rem; }
:deep(.ProseMirror ol) { list-style: decimal; padding-left: 1.5rem; }
:deep(.ProseMirror blockquote) { border-left: 3px solid currentColor; opacity: 0.85; padding-left: 0.75rem; }
:deep(.ProseMirror code) { font-family: ui-monospace, monospace; background: rgb(127 127 127 / 0.15); padding: 0.1em 0.3em; border-radius: 0.25rem; font-size: 0.9em; }
:deep(.ProseMirror pre) { background: rgb(127 127 127 / 0.12); padding: 0.5rem 0.75rem; border-radius: 0.375rem; overflow-x: auto; }
:deep(.ProseMirror pre code) { background: none; padding: 0; }
:deep(.ProseMirror a) { color: var(--ui-primary, currentColor); text-decoration: underline; }
:deep(.ProseMirror img) { max-width: 100%; height: auto; border-radius: 0.375rem; }
:deep(.ProseMirror img.ProseMirror-selectednode) { outline: 2px solid var(--ui-primary, currentColor); }
/* Other people's cursors in shared text: a thin line in their colour, their name above. */
:deep(.collaboration-carets__caret) { position: relative; margin-left: -1px; margin-right: -1px; border-left: 1px solid; border-right: 1px solid; word-break: normal; pointer-events: none; }
:deep(.collaboration-carets__label) { position: absolute; top: -1.4em; left: -1px; padding: 0.05rem 0.3rem; border-radius: 0.25rem 0.25rem 0.25rem 0; font-size: 0.6875rem; font-weight: 500; line-height: 1.3; color: #fff; white-space: nowrap; user-select: none; }
</style>
