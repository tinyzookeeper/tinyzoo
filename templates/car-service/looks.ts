// The three looks of the Garage template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A bright page with one deep colour: large calm type, big photographs, the repair as four stops on a road.
    id: 'cesta',
    button: 'btn btn-brand',
    name: { cs: 'Cesta', en: 'Road' },
    own: { against: ['--brand-ink', '--paper', '--tint'], fixed: ['#14181b', '#ffffff'] },
    presets: [
      { id: 'modra', name: { cs: 'Modrá', en: 'Blue' }, vars: { '--brand': '#1d4fb8', '--brand-ink': '#ffffff', '--tint': '#e8eefa', '--paper': '#f4f5f7', '--line': '#e1e4ea' } },
      { id: 'zelena', name: { cs: 'Zelená', en: 'Green' }, vars: { '--brand': '#17594a', '--brand-ink': '#ffffff', '--tint': '#e7f0ec', '--paper': '#f4f5f2', '--line': '#e2e5e3' } },
      { id: 'grafit', name: { cs: 'Grafit', en: 'Graphite' }, vars: { '--brand': '#262b31', '--brand-ink': '#ffffff', '--tint': '#eceeef', '--paper': '#f5f5f3', '--line': '#e3e4e2' } },
    ],
  },
  {
    // The dashboard at dusk: six warning lights lead into the price guide, a gear pattern shows the repair.
    id: 'kontrolky',
    button: 'btn btn-brand',
    name: { cs: 'Kontrolky', en: 'Warning Lights' },
    own: { against: ['--bg', '--brand-ink', '--panel'], fixed: ['#0a0c0e', '#eceff1'] },
    presets: [
      { id: 'podsviceni', name: { cs: 'Zelené podsvícení', en: 'Green backlight' }, vars: { '--brand': '#93e67c', '--brand-ink': '#0a1408', '--bg': '#0f1215', '--panel': '#181c20', '--line': '#2a3036' } },
      { id: 'jantar', name: { cs: 'Jantarové', en: 'Amber' }, vars: { '--brand': '#ffa94d', '--brand-ink': '#170c00', '--bg': '#121110', '--panel': '#1c1a18', '--line': '#322e2a' } },
      { id: 'led', name: { cs: 'Ledové', en: 'Icy' }, vars: { '--brand': '#8fcbff', '--brand-ink': '#04111c', '--bg': '#0e1116', '--panel': '#171b22', '--line': '#293039' } },
    ],
  },
  {
    // The red tool chest of the workshop: a drawer for every group of the price guide, the page speaks of three mechanics.
    id: 'supliky',
    button: 'btn btn-brand',
    name: { cs: 'Šuplíky', en: 'Drawers' },
    own: { against: ['--brand-ink', '--card', '--paper', '--tint'], fixed: ['#1f1b19', '#ffffff'] },
    presets: [
      { id: 'cervena', name: { cs: 'Červená', en: 'Red' }, vars: { '--brand': '#c5281c', '--brand-deep': '#96190f', '--brand-ink': '#ffffff', '--paper': '#f4ecde', '--tint': '#e9dcc6', '--card': '#fffaf0', '--edge': '#dccdb3' } },
      { id: 'safir', name: { cs: 'Modrá', en: 'Blue' }, vars: { '--brand': '#1d4f91', '--brand-deep': '#143a6d', '--brand-ink': '#ffffff', '--paper': '#eef0ea', '--tint': '#dde2d8', '--card': '#fbfcf7', '--edge': '#cdd4c6' } },
      { id: 'lahvova', name: { cs: 'Zelená', en: 'Green' }, vars: { '--brand': '#1f6245', '--brand-deep': '#164a33', '--brand-ink': '#ffffff', '--paper': '#f3eddd', '--tint': '#e6dcc3', '--card': '#fffaee', '--edge': '#d9ccae' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]
