<script setup lang="ts">
// For developers: a dark band with the code itself, in windows, and a few
// floating chips (the API names people will remember).
const props = defineProps<{ block: { eyebrow?: string | null; heading: string; text?: string | null; files: { id: string; name: string; code: string }[]; chips?: string | null } }>()
const chips = computed(() => (props.block.chips ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6))
const tints = ['#FEBD3B', '#66CCC6', '#FE9B76', '#73C573', '#67B1F9', '#FD6D61']

// A tiny highlighter for TypeScript and Vue: comments, strings, tags, keywords, calls.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const TOKEN = /(\/\/[^\n]*|<!--[\s\S]*?-->)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w-]*|\/?>)|\b(import|from|export|const|let|await|async|return|if|else|default|true|false|null|new|function)\b|\b([A-Za-z_$][\w$]*)(?=\()/g
function highlight(code: string): string {
  let out = ''
  let last = 0
  for (const m of code.matchAll(TOKEN)) {
    out += esc(code.slice(last, m.index))
    const [all, comment, str, tag, kw, call] = m
    const cls = comment ? 'c' : str ? 's' : tag ? 't' : kw ? 'k' : call ? 'f' : ''
    out += `<span class="tk-${cls}">${esc(all)}</span>`
    last = m.index! + all.length
  }
  return out + esc(code.slice(last))
}
const files = computed(() => props.block.files.map((f) => ({ ...f, html: highlight(f.code) })))
</script>

<template>
  <section class="section relative overflow-hidden bg-night text-cream">
    <div class="code-glow" aria-hidden="true" />
    <div class="wrap relative">
      <div class="max-w-2xl">
        <p v-if="block.eyebrow" class="eyebrow !text-cream/60">{{ block.eyebrow }}</p>
        <h2 class="title mt-4 text-4xl sm:text-5xl">{{ block.heading }}</h2>
        <p v-if="block.text" class="lede mt-5 !text-cream/65 whitespace-pre-line">{{ block.text }}</p>
      </div>
      <div class="relative mt-14">
        <ul v-if="chips.length" class="code-chips" aria-hidden="true">
          <li v-for="(c, i) in chips" :key="c" :style="{ '--tint': tints[i % tints.length] }">{{ c }}</li>
        </ul>
        <div class="grid gap-5" :class="files.length > 1 ? 'lg:grid-cols-2' : ''">
          <figure v-for="f in files" :key="f.id" class="code-window">
            <figcaption class="code-bar"><i /><i /><i /><span>{{ f.name }}</span></figcaption>
            <!-- eslint-disable-next-line vue/no-v-html -- escaped above -->
            <pre class="code-body"><code v-html="f.html" /></pre>
          </figure>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
.code-glow { position: absolute; inset: auto -10% -40% -10%; height: 70%; background: radial-gradient(ellipse at 30% 50%, rgb(102 204 198 / 0.12), transparent 60%), radial-gradient(ellipse at 75% 40%, rgb(254 189 59 / 0.1), transparent 55%); pointer-events: none; }
.code-window { border-radius: 1rem; background: var(--color-night-2); box-shadow: 0 0 0 1px rgb(249 245 239 / 0.08), 0 30px 60px -30px rgb(0 0 0 / 0.7); overflow: hidden; position: relative; z-index: 1; }
.code-bar { display: flex; align-items: center; gap: 0.4rem; height: 2.5rem; padding: 0 1rem; border-bottom: 1px solid rgb(249 245 239 / 0.06); }
.code-bar i { width: 0.625rem; height: 0.625rem; border-radius: 999px; background: rgb(249 245 239 / 0.14); }
.code-bar span { margin-left: 0.5rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 0.78rem; color: rgb(249 245 239 / 0.55); }
.code-body { margin: 0; padding: 1.25rem 1.25rem 1.5rem; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.75; color: rgb(249 245 239 / 0.86); tab-size: 2; }
@media (min-width: 640px) { .code-body { font-size: 0.875rem; } }
.tk-c { color: rgb(249 245 239 / 0.62); font-style: italic; }
.tk-s { color: #9ADB9A; }
.tk-t { color: #7FD6D0; }
.tk-k { color: #FEA88A; }
.tk-f { color: #FECE6B; }
.code-chips li { position: absolute; z-index: 2; padding: 0.45rem 0.875rem; border-radius: 0.625rem; font-family: var(--font-mono); font-size: 0.8125rem; font-weight: 500; color: var(--color-ink); background: var(--tint); box-shadow: 0 14px 28px -14px rgb(0 0 0 / 0.6); white-space: nowrap; }
.code-chips li:nth-child(1) { top: -1.25rem; right: 8%; transform: rotate(4deg); }
.code-chips li:nth-child(2) { top: -1.2rem; right: 36%; transform: rotate(-5deg); }
.code-chips li:nth-child(3) { bottom: -1.1rem; left: 12%; transform: rotate(-3deg); }
.code-chips li:nth-child(4) { bottom: -1rem; right: 22%; transform: rotate(3deg); }
.code-chips li:nth-child(5) { top: -1.1rem; left: 30%; transform: rotate(-4deg); }
.code-chips li:nth-child(n+6) { display: none; }
@media (max-width: 1023px) { .code-chips { display: none; } }
</style>
