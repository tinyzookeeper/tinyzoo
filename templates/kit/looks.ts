// Looks: one template, several designs. A template lists its looks once (`looks.ts` beside its
// cms.config.ts); the content model, the website and the seed all read that list.
//
//   export const looks = defineLooks([
//     { id: 'atelier', name: { cs: 'Ateliér', en: 'Atelier' }, presets: [
//       { id: 'bronz', name: { cs: 'Bronz', en: 'Bronze' }, vars: { '--brand': '#7a5a3a', '--paper': '#faf8f4' } },
//       …
//     ] },
//     …
//   ])
//
// The first look is the default one, and a look's first preset is its default colours. Every
// preset of a look sets the same CSS variables. A site keeps both choices in its settings
// (`look`, `colors`): nothing about them is compiled into the build, so one build serves
// every site made from the template.
//
// An owner may add a main colour of their own to a preset (`ownColor` in the settings): the
// look then shows the preset with that colour and what follows from it (palette.ts, and
// docs/look-as-data-plan.md). A site without one is drawn exactly as its preset says.
//
// This file imports only palette.ts, which imports nothing: cms.config.ts, the seed and the app
// can all load it.
import { learnPalette, ownPalette, plainHex, type OwnColours, type PaletteRule, type Vars } from './palette.ts'

export type { OwnColours } from './palette.ts'

/** A text in the admin's languages. */
export type LookText = { cs: string; en: string }

export interface ColorPreset<Id extends string = string> {
  id: Id
  name: LookText
  /** CSS variables the preset sets, e.g. `{ '--brand': '#7a5a3a' }`. */
  vars: Record<`--${string}`, string>
  /**
   * The colours that stand for the preset in the admin, as dots beside its name (hex). Left out:
   * the brand colour, the background and one more tone, picked from `vars` by their usual names.
   */
  swatch?: readonly string[]
}

export interface LookDef<Id extends string = string, PresetId extends string = string> {
  id: Id
  name: LookText
  /** The look's colour presets; the first is its default. Ids are unique across the whole template. */
  presets: readonly [ColorPreset<PresetId>, ...ColorPreset<PresetId>[]]
  /**
   * What the look says about an owner's own main colour: which variable it is, and what the look
   * puts together with it (palette.ts). `against` and `fixed` are written by
   * templates/kit/scripts/look-pairs.mjs; test/unit/template-palette.spec.ts keeps them true.
   */
  own?: OwnColours
}

/** The owner's own choices beside a look and a preset (Site settings). */
export interface OwnLook {
  /** Their main colour, `#rrggbb`. Anything else counts as none. */
  color?: string | null
}

export interface ResolvedLook<L extends LookDef = LookDef> {
  look: L
  preset: L['presets'][number]
  /** The preset as an inline style: `--brand:#7a5a3a;--paper:#faf8f4`. With an own colour, the palette that comes of it. */
  style: string
  /**
   * The owner's main colour when the page shows one: as they gave it, and as it is shown (the
   * same, or lighter or darker where a text would be hard to read). Null without one.
   */
  own: { given: string; shown: string } | null
}

export interface Looks<L extends LookDef> {
  all: readonly L[]
  /** The ids, for `f.select({ options: looks.ids })`. */
  ids: readonly [L['id'], ...L['id'][]]
  /** Every preset's id, look by look, for `f.select({ options: looks.presetIds })`. */
  presetIds: readonly [L['presets'][number]['id'], ...L['presets'][number]['id'][]]
  /** The select's labels: the look's name. */
  labels: Record<L['id'], LookText>
  /** The select's labels: "Ateliér · Bronz", so the list reads grouped by look. */
  presetLabels: Record<L['presets'][number]['id'], LookText>
  /** The select's labels where only one look's presets are offered: "Bronz". */
  presetNames: Record<L['presets'][number]['id'], LookText>
  /** Each look's preset ids, for `f.select({ optionsBy: { field: 'look', options: looks.presetsByLook } })`. */
  presetsByLook: Record<L['id'], L['presets'][number]['id'][]>
  /** Each preset's colours as dots, for `f.select({ swatches: looks.swatches })`. */
  swatches: Record<L['presets'][number]['id'], string[]>
  /**
   * The two choices of Site settings, ready for `f.select(…)`: the look, and the colours, which
   * offer only the chosen look's presets (with their colours as dots).
   */
  fields: {
    look: { options: Looks<L>['ids']; default: L['id']; labels: Looks<L>['labels'] }
    colors: {
      options: Looks<L>['presetIds']; default: L['presets'][number]['id']; labels: Looks<L>['presetNames']
      optionsBy: { field: 'look'; options: Looks<L>['presetsByLook'] }; swatches: Looks<L>['swatches']
    }
  }
  /**
   * The look and colours a site shows. An unknown look is the first one; colours that belong
   * to another look (the look was changed, the colours were not) are the look's default.
   */
  resolve(look: string | null | undefined, preset: string | null | undefined, own?: OwnLook | null): ResolvedLook<L>
  /** A look's rules for an own colour (palette.ts); null for a look that takes none. */
  paletteRule(look: string): PaletteRule | null
}

/** CSS variables as an inline style. Only custom properties with plain values are written. */
export function varsStyle(vars: Vars): string {
  return Object.entries(vars)
    .filter(([name, value]) => /^--[a-z0-9-]+$/i.test(name) && /^[#a-z0-9(),.%\s-]+$/i.test(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}

/** One preset as an inline style. */
export function presetStyle(preset: ColorPreset): string {
  return varsStyle(preset.vars)
}

/**
 * The field `ownColor` of Site settings, as every template writes it:
 * `f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help)`.
 */
export const OWN_COLOR_FIELD: { label: LookText; help: LookText } = {
  label: { cs: 'Vlastní barva', en: 'Own colour' },
  help: {
    cs: 'Zadejte svou hlavní barvu. Ostatní barvy palety se jí přizpůsobí. Barvu, na které by se texty špatně četly, zobrazíme o něco světlejší nebo tmavší.',
    en: 'Give your own main colour. The other colours of the palette follow it. A colour that would make texts hard to read is shown a little lighter or darker.',
  },
}

/**
 * TZ_OWN_LOOK=on: the sites of this app may have a main colour of their own (experimental).
 * Read on the server only; the website gets the answer with the page (app/composables/useSite.ts).
 */
export function ownLookOn(): boolean {
  return typeof process !== 'undefined' && process.env?.TZ_OWN_LOOK === 'on'
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
// The variables a look's presets usually set, by what they are: the brand colour, the page's
// background, and one more tone that tells presets with the same brand apart.
const SWATCH_VARS: readonly (readonly `--${string}`[])[] = [
  ['--brand', '--accent'],
  ['--paper', '--bg', '--night', '--page', '--ground'],
  ['--tint', '--panel', '--card', '--deep', '--ink', '--fg'],
]

/** The colours that stand for a preset: its own `swatch`, else up to three picked from its variables. */
export function presetSwatch(preset: ColorPreset): string[] {
  if (preset.swatch) return preset.swatch.filter((c) => HEX.test(c))
  const picked: string[] = []
  for (const names of SWATCH_VARS) {
    const value = names.map((n) => preset.vars[n]).find((v) => v && HEX.test(v) && !picked.includes(v.toLowerCase()))
    if (value) picked.push(value.toLowerCase())
  }
  return picked
}

export function defineLooks<const T extends readonly [LookDef, ...LookDef[]]>(all: T): Looks<T[number]> {
  type L = T[number]
  const seen = new Set<string>()
  for (const look of all) {
    for (const preset of look.presets) {
      if (seen.has(preset.id)) throw new Error(`[looks] the colour preset "${preset.id}" is listed twice: ids are unique across a template`)
      seen.add(preset.id)
    }
  }
  const labels: Record<string, LookText> = {}
  const presetLabels: Record<string, LookText> = {}
  const presetNames: Record<string, LookText> = {}
  const presetsByLook: Record<string, string[]> = {}
  const swatches: Record<string, string[]> = {}
  for (const look of all) {
    labels[look.id] = look.name
    presetsByLook[look.id] = look.presets.map((p) => p.id)
    for (const preset of look.presets) {
      presetLabels[preset.id] = { cs: `${look.name.cs} · ${preset.name.cs}`, en: `${look.name.en} · ${preset.name.en}` }
      presetNames[preset.id] = preset.name
      swatches[preset.id] = presetSwatch(preset)
    }
  }
  // A look's rules for an own colour are worked out when first asked for, once.
  const rules = new Map<string, PaletteRule | null>()
  const paletteRule = (lookId: string): PaletteRule | null => {
    if (!rules.has(lookId)) {
      const look = all.find((l) => l.id === lookId)
      rules.set(lookId, look ? learnPalette(look.presets, look.own) : null)
    }
    return rules.get(lookId) ?? null
  }
  const ids = all.map((l) => l.id) as unknown as Looks<L>['ids']
  const presetIds = all.flatMap((l) => l.presets.map((p) => p.id)) as unknown as Looks<L>['presetIds']
  return {
    all,
    ids,
    presetIds,
    labels: labels as Looks<L>['labels'],
    presetLabels: presetLabels as Looks<L>['presetLabels'],
    presetNames: presetNames as Looks<L>['presetNames'],
    presetsByLook: presetsByLook as Looks<L>['presetsByLook'],
    swatches: swatches as Looks<L>['swatches'],
    fields: {
      look: { options: ids, default: ids[0], labels: labels as Looks<L>['labels'] },
      colors: {
        options: presetIds, default: presetIds[0], labels: presetNames as Looks<L>['presetNames'],
        optionsBy: { field: 'look', options: presetsByLook as Looks<L>['presetsByLook'] }, swatches: swatches as Looks<L>['swatches'],
      },
    },
    resolve(lookId, presetId, own) {
      const look: L = all.find((l) => l.id === lookId) ?? all[0]
      const preset = look.presets.find((p) => p.id === presetId) ?? look.presets[0]
      const given = plainHex(own?.color)
      const rule = given ? paletteRule(look.id) : null
      // No colour of the owner's (or a look that takes none): the preset, exactly as before.
      if (!given || !rule) return { look, preset, style: presetStyle(preset), own: null }
      const vars = ownPalette(preset.vars, rule, given)
      return { look, preset, style: varsStyle(vars), own: { given, shown: vars[rule.main] ?? given } }
    },
    paletteRule,
  }
}
