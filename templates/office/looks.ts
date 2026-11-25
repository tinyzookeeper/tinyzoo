// The two looks of the Office template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
// (The design's `--muted` is `--quiet` here: `muted` is Nuxt UI's own name, which the admin uses.)
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // An office kept like a measuring instrument: a ruler of deadlines under the opening, tabular figures, ticks and hairlines.
    id: 'lhuty',
    name: { cs: 'Lhůty', en: 'Deadlines' },
    own: { also: ['--brand-soft', '--signal'], against: ['--brand-ink', '--ink', '--paper', '--tint'], fixed: ['#ffffff'] },
    presets: [
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink' }, vars: { '--paper': '#f2f4f7', '--tint': '#e5eaf1', '--line': '#c9d2de', '--ink': '#0e2240', '--quiet': '#56637a', '--brand': '#14315c', '--brand-ink': '#ffffff', '--brand-soft': '#bcc8da', '--signal': '#f2a516', '--signal-ink': '#1c1300', '--signal-text': '#8a5000' } },
      { id: 'les', name: { cs: 'Les', en: 'Forest' }, vars: { '--paper': '#f1f4f0', '--tint': '#e3eae2', '--line': '#c6d1c6', '--ink': '#12261f', '--quiet': '#55665d', '--brand': '#1b4a3c', '--brand-ink': '#ffffff', '--brand-soft': '#bcd0c6', '--signal': '#ff8257', '--signal-ink': '#2a0d00', '--signal-text': '#a83a12' } },
      { id: 'grafit', name: { cs: 'Grafit', en: 'Graphite' }, vars: { '--paper': '#f3f3f1', '--tint': '#e7e7e3', '--line': '#cfcfc9', '--ink': '#1b1d20', '--quiet': '#5d6066', '--brand': '#2a2d32', '--brand-ink': '#ffffff', '--brand-soft': '#c4c6ca', '--signal': '#8db9ff', '--signal-ink': '#06142e', '--signal-text': '#1f4fb5' } },
    ],
  },
  {
    // Lever arch binders: the services stand as spines on a shelf and lie as a pile of price tags; heavy type, flat colour.
    id: 'sanony',
    name: { cs: 'Šanony', en: 'Binders' },
    own: { also: ['--ink'], against: ['--brand-ink', '--paper', '--soft'], fixed: ['#ffffff'] },
    presets: [
      { id: 'rumelka', name: { cs: 'Rumělka', en: 'Vermilion' }, vars: { '--paper': '#f1efe9', '--ink': '#15130f', '--brand': '#d4371e', '--brand-ink': '#ffffff', '--soft': '#f5c9bd' } },
      { id: 'smaragd', name: { cs: 'Smaragd', en: 'Emerald' }, vars: { '--paper': '#eef0ea', '--ink': '#11150f', '--brand': '#0c7a4c', '--brand-ink': '#ffffff', '--soft': '#bfe6cf' } },
      { id: 'kobalt', name: { cs: 'Kobalt', en: 'Cobalt' }, vars: { '--paper': '#eef0f3', '--ink': '#0f1218', '--brand': '#2447d8', '--brand-ink': '#ffffff', '--soft': '#c6d1fa' } },
    ],
  },
])
