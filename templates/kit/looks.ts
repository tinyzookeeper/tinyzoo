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
// This file has no imports: cms.config.ts, the seed and the app can all load it.

/** A text in the admin's languages. */
export type LookText = { cs: string; en: string }

export interface ColorPreset<Id extends string = string> {
  id: Id
  name: LookText
  /** CSS variables the preset sets, e.g. `{ '--brand': '#7a5a3a' }`. */
  vars: Record<`--${string}`, string>
}

export interface LookDef<Id extends string = string, PresetId extends string = string> {
  id: Id
  name: LookText
  /** The look's colour presets; the first is its default. Ids are unique across the whole template. */
  presets: readonly [ColorPreset<PresetId>, ...ColorPreset<PresetId>[]]
}

export interface ResolvedLook<L extends LookDef = LookDef> {
  look: L
  preset: L['presets'][number]
  /** The preset as an inline style: `--brand:#7a5a3a;--paper:#faf8f4`. */
  style: string
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
  /**
   * The look and colours a site shows. An unknown look is the first one; colours that belong
   * to another look (the look was changed, the colours were not) are the look's default.
   */
  resolve(look: string | null | undefined, preset: string | null | undefined): ResolvedLook<L>
}

/** One preset as an inline style. Only custom properties with plain values are written. */
export function presetStyle(preset: ColorPreset): string {
  return Object.entries(preset.vars)
    .filter(([name, value]) => /^--[a-z0-9-]+$/i.test(name) && /^[#a-z0-9(),.%\s-]+$/i.test(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}

export function defineLooks<const L extends LookDef>(all: readonly [L, ...L[]]): Looks<L> {
  const seen = new Set<string>()
  for (const look of all) {
    for (const preset of look.presets) {
      if (seen.has(preset.id)) throw new Error(`[looks] the colour preset "${preset.id}" is listed twice: ids are unique across a template`)
      seen.add(preset.id)
    }
  }
  const labels = {} as Record<string, LookText>
  const presetLabels = {} as Record<string, LookText>
  for (const look of all) {
    labels[look.id] = look.name
    for (const preset of look.presets) presetLabels[preset.id] = { cs: `${look.name.cs} · ${preset.name.cs}`, en: `${look.name.en} · ${preset.name.en}` }
  }
  return {
    all,
    ids: all.map((l) => l.id) as unknown as Looks<L>['ids'],
    presetIds: all.flatMap((l) => l.presets.map((p) => p.id)) as unknown as Looks<L>['presetIds'],
    labels: labels as Looks<L>['labels'],
    presetLabels: presetLabels as Looks<L>['presetLabels'],
    resolve(lookId, presetId) {
      const look = all.find((l) => l.id === lookId) ?? all[0]
      const preset = look.presets.find((p) => p.id === presetId) ?? look.presets[0]
      return { look, preset, style: presetStyle(preset) }
    },
  }
}
