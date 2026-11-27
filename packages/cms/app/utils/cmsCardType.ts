import type { CardType, CardTypeField } from '../../shared/builder-card'
import type { CmsBindingField } from './cmsBinding'
import { cmsBindingTypes } from './cmsBinding'
import { cmsRefFields } from './cmsFieldRef'

// The content type a card shows, as the admin graph describes it (the pure part of useCmsCardType): its
// fields with a kind and a label in the admin's language, the choices of a select, its names and icon, and
// the address its pages have (read from the type's preview address, `/<prefix>/:slug`).

/** What the panel says about the type itself. */
export interface CmsCardTypeMeta { label: string; labelSingular: string; icon: string; pagePrefix: string | null }
type Resolve = (text: any, fallback?: string) => string

/** The prefix of a type's pages from its preview addresses per language (the shortest one has no language in front), or null when it has no pages. */
export function cmsPagePrefix(previewPaths: unknown): string | null {
  if (!previewPaths || typeof previewPaths !== 'object') return null
  const all = Object.values(previewPaths as Record<string, unknown>).filter((p): p is string => typeof p === 'string')
  const shortest = all.sort((a, b) => a.length - b.length)[0]
  const match = shortest?.match(/^\/(.+)\/:slug\/?$/)
  return match?.[1] ?? null
}

/** The type and what is said about it; null when the graph has no such type of the site's own. */
export function cmsCardTypeOf(graph: readonly any[] | null | undefined, name: string | null | undefined, tl: Resolve, pageLabel: string): { type: CardType; meta: CmsCardTypeMeta } | null {
  if (!name) return null
  const found = cmsBindingTypes(graph).find((x) => x.name === name)
  if (!found) return null
  const entity = (Array.isArray(graph) ? graph : []).find((e) => e?.name === name)
  const raw = new Map<string, CmsBindingField>(found.fields.map((f) => [f.key, f]))
  const fields: CardTypeField[] = cmsRefFields(found).map((f) => {
    const out: CardTypeField = { key: f.key, kind: f.kind, label: f.kind === 'page' ? pageLabel : tl(f.label as any, f.key) }
    const meta = raw.get(f.key)?.meta ?? {}
    if (f.kind === 'choice' && Array.isArray(meta.options)) {
      out.choices = Object.fromEntries(meta.options.map((o: unknown) => [String(o), tl(meta.labels?.[String(o)], String(o))]))
    }
    return out
  })
  const label = tl(found.label, name)
  return {
    type: { name, titleField: found.titleField, fields },
    meta: {
      label,
      labelSingular: tl(entity?.labelSingular ?? found.label, label),
      icon: typeof entity?.icon === 'string' && entity.icon ? entity.icon : 'i-lucide-folder',
      pagePrefix: cmsPagePrefix(entity?.previewPaths),
    },
  }
}
