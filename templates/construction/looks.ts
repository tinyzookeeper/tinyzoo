// The three looks of the Builders and architects template, and each look's colours. The first
// look and each look's first colours are the defaults. Shown by: cms.config.ts (the two choices
// in Site settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A building drawing: a cool white sheet, black lines in two weights, durations set as dimension lines.
    id: 'vykres',
    name: { cs: 'Výkres', en: 'Drawing' },
    own: { against: ['--brand-ink', '--sheet'] },
    presets: [
      { id: 'tuzka', name: { cs: 'Červená tužka', en: 'Red pencil' }, swatch: ['#c9301f', '#f3f4f2', '#14181b'], vars: { '--brand': '#c9301f', '--brand-ink': '#ffffff', '--sheet': '#f3f4f2', '--tint': '#e7e9e5', '--hair': '#c3c7c2', '--ink': '#14181b' } },
      { id: 'modrak', name: { cs: 'Modrák', en: 'Blue ink' }, swatch: ['#1d4fc4', '#f1f3f6', '#101827'], vars: { '--brand': '#1d4fc4', '--brand-ink': '#ffffff', '--sheet': '#f1f3f6', '--tint': '#e2e7ee', '--hair': '#bcc4cf', '--ink': '#101827' } },
      { id: 'zelen', name: { cs: 'Zeleň', en: 'Green' }, swatch: ['#22704b', '#f4f4ef', '#191c16'], vars: { '--brand': '#22704b', '--brand-ink': '#ffffff', '--sheet': '#f4f4ef', '--tint': '#e8e9df', '--hair': '#c6c8ba', '--ink': '#191c16' } },
    ],
  },
  {
    // The build schedule as the website: a graphite page levelled to one laser line, durations as bars on a week grid.
    id: 'harmonogram',
    name: { cs: 'Harmonogram', en: 'Schedule' },
    own: { against: ['--bg', '--brand-ink'] },
    presets: [
      { id: 'laser', name: { cs: 'Zelený laser', en: 'Green laser' }, swatch: ['#5bf36d', '#151719', '#eceee8'], vars: { '--brand': '#5bf36d', '--brand-ink': '#06140a', '--bg': '#151719', '--surface': '#1e2124', '--raised': '#2a2e32', '--line': '#3b4146', '--paper': '#eceee8' } },
      { id: 'cervena', name: { cs: 'Červený laser', en: 'Red laser' }, swatch: ['#ff5f4f', '#18161a', '#f0ece9'], vars: { '--brand': '#ff5f4f', '--brand-ink': '#1a0503', '--bg': '#18161a', '--surface': '#221f25', '--raised': '#2e2a32', '--line': '#423d46', '--paper': '#f0ece9' } },
      { id: 'snura', name: { cs: 'Modrá šňůra', en: 'Chalk line blue' }, swatch: ['#6eb0ff', '#12171f', '#e8edf3'], vars: { '--brand': '#6eb0ff', '--brand-ink': '#04101f', '--bg': '#12171f', '--surface': '#1a212c', '--raised': '#25303f', '--line': '#374354', '--paper': '#e8edf3' } },
    ],
  },
  {
    // A wall of terracotta blocks in a running bond on plaster, and the build as a house that grows from the footing up.
    id: 'zdivo',
    name: { cs: 'Zdivo', en: 'Brickwork' },
    own: { against: ['--plaster'], fixed: ['#fff8ec'] },
    presets: [
      { id: 'cihla', name: { cs: 'Cihla', en: 'Clay' }, swatch: ['#a9401f', '#efe7d8', '#24160f'], vars: { '--brand': '#a9401f', '--brand-d': '#8f351a', '--brand-2': '#d06c41', '--brand-3': '#e6a47f', '--plaster': '#efe7d8', '--card': '#faf5ea', '--ink': '#24160f', '--timber': '#e4c690' } },
      { id: 'bridlice', name: { cs: 'Břidlice', en: 'Slate' }, swatch: ['#3d586c', '#e8e8e2', '#17202a'], vars: { '--brand': '#3d586c', '--brand-d': '#314859', '--brand-2': '#86a1b5', '--brand-3': '#b9c9d5', '--plaster': '#e8e8e2', '--card': '#f6f6f1', '--ink': '#17202a', '--timber': '#e3cf9f' } },
      { id: 'smrk', name: { cs: 'Smrk', en: 'Spruce' }, swatch: ['#2f6248', '#ece7d9', '#1c2019'], vars: { '--brand': '#2f6248', '--brand-d': '#264f3a', '--brand-2': '#76a58a', '--brand-3': '#b3cfbd', '--plaster': '#ece7d9', '--card': '#f8f4e9', '--ink': '#1c2019', '--timber': '#e4c690' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]
