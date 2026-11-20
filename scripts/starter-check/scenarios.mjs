// The combinations scripts/starter-check.mjs makes a site in (its head says what each one checks).
// A module of its own, without dependencies, so heavy.yml can read the ids before anything is
// installed: every id is one `starter` job there (`--only <id>`).
export const ALL_PARTS = ['news', 'forms', 'redirects', 'search', 'analytics']
export const SCENARIOS = [
  { id: 'defaults', via: 'init', args: [], languages: ['cs', 'en'], presets: ALL_PARTS, demo: true, deep: true },
  { id: 'english-empty', via: 'init', args: ['--languages', 'en', '--no-demo', '--presets', 'none'], languages: ['en'], presets: [], demo: false },
  { id: 'all-with-german', via: 'create', args: ['--languages', 'cs,en,de', '--presets', ALL_PARTS.join(',')], languages: ['cs', 'en', 'de'], presets: ALL_PARTS, demo: true },
  { id: 'english-first', via: 'init', args: ['--languages', 'en,cs', '--presets', 'news,redirects'], languages: ['en', 'cs'], presets: ['news', 'redirects'], demo: true },
]
