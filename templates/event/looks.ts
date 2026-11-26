// The two looks of the Event template, and each look's colours. The first look and each look's
// first colours are the defaults. Shown by: cms.config.ts (the two choices in Site settings),
// the website (the kit's layout) and the cloud's template registry (cloud/shared/templates.ts
// lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The finish-line clock: a dark page where every number that matters is lit in a dot-matrix face.
    id: 'casomira',
    heading: 'h2 mb-8 lg:mb-10',
    name: { cs: 'Časomíra', en: 'Race Clock' },
    own: { main: '--led', against: ['--bg', '--led-ink', '--panel'], fixed: ['#050606', '#eef0ec'] },
    presets: [
      { id: 'cervena', name: { cs: 'Časomíra', en: 'Race clock' }, swatch: ['#0c0e0f', '#ff5b2b', '#eef0ec'], vars: { '--led': '#ff5b2b', '--led-ink': '#0c0e0f', '--bg': '#0c0e0f', '--panel': '#15191b', '--line': '#2c3336' } },
      { id: 'zelena', name: { cs: 'Zelená', en: 'Green' }, swatch: ['#0a0f0c', '#5fe38c', '#eef0ec'], vars: { '--led': '#5fe38c', '--led-ink': '#07110b', '--bg': '#0a0f0c', '--panel': '#121a15', '--line': '#27332b' } },
      { id: 'led', name: { cs: 'Led', en: 'Ice' }, swatch: ['#0a0d13', '#86d6ff', '#eef0ec'], vars: { '--led': '#86d6ff', '--led-ink': '#07101a', '--bg': '#0a0d13', '--panel': '#131824', '--line': '#2a3242' } },
    ],
  },
  {
    // A hand-printed poster in three inks: overprinted hills, a round photo, section edges cut as hills.
    id: 'soutisk',
    heading: 'h2 mb-8 lg:mb-10',
    name: { cs: 'Soutisk', en: 'Overprint' },
    own: { main: '--c1', against: ['--c2', '--ink', '--paper', '--paper2'] },
    presets: [
      { id: 'cinober', name: { cs: 'Soutisk', en: 'Overprint' }, swatch: ['#f06a45', '#f4c13d', '#1f7480'], vars: { '--c1': '#f06a45', '--c2': '#f4c13d', '--c3': '#1f7480', '--paper': '#f4efe2', '--paper2': '#e9e1cd', '--ink': '#1c2b2d' } },
      { id: 'louka', name: { cs: 'Louka', en: 'Meadow' }, swatch: ['#f08548', '#d3e07c', '#2f6243'], vars: { '--c1': '#f08548', '--c2': '#d3e07c', '--c3': '#2f6243', '--paper': '#f3f1e3', '--paper2': '#e4e3cd', '--ink': '#1c2a20' } },
      { id: 'boruvka', name: { cs: 'Borůvka', en: 'Blueberry' }, swatch: ['#f06a55', '#bcdcf0', '#2d4186'], vars: { '--c1': '#f06a55', '--c2': '#bcdcf0', '--c3': '#2d4186', '--paper': '#f4f1ea', '--paper2': '#e5e1d6', '--ink': '#1a2038' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]
