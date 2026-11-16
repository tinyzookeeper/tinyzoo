/**
 * "events": the example plugin of the playground, and the proof that a plugin needs no
 * change to tinyzoo. It brings a collection (`events`, so a table of that name), an admin
 * page with a summary (`/admin/p/events`) and a sidebar entry for it, server routes
 * (`/api/cms/_p/events/…`, one also on the public content API), a Nitro plugin and an upgrade step.
 *
 * Register it in cms.config.ts: `export const plugins = [formsPlugin(), eventsPlugin()]`.
 * `docs/plugins.md` explains each part.
 */
import { defineCmsPlugin, defineEntity, f, pluginFile } from 'tinyzoo'

/** The plugin's collection. A plugin's entities are named like the plugin (or `events_…`). */
export const Events = defineEntity('events', {
  label: { en: 'Events', cs: 'Akce', de: 'Veranstaltungen' },
  labelSingular: { en: 'Event', cs: 'Akce', de: 'Veranstaltung' },
  description: { en: 'Things happening on a date, such as races and meetings.', cs: 'Věci, které se dějí v určitý den: závody, schůzky.', de: 'Dinge, die an einem bestimmten Tag stattfinden, etwa Rennen und Treffen.' },
  icon: 'i-lucide-calendar-days',
  titleField: 'title',
  admin: { list: { columns: ['title', 'startsAt', 'place', 'capacity'], searchable: ['title', 'place'] } },
  fields: {
    title: f.text({ required: true, max: 200 }).label({ en: 'Title', cs: 'Název', de: 'Titel' }),
    startsAt: f.datetime().label({ en: 'Starts', cs: 'Začátek', de: 'Beginn' }),
    place: f.text().optional().label({ en: 'Place', cs: 'Místo', de: 'Ort' }),
    capacity: f.number({ min: 0 }).optional().label({ en: 'Capacity', cs: 'Kapacita', de: 'Kapazität' }),
  },
})

export function eventsPlugin() {
  return defineCmsPlugin({
    name: 'events',
    version: '0.1.0',
    entities: [Events],
    serverHandlers: [
      // Signed-in people (the default): the numbers the admin page shows.
      { method: 'get', route: '/summary', handler: pluginFile(import.meta.url, './server/summary.get.ts') },
      // Administrators only.
      { method: 'post', route: '/clear-past', access: 'admin', handler: pluginFile(import.meta.url, './server/clear-past.post.ts') },
      // Anyone, on the plugin's address and on the public content API (`/api/content/_events/next`).
      { method: 'get', route: '/next', contentPath: '_events/next', access: 'public', handler: pluginFile(import.meta.url, './server/next.get.ts') },
    ],
    // Started with the server (a Nitro plugin).
    serverPlugins: [pluginFile(import.meta.url, './server/startup.ts')],
    adminPages: [{ path: '', file: pluginFile(import.meta.url, './pages/index.vue') }],
    navItems: [{ label: { en: 'Events overview', cs: 'Přehled akcí', de: 'Übersicht der Veranstaltungen' }, icon: 'i-lucide-chart-no-axes-column', page: '' }],
    i18n: {
      en: { title: 'Events overview', description: 'What is coming up and what is behind us.', total: 'All events', upcoming: 'Coming up', next: 'Next event', none: 'No event is planned.', open: 'Open the events', clearPast: 'Remove past events', cleared: 'Removed {count} past events.' },
      cs: { title: 'Přehled akcí', description: 'Co nás čeká a co už je za námi.', total: 'Všechny akce', upcoming: 'Nadcházející', next: 'Nejbližší akce', none: 'Žádná akce není naplánovaná.', open: 'Otevřít akce', clearPast: 'Odstranit proběhlé akce', cleared: 'Odstraněno proběhlých akcí: {count}.' },
      de: { title: 'Übersicht der Veranstaltungen', description: 'Was bevorsteht und was hinter uns liegt.', total: 'Alle Veranstaltungen', upcoming: 'Bevorstehend', next: 'Nächste Veranstaltung', none: 'Keine Veranstaltung geplant.', open: 'Veranstaltungen öffnen', clearPast: 'Vergangene Veranstaltungen entfernen', cleared: '{count} vergangene Veranstaltungen entfernt.' },
    },
    upgrades: [
      {
        id: 'backfill-place',
        description: 'Events saved without a place get "To be announced"',
        phase: 'after',
        // The step is idempotent (nothing is left to change the second time).
        run: async ({ run }) => { await run(`update "events" set "place" = 'To be announced' where "place" is null`) },
      },
    ],
  })
}
