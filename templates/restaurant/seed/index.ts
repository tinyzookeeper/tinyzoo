import { defineSeed } from 'tinyzoo'
import { demoFor, seedLook, uploadPhotos } from 'tinyzoo-template-kit/seed'
import { DailyMenu, Dish, Event, MenuCategory, Navigation, Page, SiteSettings, Supplier } from '../cms.config'
import { addDays, clockOf } from '../app/utils/site'
import { looks } from '../looks'
import { demo as shared, demoByLook, words } from '../texts/cs'
import { PHOTOS } from './photos'

// The demo content of the Restaurant template: the fictional bistro Kmín in Jičín. One set of
// content for all three looks; every text of it is in texts/cs.ts.
//
// The cloud runs it against a site it has just started (`pnpm seed` here, with SEED_URL and
// the service account in the environment); by hand:
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm seed
//
// It is safe to run again: entries are recognised by their name (pages by their address, a
// day's lunch by its date), and what is already as written here is left alone. The site's settings
// are only written when there are none yet, so a second run never undoes the owner's look or name.
//
// The lunch menus and the events are dated from the day the seed runs, so a demo site always has
// today's (or the next weekday's) lunch and three events coming.

/** The weekday of a day, Monday 0. */
const weekdayOf = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7

/** The weekday's name in Czech, lower case: "pátek". */
const weekdayName = (date: string) => new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

/** A day (all-day dates are stored at 0:00 in Europe/Prague) as the moment the admin stores. */
function dayStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const utc = Date.UTC(y!, m! - 1, d!)
  const ms = [utc - 3_600_000, utc - 7_200_000].find((t) => clockOf(t).date === date && clockOf(t).hour === 0) ?? utc
  return new Date(ms).toISOString()
}

export default defineSeed(async (s) => {
  const { doc, p, h2, ul } = s.rich
  // The look the site is made in: its design's wording, and the sections its design has.
  const look = looks.all.find((l) => l.id === seedLook(looks))!
  const demo = demoFor(shared, demoByLook, look.id)

  // ── photographs ──
  const photo = await uploadPhotos(s, 'seed/media', PHOTOS)
  const week = await s.upload('seed/media/tyden.pdf', { name: 'menu-na-tyden.pdf', mime: 'application/pdf' })

  // ── the menu: its sections, then the dishes in them ──
  const category: Record<string, string> = {}
  for (const [position, c] of demo.menuBlock.categories.entries()) {
    category[c.slug] = (await s.upsert(MenuCategory, { position, name: c.name, slug: c.slug, opensFirst: 'opensFirst' in c ? c.opensFirst : false })).id
  }
  let position = 0
  for (const [slug, dishes] of Object.entries(demo.menuBlock.dishes)) {
    for (const [name, description, price, amount, allergens, vegetarian] of dishes) {
      await s.upsert(Dish, { position: position++, name, description, category: category[slug]!, price, amount, allergens, vegetarian, hidden: false }, { by: 'name' })
    }
  }

  // ── the lunch: the next five weekdays from today, the two menus taking turns ──
  let day = clockOf(Date.now()).date
  while (weekdayOf(day) > 4) day = addDays(day, 1)
  for (let i = 0; i < 5; i++) {
    while (weekdayOf(day) > 4) day = addDays(day, 1)
    const { soup, mains } = demo.lunch.days[i % demo.lunch.days.length]!
    await s.upsert(DailyMenu, {
      date: dayStart(day), soupName: soup.name, soupAmount: soup.amount, soupPrice: soup.price, soupAllergens: soup.allergens,
      mains: mains.map((m) => ({ ...m })),
    }, { by: 'date' })
    day = addDays(day, 1)
  }

  // ── events: a weekend, a Sunday a week after it, a Saturday a month on ──
  const today = clockOf(Date.now()).date
  let friday = addDays(today, 1)
  while (weekdayOf(friday) !== 4) friday = addDays(friday, 1)
  const sunday = addDays(friday, 2)
  const brunch = addDays(sunday, 7)
  const evening = addDays(friday, 29)
  const [first, second, third] = demo.events.items
  await s.upsert(Event, { ...first!, dateFrom: dayStart(friday), dateTo: dayStart(sunday), timeNote: demo.events.when.weekend(weekdayName(friday), weekdayName(sunday)) }, { by: 'title' })
  await s.upsert(Event, { ...second!, dateFrom: dayStart(brunch), dateTo: null, timeNote: demo.events.when.brunch(weekdayName(brunch)) }, { by: 'title' })
  await s.upsert(Event, { ...third!, dateFrom: dayStart(evening), dateTo: null, timeNote: demo.events.when.evening(weekdayName(evening)) }, { by: 'title' })

  // ── the suppliers ──
  for (const [position, [name, supplier, distance]] of demo.kitchen.suppliers.entries()) await s.upsert(Supplier, { position, name, supplier, distance }, { by: 'position' })

  // ── the privacy page ──
  const privacy = await s.upsert(Page, {
    title: demo.privacy.title, slug: 'ochrana-osobnich-udaju', status: 'published',
    sections: [{
      type: 'text', heading: demo.privacy.title,
      body: doc(
        p('Ukázkový text. Před zveřejněním popište, jak s údaji hostů nakládáte vy.'),
        h2('Jaké údaje zpracováváme'),
        p('Z rezervačního formuláře máme vaše jméno, telefon, den, čas a počet osob. Telefon používáme jen k potvrzení stolu.'),
        h2('Proč údaje potřebujeme'),
        ul('abychom vám mohli potvrdit rezervaci', 'abychom věděli, kolik stolů připravit', 'abychom vám mohli zavolat, kdyby se něco změnilo'),
        h2('Jak dlouho je uchováváme'),
        p('Rezervaci smažeme týden po návštěvě. Návštěvnost webu měříme bez osobních údajů.'),
      ),
    }],
  })

  // ── the one page: every section is a block, reached from the menu by its anchor ──
  const to = (section: keyof typeof words.anchors) => `/#${words.anchors[section]}`
  const o = demo.opening
  await s.upsert(Page, {
    title: demo.home.title, slug: 'home', status: 'published', ogImage: photo.hero,
    metaDescription: demo.settings.metaDescription,
    sections: [
      {
        type: 'opening', eyebrow: o.eyebrow, heading: o.heading, text: o.text,
        image: photo.hero, imageCaption: o.imageCaption, plateImage: look.id === 'talir' ? photo.svickova : null,
        primaryLabel: o.primaryLabel, primaryUrl: to('reservation'), secondaryLabel: o.secondaryLabel, secondaryUrl: to('lunch'),
        openNote: o.openNote, openLinkLabel: o.openLinkLabel, whereNote: o.whereNote, whereLinkLabel: o.whereLinkLabel, bookNote: o.bookNote, bookLinkLabel: o.bookLinkLabel,
      },
      {
        type: 'lunch', eyebrow: demo.lunch.eyebrow, heading: demo.lunch.heading, text: demo.lunch.text, served: demo.lunch.served,
        image: photo.polevka, imageCaption: demo.lunch.imageCaption, listNote: demo.lunch.listNote, sideText: demo.lunch.sideText, weekLabel: demo.lunch.weekLabel, weekFile: week,
      },
      {
        type: 'menu', heading: demo.menuBlock.heading, text: demo.menuBlock.text, validFrom: demo.menuBlock.validFrom ? dayStart(demo.menuBlock.validFrom) : null,
        plateImage: look.id === 'talir' ? photo.pstruh : null,
        // (the dish shown large under the menu card is Salon's)
        ...(look.id === 'salon' ? { featureImage: photo.kachna, featureLabel: demo.menuBlock.featureLabel, featureTitle: demo.menuBlock.featureTitle, featureText: demo.menuBlock.featureText } : { featureImage: null, featureLabel: '', featureTitle: '', featureText: '' }),
      },
      {
        type: 'kitchen', eyebrow: demo.kitchen.eyebrow, heading: demo.kitchen.heading, text: demo.kitchen.text, signature: demo.kitchen.signature,
        image: photo.kuchar, imageCaption: demo.kitchen.imageCaption, suppliersHeading: demo.kitchen.suppliersHeading, deliveryNote: demo.kitchen.deliveryNote,
        secondImage: photo.suroviny, secondCaption: demo.kitchen.secondCaption,
      },
      {
        type: 'gallery', eyebrow: demo.gallery.eyebrow, heading: demo.gallery.heading, linkLabel: demo.gallery.linkLabel,
        photos: demo.gallerySet.map(([key, caption, overhead]) => ({ image: photo[key as keyof typeof photo], caption, overhead })),
      },
      { type: 'events', eyebrow: demo.events.eyebrow, heading: demo.events.heading, text: demo.events.text, limit: 3 },
      {
        type: 'hours', eyebrow: demo.hours.eyebrow, heading: demo.hours.heading, placeLabel: demo.hours.placeLabel,
        image: photo.dum, imageCaption: demo.hours.imageCaption, ways: demo.hours.ways,
        planFrom: demo.hours.planFrom, planGate: demo.hours.planGate, planSquare: demo.hours.planSquare, planStreet: demo.hours.planStreet, planBus: demo.hours.planBus, planTrain: demo.hours.planTrain,
      },
      {
        type: 'reservation', eyebrow: demo.reservation.eyebrow, heading: demo.reservation.heading, text: demo.reservation.text, phoneLabel: demo.reservation.phoneLabel,
        note: demo.reservation.note, formNote: demo.reservation.formNote, times: demo.reservation.times.map((time) => ({ time })),
        defaultTime: demo.reservation.defaultTime, maxGuests: demo.reservation.maxGuests,
      },
    ],
  })

  // ── the menu: the sections of the page ──
  await s.global(Navigation, {
    main: [
      s.link(demo.menu.lunch, to('lunch')), s.link(demo.menu.menu, to('menu')), s.link(demo.menu.kitchen, to('kitchen')),
      s.link(demo.menu.events, to('events')), s.link(demo.menu.hours, to('hours')),
    ],
    legal: [s.link(demo.privacy.title, privacy)],
  })

  // ── settings: only when the site has none yet. The cloud writes the owner's name and look
  //    over these right after; a second run of the seed must not put the demo's back. ──
  const { hours, ...settings } = demo.settings
  await s.global(SiteSettings, {
    ...settings,
    look: look.id,
    colors: look.presets[0].id,
    openingHours: hours.map(([day, from, to]) => ({ day, from, to, closed: false })),
    ogImage: photo.hero,
  }, { ifMissing: true })
})
