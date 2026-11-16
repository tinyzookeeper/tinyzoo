// How an admin form is grouped, and which fields wait behind "+ Add …".
//
// A form reads as a few titled sections ("When?", "Where?") instead of one long
// column. The developer names them in `admin.sections`; without that, fields are
// grouped by kind once a form has enough of them to need it. Fields with `.group()`
// (e.g. "Search & sharing") fold away at the end.

export interface CmsFormFieldLike { key: string; type: string; optional?: boolean; meta?: Record<string, any> }
export interface CmsSectionConfig { label: unknown; icon?: string; description?: unknown; fields: string[]; columns?: 1 | 2 }

/** The kinds a field is grouped by when no sections are configured. */
export type CmsSectionKind = 'basics' | 'content' | 'when' | 'pictures' | 'links' | 'related'
const KIND_ORDER: CmsSectionKind[] = ['basics', 'content', 'when', 'pictures', 'links', 'related']
export const CMS_SECTION_ICONS: Record<CmsSectionKind, string> = {
  basics: 'i-lucide-pencil-line',
  content: 'i-lucide-align-left',
  when: 'i-lucide-calendar',
  pictures: 'i-lucide-image',
  links: 'i-lucide-link',
  related: 'i-lucide-layers',
}

export interface CmsFormSectionView<F extends CmsFormFieldLike = CmsFormFieldLike> {
  id: string
  /** The configured heading; null with `kind` = a heading named after the kind; both null = no heading. */
  label: unknown | null
  kind: CmsSectionKind | null
  icon: string | null
  description: unknown | null
  fields: F[]
  columns: 1 | 2
  /** A `.group()` of fields: folded away at the end of the form. */
  folded: boolean
}

export function cmsSectionKind(f: CmsFormFieldLike): CmsSectionKind {
  if (f.type === 'datetime') return 'when'
  if (f.type === 'media' || f.type === 'gallery') return 'pictures'
  if (f.type === 'relation') return 'related'
  if (f.type === 'richtext' || f.type === 'blocks') return 'content'
  if (f.type === 'text' && ['url', 'link', 'email'].includes(f.meta?.format)) return 'links'
  return 'basics'
}

/** Below this many fields a form is short enough to need no headings. */
const AUTO_MIN_FIELDS = 6

/**
 * The sections of a form, in order: the configured ones (fields they list that are
 * not in this form are skipped), then the rest grouped by kind, then the folded groups.
 */
export function cmsFormSections<F extends CmsFormFieldLike>(fields: F[], config?: CmsSectionConfig[] | null): CmsFormSectionView<F>[] {
  const open = fields.filter((f) => !f.meta?.group)
  const byKey = new Map(open.map((f) => [f.key, f]))
  const out: CmsFormSectionView<F>[] = []
  const placed = new Set<string>()

  for (const [i, s] of (config ?? []).entries()) {
    const own = s.fields.map((k) => byKey.get(k)).filter((f): f is F => !!f)
    own.forEach((f) => placed.add(f.key))
    if (!own.length) continue
    out.push({
      id: `s${i}`, label: s.label, kind: null, icon: s.icon ?? CMS_SECTION_ICONS[cmsSectionKind(own[0]!)],
      description: s.description ?? null, fields: own, columns: s.columns ?? 1, folded: false,
    })
  }

  const rest = open.filter((f) => !placed.has(f.key))
  if (rest.length) {
    const titled = out.length > 0 || rest.length >= AUTO_MIN_FIELDS
    const buckets = new Map<CmsSectionKind, F[]>()
    for (const f of rest) {
      const k = titled ? cmsSectionKind(f) : 'basics'
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k)!.push(f)
    }
    const kinds = KIND_ORDER.filter((k) => buckets.has(k))
    const headed = titled && (out.length > 0 || kinds.length > 1)
    for (const k of kinds) {
      out.push({
        id: `k-${k}`, label: null, kind: headed ? k : null, icon: headed ? CMS_SECTION_ICONS[k] : null,
        description: null, fields: buckets.get(k)!, columns: 1, folded: false,
      })
    }
  }

  const groups = new Map<string, F[]>()
  for (const f of fields) {
    if (!f.meta?.group) continue
    const id = JSON.stringify(f.meta.group)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id)!.push(f)
  }
  let g = 0
  for (const own of groups.values()) {
    out.push({
      id: `g${g++}`, label: own[0]!.meta!.group, kind: null, icon: 'i-lucide-sliders-horizontal',
      description: null, fields: own, columns: 1, folded: true,
    })
  }
  return out
}

/** The sections are many enough for a section menu beside the form. */
export function cmsNeedsSectionMenu(sections: CmsFormSectionView[]): boolean {
  const headed = sections.filter((s) => s.label != null || s.kind != null)
  return headed.length >= 4 && sections.reduce((n, s) => n + s.fields.length, 0) >= 10
}

export const cmsIsEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

// Never put behind "+ Add": a switch always has a value, and text bodies are the content.
const ALWAYS_SHOWN = new Set(['boolean', 'richtext', 'blocks'])

/**
 * The fields of a section that wait behind "+ Add …": optional, still empty, never
 * filled in this visit and without an error. A section always shows at least one field.
 */
export function cmsWaitingFields(
  section: { fields: CmsFormFieldLike[] },
  state: Record<string, unknown>,
  seen: Set<string>,
  errors: Record<string, unknown> = {},
): string[] {
  const waiting = section.fields.filter((f) =>
    f.optional && !ALWAYS_SHOWN.has(f.type) && cmsIsEmpty(state[f.key]) && !seen.has(f.key) && !errors[f.key])
  if (waiting.length === section.fields.length) waiting.shift()
  return waiting.map((f) => f.key)
}

/** A field that fits half a row in a two-column section. */
export function cmsIsShortField(f: CmsFormFieldLike): boolean {
  if (f.type === 'text') return !f.meta?.multiline
  return f.type === 'number' || f.type === 'slug' || (f.type === 'relation' && f.meta?.kind !== 'many-to-many')
}

/** The icon inside a field's control: the developer's, else one for the kind of value. */
export function cmsFieldIcon(f: CmsFormFieldLike): string | undefined {
  if (f.meta?.icon) return f.meta.icon
  if (f.type === 'datetime') return 'i-lucide-calendar'
  if (f.type === 'relation') return 'i-lucide-search'
  if (f.type === 'text') {
    const format = f.meta?.format
    if (format === 'email') return 'i-lucide-mail'
    if (format === 'url' || format === 'link') return 'i-lucide-link'
    if (format === 'path') return 'i-lucide-corner-down-right'
  }
  return undefined
}

/** A choice of a few options shows as buttons in the content column, a dropdown elsewhere. */
export function cmsSelectAsButtons(f: CmsFormFieldLike, placement: 'main' | 'sidebar' = 'main'): boolean {
  return f.type === 'select' && placement === 'main' && ((f.meta?.options as unknown[] | undefined)?.length ?? 0) <= 5
}
