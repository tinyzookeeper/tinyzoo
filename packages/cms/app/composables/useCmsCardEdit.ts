import { cardBindingFieldOf, cardDropUnbound, cardItemsIn, cardRedesign, cardSectionUnbound, cardTypeChange, type CardType } from '../../shared/builder-card'
import { cmsBindingRead } from '../utils/cmsBinding'
import { cmsCardTypeOf } from '../utils/cmsCardType'

// What the owner of a card section does when the card changes under it (editor in the preview, part 3c):
// the section's type is changed (the card is remapped, or designed anew when empty, in ONE step), the
// blocks that show nothing are removed, the card is designed again. The owner is whoever holds the
// section's value: the focus panel (`owner.patch`) or the form's list (one `update`); it passes in how
// to write several keys of the section at once, and how to say something with an *Undo*. Nothing here
// writes by itself, and nothing throws on a block of an odd shape.

export interface CmsCardOwner {
  /** Write these keys of the section in one step of the history; returns the step. */
  apply: (values: Record<string, unknown>) => number | null
  /** An *Undo* for the step (the history's, only while it is still the last one). */
  undo: (step: number | null) => () => void
  /** A notice with an *Undo* (a toast). */
  notify: (message: { title: string; icon: string; actions: { label: string; color: 'neutral'; variant: 'outline'; onClick: () => void }[] }) => void
}

/** The language of the values a design fixes: the page's own, else the content's default, else the admin's. */
export function useCmsContentLang(entity: () => string | undefined) {
  const builder = useCmsBuilder()
  const { locale } = useCmsI18n()
  const { data: graph } = useNuxtData<any[]>('cms-graph')
  return computed<string>(() => builder.value?.locale.value
    ?? graph.value?.find((e) => e?.name === entity())?.locales?.default
    ?? locale.value)
}

export function useCmsCardEdit(lang: () => string) {
  const { t, tl } = useCmsI18n()
  const { data: graph } = useNuxtData<any[]>('cms-graph')
  const typeOf = (name: string | null | undefined) => cmsCardTypeOf(graph.value, name, tl, t('fieldRef.page'))

  /** The type a section shows now (null: none, or one the site no longer has). */
  const typeOfSection = (section: unknown, def: any): CardType | null => {
    const key = cardBindingFieldOf(def)?.key
    return key && section ? typeOf(cmsBindingRead((section as any)[key])?.type)?.type ?? null : null
  }
  const unboundOf = (section: unknown, def: any): string[] => cardSectionUnbound(section, def, typeOfSection(section, def))

  const say = (owner: CmsCardOwner, title: string, icon: string, step: number | null) => {
    owner.notify({ title, icon, actions: [{ label: t('blocks.undo'), color: 'neutral', variant: 'outline', onClick: owner.undo(step) }] })
  }

  /**
   * The section's field `key` is set to `value`. When that is the card's binding and the type changes to
   * another of the site's, the card is rewritten with it, in one step, with a notice; returns whether it
   * was handled (false: the owner sets the field as it always does).
   */
  function change(section: any, def: any, key: string, value: unknown, owner: CmsCardOwner): boolean {
    const binding = cardBindingFieldOf(def)
    if (!binding || binding.key !== key || !section) return false
    const next = typeOf(cmsBindingRead(value)?.type)
    if (!next) return false
    const oldName = cmsBindingRead(section[key])?.type
    if (oldName === next.type.name) return false
    const from = typeOf(oldName)?.type ?? null
    const out = cardTypeChange(section, def, from, next.type, lang())
    if (!out) return false
    const step = owner.apply({ [key]: value, [out.key]: out.items })
    if (out.mode === 'starter') say(owner, t('card.designed', { type: next.meta.label }), 'i-lucide-sparkles', step)
    else if (out.unbound) say(owner, t('card.retypedUnbound', { type: next.meta.label, count: out.unbound }), 'i-lucide-database', step)
    else say(owner, t('card.retyped', { type: next.meta.label }), 'i-lucide-database', step)
    return true
  }

  /** The blocks that show nothing are removed (one step, *Undo*). */
  function dropUnbound(section: any, def: any, owner: CmsCardOwner) {
    const held = cardItemsIn(section, def)
    const type = typeOfSection(section, def)
    const n = unboundOf(section, def).length
    if (!held || !n) return
    const step = owner.apply({ [held.key]: cardDropUnbound(held.items, held.listDefs, type) })
    say(owner, t('card.dropped', { count: n }), 'i-lucide-trash-2', step)
  }

  /** The card is designed again from the type's fields (one step, *Undo*). */
  function redesign(section: any, def: any, owner: CmsCardOwner) {
    const name = cmsBindingRead(section?.[cardBindingFieldOf(def)?.key ?? ''])?.type
    const found = typeOf(name)
    const out = found ? cardRedesign(section, def, found.type, lang()) : null
    if (!found || !out) return
    const step = owner.apply({ [out.key]: out.items })
    say(owner, t('card.designed', { type: found.meta.label }), 'i-lucide-sparkles', step)
  }

  return { typeOf, typeOfSection, unboundOf, change, dropUnbound, redesign }
}
