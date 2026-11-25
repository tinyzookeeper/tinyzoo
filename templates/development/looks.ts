// The three looks of the Development template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults. The designs'
// `--muted` is `--quiet` here: `muted` is Nuxt UI's own name, which the admin uses.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The architect's blueprint: white linework on one deep blue sheet, the building drawn as an elevation.
    id: 'modrotisk',
    name: { cs: 'Modrotisk', en: 'Blueprint' },
    own: { main: '--paper', calm: true, against: ['--accent', '--ink', '--quiet'] },
    presets: [
      { id: 'modrotisk', name: { cs: 'Modrotisk', en: 'Blueprint' }, swatch: ['#12355b', '#ff9a7b', '#f2f6fb'], vars: { '--paper': '#12355b', '--panel': '#18416d', '--ink': '#f2f6fb', '--quiet': '#b3c7dc', '--accent': '#ff9a7b' } },
      { id: 'borovice', name: { cs: 'Borovice', en: 'Pine' }, swatch: ['#14382f', '#f3c76b', '#f4f5ec'], vars: { '--paper': '#14382f', '--panel': '#1b473c', '--ink': '#f4f5ec', '--quiet': '#b6cabd', '--accent': '#f3c76b' } },
      { id: 'grafit', name: { cs: 'Grafit', en: 'Graphite' }, swatch: ['#26282d', '#ff8d5e', '#f5f2ea'], vars: { '--paper': '#26282d', '--panel': '#31343a', '--ink': '#f5f2ea', '--quiet': '#c0bcb3', '--accent': '#ff8d5e' } },
    ],
  },
  {
    // The building read floor by floor: a calm white page, a narrow serif, the price list under four floor numerals.
    id: 'patra',
    name: { cs: 'Patra', en: 'Floors' },
    own: { against: ['--brand-ink'], fixed: ['#ffffff'] },
    presets: [
      { id: 'bronz', name: { cs: 'Bronz', en: 'Bronze' }, swatch: ['#7d5a3a', '#f6f4f0', '#262320'], vars: { '--brand': '#7d5a3a', '--brand-ink': '#ffffff', '--soft': '#f6f4f0', '--ink': '#262320', '--quiet': '#665f58' } },
      { id: 'sosna', name: { cs: 'Borovice', en: 'Pine' }, swatch: ['#2f5b4c', '#f4f5f1', '#20262a'], vars: { '--brand': '#2f5b4c', '--brand-ink': '#ffffff', '--soft': '#f4f5f1', '--ink': '#20262a', '--quiet': '#596266' } },
      { id: 'bridlice', name: { cs: 'Břidlice', en: 'Slate' }, swatch: ['#34506b', '#f3f5f7', '#1f252c'], vars: { '--brand': '#34506b', '--brand-ink': '#ffffff', '--soft': '#f3f5f7', '--ink': '#1f252c', '--quiet': '#586170' } },
    ],
  },
  {
    // The house follows the sun: a friendly white page of circles and rounded panels, every flat described by its light.
    id: 'po-slunci',
    name: { cs: 'Po slunci', en: 'By the Sun' },
    own: { against: ['--brand-ink'], fixed: ['#ffffff'] },
    presets: [
      { id: 'more', name: { cs: 'Moře', en: 'Sea' }, swatch: ['#1f5a61', '#eef3f3', '#f6cf6b'], vars: { '--brand': '#1f5a61', '--brand-ink': '#ffffff', '--soft': '#eef3f3', '--sun': '#f6cf6b', '--ink': '#1b2a2d', '--quiet': '#53656a' } },
      { id: 'sad', name: { cs: 'Sad', en: 'Orchard' }, swatch: ['#2f5d46', '#f0f4ee', '#f4d06e'], vars: { '--brand': '#2f5d46', '--brand-ink': '#ffffff', '--soft': '#f0f4ee', '--sun': '#f4d06e', '--ink': '#1d2a22', '--quiet': '#56655b' } },
      { id: 'vecer', name: { cs: 'Večer', en: 'Evening' }, swatch: ['#2f3e73', '#f0f2f8', '#f5d47c'], vars: { '--brand': '#2f3e73', '--brand-ink': '#ffffff', '--soft': '#f0f2f8', '--sun': '#f5d47c', '--ink': '#1d2233', '--quiet': '#585f75' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]
