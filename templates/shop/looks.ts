// The three looks of the Shop template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The painted wooden shopfront: the name on a fascia board, the opening as a shop window, panels of joinery.
    id: 'portal',
    name: { cs: 'Portál', en: 'Shopfront' },
    own: { main: '--wood', calm: true, against: ['--brass', '--cream', '--wood-lo'], fixed: ['#ffb3a8'] },
    presets: [
      { id: 'lahvova', name: { cs: 'Lahvová', en: 'Bottle green' }, swatch: ['#17352b', '#d0aa62', '#f1e7d1'], vars: { '--wood': '#17352b', '--wood-hi': '#20453a', '--wood-lo': '#0f251e', '--cream': '#f1e7d1', '--glass': '#efe4cb', '--brass': '#d0aa62', '--brass-lo': '#8b6a2c' } },
      { id: 'burgund', name: { cs: 'Burgund', en: 'Burgundy' }, swatch: ['#421a1d', '#dcb26c', '#f3e8d6'], vars: { '--wood': '#421a1d', '--wood-hi': '#54252a', '--wood-lo': '#2c0f12', '--cream': '#f3e8d6', '--glass': '#f0e3cf', '--brass': '#dcb26c', '--brass-lo': '#96702f' } },
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink blue' }, swatch: ['#18263f', '#d2b071', '#eee9dc'], vars: { '--wood': '#18263f', '--wood-hi': '#223453', '--wood-lo': '#0f192c', '--cream': '#eee9dc', '--glass': '#e9e4d6', '--brass': '#d2b071', '--brass-lo': '#7d6a3e' } },
    ],
  },
  {
    // The shelf and its price rail: things stand on a board, the rail under them carries the labels.
    id: 'regal',
    name: { cs: 'Regál', en: 'Shelf' },
    own: { main: '--rail', against: ['--paper', '--rail-ink', '--tint'], fixed: ['#ffffff'] },
    presets: [
      { id: 'smalt', name: { cs: 'Smalt', en: 'Enamel blue' }, swatch: ['#2b3557', '#dcae52', '#f6f5f2'], vars: { '--rail': '#2b3557', '--rail-ink': '#ffffff', '--signal': '#dcae52', '--signal-ink': '#1a1e2a', '--paper': '#f6f5f2', '--tint': '#e9e8e3', '--ink': '#1a1e2a' } },
      { id: 'police', name: { cs: 'Regál', en: 'Shelf green' }, swatch: ['#2f4638', '#d9ab4d', '#f7f5f0'], vars: { '--rail': '#2f4638', '--rail-ink': '#ffffff', '--signal': '#d9ab4d', '--signal-ink': '#1b221d', '--paper': '#f7f5f0', '--tint': '#eceae2', '--ink': '#1b221d' } },
      { id: 'orech', name: { cs: 'Ořech', en: 'Walnut' }, swatch: ['#7b4632', '#e3c58a', '#f8f5ef'], vars: { '--rail': '#7b4632', '--rail-ink': '#ffffff', '--signal': '#e3c58a', '--signal-ink': '#241b16', '--paper': '#f8f5ef', '--tint': '#eee9df', '--ink': '#241b16' } },
    ],
  },
  {
    // The pegboard behind the counter: everything hangs on wooden pegs, a little crooked, and straightens when touched.
    id: 'na-hacku',
    name: { cs: 'Na háčku', en: 'On the Hook' },
    own: { against: ['--board', '--brand-ink', '--ink', '--tint'], fixed: ['#ffffff'] },
    presets: [
      { id: 'zelena', name: { cs: 'Regál', en: 'Shelf green' }, swatch: ['#2f4f3e', '#eceae4', '#e6bb58'], vars: { '--brand': '#2f4f3e', '--brand-ink': '#ffffff', '--board': '#eceae4', '--board-lo': '#bfb9aa', '--tint': '#f3f1eb', '--ink': '#1d2420', '--pop': '#e6bb58', '--peg': '#d7a56c' } },
      { id: 'kobalt', name: { cs: 'Smalt', en: 'Enamel blue' }, swatch: ['#2c3a63', '#e9e9e5', '#e6bb58'], vars: { '--brand': '#2c3a63', '--brand-ink': '#ffffff', '--board': '#e9e9e5', '--board-lo': '#babab2', '--tint': '#f1f1ed', '--ink': '#1b1f2b', '--pop': '#e6bb58', '--peg': '#d7a56c' } },
      { id: 'dub', name: { cs: 'Ořech', en: 'Walnut' }, swatch: ['#7b4632', '#eeeae3', '#e8d2a2'], vars: { '--brand': '#7b4632', '--brand-ink': '#ffffff', '--board': '#eeeae3', '--board-lo': '#c3baa9', '--tint': '#f5f1ea', '--ink': '#251c17', '--pop': '#e8d2a2', '--peg': '#d7a56c' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]
