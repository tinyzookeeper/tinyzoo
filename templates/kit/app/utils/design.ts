// A design as the website uses it at run time: one template's words, looks, blocks and look
// parts. The kit's module writes one module per design (`#build/tz/design-<id>.mjs`) that calls
// `defineDesign`; app/plugins/design.ts loads the one the site is drawn in and `useDesign()`
// gives it to the kit's pages, layout and components.
import { defineAsyncComponent, type Component } from 'vue'
import type { LookDef, Looks } from '../../looks'
import type { EntryPage } from './blocks'
import type { KitWords } from './kitWords'

type Loader = () => Promise<{ default: Component } | Component>

export interface DesignDef {
  /** The template's id, which is also the name of its content model: `photographer`. */
  id: string
  /** What <CmsBlocks> puts before a block's type: `Block` in a template's own build, `PhotographerBlock` in the one app. */
  blockPrefix: string
  /** The template's app/utils/site.ts. */
  site: { DEFAULT_LANGUAGE: string; ENTRY_PAGES: EntryPage[]; wordsOf: (code: string) => KitWords }
  looks: Looks<LookDef>
  /** The template's own LookEntry (app/components/LookEntry.vue), in the one app only: in its own build Nuxt finds it. */
  entry?: Loader
  /** Every part of every look, by `<look>/<part>`, each loaded on its own. */
  parts: Record<string, Loader>
  /** Each look's stylesheet, by look id: in the one app only (a template's own build has them all in its main.css). */
  css: Record<string, string>
}

export function defineDesign(def: DesignDef) {
  const loaded = new Map<string, Component>()
  const pending = new Map<string, Promise<Component | null>>()
  return {
    ...def,
    /** The design's own LookEntry, or null for the kit's. */
    entry: def.entry ? defineAsyncComponent(def.entry as () => Promise<Component>) : null,
    /**
     * A part of a look, loaded once per process (the server) or page (the browser); null when
     * the look has no such part. Component definitions hold no request's state, so the server
     * keeps them for every request.
     */
    loadPart(look: string, part: string): Promise<Component | null> {
      const key = `${look}/${part}`
      const have = loaded.get(key)
      if (have) return Promise.resolve(have)
      const load = def.parts[key]
      if (!load) return Promise.resolve(null)
      let promise = pending.get(key)
      if (!promise) {
        promise = load().then((m) => {
          const component = ((m as { default?: Component }).default ?? m) as Component
          loaded.set(key, component)
          return component
        })
        // A failed load (a lost connection in the browser) is tried again next time.
        promise.catch(() => pending.delete(key))
        pending.set(key, promise)
      }
      return promise
    },
  }
}

export type Design = ReturnType<typeof defineDesign>
