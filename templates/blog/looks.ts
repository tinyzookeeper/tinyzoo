// The two looks of the Blog template, and each look's colours. The first look and each look's
// first colours are the defaults. Shown by: cms.config.ts (the two choices in Site settings),
// the website (the kit's layout) and the cloud's template registry (cloud/shared/templates.ts
// lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A magazine cover: the lead photograph fills the first screen under the name, and the issue opens as a contents page.
    id: 'obalka',
    name: { cs: 'Obálka', en: 'Cover' },
    own: { against: ['--brand-ink', '--deep-ink', '--tint'], fixed: ['#ffffff'] },
    presets: [
      { id: 'mech', name: { cs: 'Mech', en: 'Moss' }, swatch: ['#2c5239', '#edf1ec', '#18241c'], vars: { '--brand': '#2c5239', '--brand-ink': '#ffffff', '--tint': '#edf1ec', '--deep': '#18241c', '--deep-ink': '#eef2ea', '--deep-soft': '#a9b8aa', '--line': '#dcdfdd' } },
      { id: 'cihla', name: { cs: 'Cihla', en: 'Brick' }, swatch: ['#9a3a20', '#f5efea', '#2a1712'], vars: { '--brand': '#9a3a20', '--brand-ink': '#ffffff', '--tint': '#f5efea', '--deep': '#2a1712', '--deep-ink': '#f6ede8', '--deep-soft': '#c9aea4', '--line': '#e3ddd9' } },
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink' }, swatch: ['#27407a', '#edf0f6', '#131b30'], vars: { '--brand': '#27407a', '--brand-ink': '#ffffff', '--tint': '#edf0f6', '--deep': '#131b30', '--deep-ink': '#eceff7', '--deep-soft': '#a6b0c8', '--line': '#dadde4' } },
    ],
  },
  {
    // "How much time do you have?": every article carries a clock face whose wedge is its reading time.
    id: 'ctvrthodinka',
    name: { cs: 'Čtvrthodinka', en: 'Quarter of an Hour' },
    own: { against: ['--brand-ink', '--ground', '--panel'] },
    presets: [
      { id: 'jedle', name: { cs: 'Jedle', en: 'Fir' }, vars: { '--ground': '#0f1916', '--panel': '#18261f', '--ink': '#f2ede2', '--quiet': '#a5b0a9', '--brand': '#ff6b3d', '--brand-ink': '#1d0d06' } },
      { id: 'noc', name: { cs: 'Inkoust', en: 'Ink' }, vars: { '--ground': '#0d1222', '--panel': '#171f36', '--ink': '#eef0f6', '--quiet': '#a5adc2', '--brand': '#8fd2ff', '--brand-ink': '#06131f' } },
      { id: 'den', name: { cs: 'Den', en: 'Day' }, vars: { '--ground': '#f3efe6', '--panel': '#e6e0d2', '--ink': '#17201c', '--quiet': '#535d57', '--brand': '#b23410', '--brand-ink': '#ffffff' } },
    ],
  },
])
