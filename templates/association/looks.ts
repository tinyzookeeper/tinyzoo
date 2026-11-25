// The look of the Association template, and its colours. The look's first colours are the
// defaults. Shown by: cms.config.ts (the two choices in Site settings), the website (the kit's
// layout) and the cloud's template registry (cloud/shared/templates.ts lists the same ids: a
// unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/ctvero-dob.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

// The four seasons are one family of pale tints taken from the photographs: every preset keeps
// them, whatever its brand colour (a preset changes the brand colour, the ink and the second ground).
const SEASONS = { '--zima': '#dbe5ea', '--jaro': '#dde8d2', '--leto': '#f0e7c2', '--podzim': '#f1dcc5' } as const

export const looks = defineLooks([
  {
    // The association's year: a strip of twelve months, and every project and month in the tint of its season.
    id: 'ctvero-dob',
    name: { cs: 'Čtvero dob', en: 'Four Seasons' },
    own: { against: ['--brand-ink', '--jaro', '--leto', '--podzim', '--sand', '--zima'], fixed: ['#ffffff'] },
    presets: [
      { id: 'sad', name: { cs: 'Sad', en: 'Orchard' }, swatch: ['#2a5135', '#f4f5f0', '#dde8d2'], vars: { '--brand': '#2a5135', '--brand-ink': '#ffffff', '--ink': '#1d2621', '--sand': '#f4f5f0', ...SEASONS } },
      { id: 'jablko', name: { cs: 'Jablko', en: 'Apple' }, swatch: ['#8f2d2a', '#f6f4f0', '#f1dcc5'], vars: { '--brand': '#8f2d2a', '--brand-ink': '#ffffff', '--ink': '#261f1d', '--sand': '#f6f4f0', ...SEASONS } },
      { id: 'hreben', name: { cs: 'Hřeben', en: 'Ridge' }, swatch: ['#2a4868', '#f2f4f5', '#dbe5ea'], vars: { '--brand': '#2a4868', '--brand-ink': '#ffffff', '--ink': '#1c222a', '--sand': '#f2f4f5', ...SEASONS } },
    ],
  },
])
