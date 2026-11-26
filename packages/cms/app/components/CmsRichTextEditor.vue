<script setup lang="ts">
import type { Ref } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { richTextExtensions } from '../../shared/richtext-editor'
import { isLinkRef } from '../../src/linkref'
import { cleanPastedHtml } from '../../shared/richtext-paste'
import type { CmsCollab } from '../composables/useCmsCollab'

// The rich-text editor itself (TipTap). The model IS the ProseMirror/TipTap JSON doc
// stored in the jsonb column — no conversion. Used by CmsFieldRichText, which picks
// the mode:
//  - alone: the editor holds the text, and the form's value fills it;
//  - shared (`collab` given): the text lives in the shared Yjs document that
//    everyone types into, with their cursors; the form's value only follows it.
const props = defineProps<{
  collab?: { doc: any; provider: any; field: string; user: { name: string; color: string }; readOnly: boolean } | null
  /** The field's name, for screen readers (the text area is a labelled textbox). */
  label?: string
  /** Or the id of the element that shows it. */
  labelledby?: string
  /** Translating: the default language's text, shown greyed behind the editor while it is empty. */
  fallback?: unknown
}>()
const model = defineModel<any>()
const libraryOpen = ref(false)
const { t } = useCmsI18n()
const toast = useToast()
const form = inject<{ quiet?: (fn: () => void) => void } | null>('cmsForm', null)
const shared = props.collab ? inject<CmsCollab | null>('cmsCollab', null) : null
// A page that opens read-only (the person may not save here) says so; typing is off.
const readOnly = inject<Ref<boolean> | null>('cmsReadOnly', null)
const inBuilderPanel = inject<boolean>('cmsInBuilderPanel', false)
const canType = () => !props.collab?.readOnly && !readOnly?.value
// What visitors see while this translation is empty: the default language's text, behind the editor.
const showFallback = computed(() => (props.fallback as any)?.type === 'doc' && !isEmptyRichText(props.fallback) && (model.value == null || isEmptyRichText(model.value)))

/**
 * Is this the same text as that? The editor fills in attribute defaults and adds an
 * empty paragraph after a last heading or list; text written elsewhere (an API client,
 * an older version) lacks both. That alone is no change — the form must not turn
 * "unsaved" just because the editor looked at the text.
 */
function sameDoc(ed: { schema: any }, a: unknown, b: unknown): boolean {
  const canon = (v: any) => {
    if (!v || typeof v !== 'object') return v
    try {
      return ed.schema.nodeFromJSON(v).toJSON()
    }
    catch {
      return v
    }
  }
  return sameRichText(canon(a), canon(b))
}

const editor = useEditor({
  // Shared: the content comes from the shared document, never from here.
  content: props.collab ? undefined : (model.value || { type: 'doc', content: [] }),
  editable: canType(),
  editorProps: {
    attributes: {
      role: 'textbox', 'aria-multiline': 'true',
      ...(props.labelledby ? { 'aria-labelledby': props.labelledby } : props.label ? { 'aria-label': props.label } : {}),
    },
    // Word's lists, tables and pictures on its owner's disk: made into what was meant
    // (real lists, a line per table row), pictures that cannot be shown left out — and said.
    transformPastedHTML: (html: string) => {
      const pasted = cleanPastedHtml(html)
      if (pasted.droppedImages) {
        toast.add({ title: t('fields.pasteImagesDropped'), description: t('fields.pasteImagesDroppedBody'), icon: 'i-lucide-image-off', color: 'warning' })
      }
      return pasted.html
    },
  },
  extensions: [
    ...richTextExtensions({ collaborative: !!props.collab }),
    ...(props.collab
      ? [
          Collaboration.configure({ document: props.collab.doc, field: props.collab.field }),
          CollaborationCaret.configure({ provider: props.collab.provider, user: props.collab.user }),
        ]
      : []),
  ],
  onUpdate: ({ editor, transaction }) => {
    const next = editor.getJSON()
    // Only real changes reach the form (an identical value would still mark it
    // dirty; empty text stays "no value", so a translation keeps falling back).
    if (sameDoc(editor, next, model.value)) return
    const value = isEmptyRichText(next) && (model.value === null || model.value === undefined) ? model.value : next
    // Someone else typing: the form follows, but it is not unsaved work of this tab.
    const remote = !!(transaction.getMeta(ySyncPluginKey) as any)?.isChangeOrigin
    if (remote && form?.quiet) form.quiet(() => { model.value = value })
    else model.value = value
  },
})

watch(() => readOnly?.value, () => editor.value?.setEditable(canType()))

watch(model, (val) => {
  const ed = editor.value
  if (!ed) return
  if (props.collab) {
    // The shared document is the truth: when the form loads another value (a newer
    // version, a merge), the form takes the shared text back instead of overwriting
    // what everyone is typing. Replacing it is an explicit choice (collab.set).
    if (!sameDoc(ed, val, ed.getJSON())) model.value = ed.getJSON()
    return
  }
  const next = val || { type: 'doc', content: [] }
  if (!sameDoc(ed, ed.getJSON(), next)) ed.commands.setContent(next, { emitUpdate: false })
})

// Shared: once the editor shows the shared text, the form takes it (it may hold
// changes not saved yet, typed by anyone).
if (props.collab) {
  const key = props.collab.field
  watch(editor, (ed) => {
    if (!ed) return
    const v = ed.getJSON()
    if (!sameDoc(ed, v, model.value)) model.value = v
    // This field is now shared on the page: merges leave it to the shared text, and
    // an explicit load or copy goes through here, to everyone.
    if (shared) {
      shared.setters.set(key, (value) => ed.commands.setContent(value || { type: 'doc', content: [] }))
      shared.mounted.value = new Set([...shared.mounted.value, key])
    }
  }, { once: true })
  onBeforeUnmount(() => {
    if (!shared) return
    shared.setters.delete(key)
    const next = new Set(shared.mounted.value)
    next.delete(key)
    shared.mounted.value = next
  })
}

onBeforeUnmount(() => editor.value?.destroy())

// Links: an in-app popover (a page of the site, or an address), never the browser's
// prompt. With no text selected, the picked page's title becomes the link text.
const linkOpen = ref(false)
const linkHref = ref<string | null>(null)
watch(linkOpen, (v) => {
  if (v) linkHref.value = (editor.value?.getAttributes('link').href as string | undefined) ?? null
})
function applyLink(href: string, title?: string) {
  const ed = editor.value
  linkOpen.value = false
  if (!ed) return
  const { empty } = ed.state.selection
  if (empty && !ed.isActive('link')) {
    ed.chain().focus().insertContent({ type: 'text', text: title || href, marks: [{ type: 'link', attrs: { href } }] }).run()
    return
  }
  ed.chain().focus().extendMarkRange('link').setLink({ href }).run()
}
function removeLink() {
  linkOpen.value = false
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
}

// Images go in after the selection (never over the selected text), and carry a
// description: the file's own, or one the editor writes now.
const altOpen = ref(false)
const altText = ref('')
let pending: { kind: 'insert'; media: any } | { kind: 'edit' } | null = null
const pendingIsInsert = ref(false)
function onImageSelect(m: any) {
  const alt = typeof m.alt === 'string' ? m.alt.trim() : ''
  if (alt) return insertImage(m, alt)
  pending = { kind: 'insert', media: m }
  pendingIsInsert.value = true
  altText.value = ''
  altOpen.value = true
}
function insertImage(m: any, alt: string) {
  const ed = editor.value
  if (!ed) return
  ed.chain().focus().setTextSelection(ed.state.selection.to).setImage({ src: m.url, alt, mediaId: m.id } as any).run()
}
// Closing the question (Esc, ×) still inserts the picked image, without a description.
watch(altOpen, (v) => { if (!v && pending) confirmAlt(true) })
function editAlt() {
  pending = { kind: 'edit' }
  pendingIsInsert.value = false
  altText.value = String(editor.value?.getAttributes('image').alt ?? '')
  altOpen.value = true
}
function confirmAlt(skip = false) {
  const alt = skip ? '' : altText.value.trim()
  const p = pending
  pending = null
  altOpen.value = false
  if (!p) return
  if (p.kind === 'insert') insertImage(p.media, alt)
  else editor.value?.chain().focus().updateAttributes('image', { alt }).run()
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
  ]
})
</script>

<template>
  <div class="cms-rte w-full overflow-hidden rounded-lg border border-default bg-default">
    <CmsMediaLibrary v-model:open="libraryOpen" accept="image/*" @select="onImageSelect" />
    <UModal v-model:open="altOpen" :title="t('link.imageAlt')" :description="t('link.imageAltHint')">
      <template #body>
        <form class="space-y-4" @submit.prevent="confirmAlt()">
          <UInput v-model="altText" :placeholder="t('link.imageAltPlaceholder')" class="w-full" autofocus :aria-label="t('link.imageAlt')" />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="confirmAlt(true)">{{ t('link.skip') }}</UButton>
            <UButton type="submit">{{ pendingIsInsert ? t('link.insert') : t('link.save') }}</UButton>
          </div>
        </form>
      </template>
    </UModal>
    <ClientOnly>
      <div v-if="editor && canType()" class="cms-rte__toolbar flex flex-wrap items-center gap-0.5 border-b border-default bg-elevated/30 p-1">
        <UButton
          v-for="tool in tools" :key="tool.icon"
          :icon="tool.icon" size="xs" variant="ghost"
          :color="tool.active() ? 'primary' : 'neutral'"
          :aria-label="tool.label" :aria-pressed="tool.active()" @click="tool.run()"
        />
        <UPopover v-model:open="linkOpen" :content="{ align: 'start' }">
          <UButton
            icon="i-lucide-link" size="xs" variant="ghost" :color="editor.isActive('link') ? 'primary' : 'neutral'"
            :aria-label="t('fields.toolbar.link')" :aria-pressed="editor.isActive('link')"
          />
          <template #content>
            <div v-if="linkHref" class="flex items-center gap-2 border-b border-default px-3 py-2">
              <CmsLinkTarget v-if="isLinkRef(linkHref)" :value="linkHref" class="flex-1" />
              <span v-else class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ linkHref }}</span>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-unlink" @click="removeLink">{{ t('link.remove') }}</UButton>
            </div>
            <CmsLinkPicker :initial="linkHref" @pick="applyLink" />
          </template>
        </UPopover>
        <UButton
          icon="i-lucide-image" size="xs" variant="ghost" color="neutral"
          :aria-label="t('fields.toolbar.image')" @click="() => { libraryOpen = true }"
        />
        <UButton
          v-if="editor.isActive('image')" icon="i-lucide-text-quote" size="xs" variant="ghost" color="neutral"
          :aria-label="t('fields.toolbar.imageAlt')" @click="editAlt"
        >{{ t('fields.toolbar.imageAlt') }}</UButton>
        <div class="ml-auto flex gap-0.5">
          <!-- in the builder's panel the preview's bar has an undo of its own: these say they undo the text only -->
          <UButton
            icon="i-lucide-undo-2" size="xs" variant="ghost" color="neutral" :aria-label="inBuilderPanel ? t('fields.toolbar.undoText') : t('fields.toolbar.undo')"
            :title="inBuilderPanel ? t('fields.toolbar.undoText') : undefined" @click="() => { editor?.chain().focus().undo().run() }"
          />
          <UButton
            icon="i-lucide-redo-2" size="xs" variant="ghost" color="neutral" :aria-label="inBuilderPanel ? t('fields.toolbar.redoText') : t('fields.toolbar.redo')"
            :title="inBuilderPanel ? t('fields.toolbar.redoText') : undefined" @click="() => { editor?.chain().focus().redo().run() }"
          />
        </div>
      </div>
      <div class="cms-rte__body" :class="showFallback ? 'cms-rte__body--fallback' : ''">
        <EditorContent :editor="editor" class="cms-prose cms-rte__editor" />
        <CmsContent v-if="showFallback" :doc="props.fallback as any" class="cms-prose cms-rte__fallback" aria-hidden="true" />
      </div>
      <template #fallback>
        <div class="min-h-32 px-3 py-2 text-sm text-muted">{{ t('fields.loadingEditor') }}</div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.ProseMirror) { min-height: 10rem; padding: 0.75rem 1rem; outline: none; }
/* Translating an empty text: the original greyed in the same place, under the editor (which stays on top
   and takes the clicks); the box grows to the original's height. */
.cms-rte__body { display: grid; }
.cms-rte__body > * { grid-area: 1 / 1; min-width: 0; }
.cms-rte__body--fallback .cms-rte__editor { position: relative; z-index: 1; display: flex; flex-direction: column; }
.cms-rte__body--fallback .cms-rte__editor :deep(.ProseMirror) { flex: 1; }
/* The original's blocks spaced as the editor spaces its own. */
.cms-rte__fallback :deep(> * + *) { margin-top: 0.5rem; }
.cms-rte__fallback :deep(h2) { font-size: 1.25rem; font-weight: 600; line-height: 1.3; margin-top: 1rem; }
.cms-rte__fallback :deep(h3) { font-size: 1.0625rem; font-weight: 600; line-height: 1.35; margin-top: 0.75rem; }
.cms-rte__fallback :deep(ul) { list-style: disc; padding-left: 1.5rem; }
.cms-rte__fallback :deep(ol) { list-style: decimal; padding-left: 1.5rem; }
.cms-rte__fallback { padding: 0.75rem 1rem; color: var(--ui-text-dimmed); pointer-events: none; user-select: none; overflow: hidden; }
.cms-rte__fallback :deep(*) { color: inherit !important; }
.cms-rte__fallback :deep(img) { opacity: 0.4; }
:deep(.ProseMirror > * + *) { margin-top: 0.5rem; }
:deep(.ProseMirror h2) { font-size: 1.25rem; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; margin-top: 1rem; }
:deep(.ProseMirror h3) { font-size: 1.0625rem; font-weight: 600; line-height: 1.35; margin-top: 0.75rem; }
:deep(.ProseMirror ul) { list-style: disc; padding-left: 1.5rem; }
:deep(.ProseMirror ol) { list-style: decimal; padding-left: 1.5rem; }
:deep(.ProseMirror blockquote) { font-style: italic; opacity: 0.85; padding-left: 1.25rem; }
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
