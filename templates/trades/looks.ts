// The two looks of the Trades template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults. The colours the
// presets leave alone (the ink and the text colours of Mistr, the coal of Reflex where a
// preset does not change it) are the stylesheet's.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The careful firm's page: warm white paper, hairlines, a real price list, photographs in plain frames.
    id: 'mistr',
    name: { cs: 'Mistr', en: 'Master' },
    presets: [
      { id: 'modra', name: { cs: 'Modrá', en: 'Blue' }, vars: { '--brand': '#1d4772', '--brand-ink': '#ffffff', '--brand-soft': '#e3eaf1', '--paper': '#fbfaf6', '--tint': '#f0eee6', '--line': '#d9d5c9' } },
      { id: 'zelena', name: { cs: 'Zelená', en: 'Green' }, vars: { '--brand': '#27523e', '--brand-ink': '#ffffff', '--brand-soft': '#e2ebe3', '--paper': '#fafaf5', '--tint': '#eef0e6', '--line': '#d5d8c8' } },
      { id: 'cihla', name: { cs: 'Cihla', en: 'Brick' }, vars: { '--brand': '#8c3a22', '--brand-ink': '#ffffff', '--brand-soft': '#f3e5dd', '--paper': '#fcfaf6', '--tint': '#f3eee6', '--line': '#ddd5c8' } },
    ],
  },
  {
    // A hi-vis vest as a website: a field of signal colour, black slabs, heavy type, the phone number the largest thing on the page.
    id: 'reflex',
    name: { cs: 'Reflex', en: 'Hi-Vis' },
    presets: [
      { id: 'zluta', name: { cs: 'Reflexní žlutá', en: 'Hi-vis yellow' }, vars: { '--brand': '#e2f133', '--brand-ink': '#101211', '--brand-lit': '#e2f133', '--paper': '#f2f2ec', '--ink': '#101211', '--coal': '#1c1f1d' } },
      { id: 'oranzova', name: { cs: 'Signální oranžová', en: 'Signal orange' }, vars: { '--brand': '#ff6b1a', '--brand-ink': '#140d08', '--brand-lit': '#ff7a30', '--paper': '#f4f1ec', '--ink': '#14110f', '--coal': '#211d1a' } },
      { id: 'monterkova', name: { cs: 'Montérková modrá', en: 'Overall blue' }, vars: { '--brand': '#2449d8', '--brand-ink': '#ffffff', '--brand-lit': '#9fb4ff', '--paper': '#eff1f4', '--ink': '#0e1118', '--coal': '#1a1e28' } },
    ],
  },
])
