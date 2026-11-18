// The plans the website starts with (the Plan collection, shown on the "Plány" page),
// in Czech, English and German. Editors change them in the admin afterwards, so
// seedPlans only adds what is missing and never changes or deletes a plan: a plan is
// matched by its Czech title, a missing one is added at the end of the list, and a
// matched one that has no English or German text yet gets it. So a run that stopped
// halfway (5 of 16 added) can be run again and finishes the set. A plan an editor
// deleted, or whose Czech title they changed, counts as missing and comes back: run
// it to fill a new or half-filled site, not on a site whose editors keep the plans.
// Used by scripts/seed.mjs and, on its own, by scripts/seed-plans.mjs.
//
// In this order: the page groups them by stage, and the admin's "Arrange" list then
// reads stage by stage too (now, next, later, done; done newest first).
export const PLANS = [
  // ── now ──
  {
    stage: 'now', version: '1.0', animal: 'bunny',
    cs: { title: 'tinyzoo 1.0', text: 'Dáváme slib: aktualizace v rámci verze 1 váš web nerozbijí. Příručku pro editory i dokumentaci pro vývojáře najdete přímo na tomto webu.' },
    en: { title: 'tinyzoo 1.0', text: 'Our promise: updates within version 1 will not break your website. The guide for editors and the documentation for developers are right here on this website.' },
    de: { title: 'tinyzoo 1.0', text: 'Unser Versprechen: Updates innerhalb von Version 1 machen auf Ihrer Website nichts kaputt. Die Anleitung für Redakteure und die Dokumentation für Entwickler finden Sie direkt auf dieser Website.' },
  },
  // ── next (1.1) ──
  {
    stage: 'next', version: '1.1', animal: 'bird',
    cs: { title: 'Překlad připravený ke kontrole', text: 'Překladatel označí hotový překlad ke kontrole. Editor se to dozví v administraci, a když chce, i e-mailem.' },
    en: { title: 'Translations ready for review', text: 'A translator marks a finished translation as ready for review. Editors see it in the admin area, and by email if they want.' },
    de: { title: 'Übersetzungen bereit zur Prüfung', text: 'Übersetzer markieren eine fertige Übersetzung als bereit zur Prüfung. Redakteure sehen das in der Verwaltung und auf Wunsch auch per E-Mail.' },
  },
  {
    stage: 'next', version: '1.1', animal: 'fox',
    cs: { title: 'Vzhled administrace bez vývojáře', text: 'Na nové stránce Vzhled nastaví administrátor barvu a loga administrace sám. Vývojáře k tomu nepotřebuje.' },
    en: { title: 'Set the admin’s look yourself', text: 'On a new Look page, an administrator sets the colour and the logos of the admin area. No developer needed.' },
    de: { title: 'Das Aussehen selbst einstellen', text: 'Auf einer neuen Seite „Aussehen“ stellt ein Administrator Farbe und Logos der Verwaltung selbst ein. Dafür braucht es keinen Entwickler.' },
  },
  // ── later ──
  {
    stage: 'later', animal: 'elephant',
    cs: { title: 'Více webů v jedné administraci', text: 'Máte víc webů? Budete je spravovat z jednoho místa, s jedním přihlášením.' },
    en: { title: 'Several websites in one admin area', text: 'Have more than one website? Manage them all from one place, with one sign-in.' },
    de: { title: 'Mehrere Websites in einer Verwaltung', text: 'Sie haben mehrere Websites? Pflegen Sie alle an einem Ort, mit einer Anmeldung.' },
  },
  {
    stage: 'later', animal: 'frog',
    cs: { title: 'Obsah z tabulky', text: 'Seznam produktů, akcí nebo kontaktů nahrajete z tabulky, třeba z Excelu. Nemusíte ho přepisovat ručně.' },
    en: { title: 'Content from a spreadsheet', text: 'Bring in a list of products, events or contacts from a spreadsheet such as Excel, instead of typing it in by hand.' },
    de: { title: 'Inhalte aus einer Tabelle', text: 'Eine Liste mit Produkten, Terminen oder Kontakten laden Sie aus einer Tabelle, etwa aus Excel, statt sie abzutippen.' },
  },
  {
    stage: 'later', animal: 'bird',
    cs: { title: 'Úvodní stránka administrace podle vás', text: 'Na úvodní stránku si dáte, co chcete mít na očích. Třeba nové zprávy z webu nebo to, co čeká na zveřejnění.' },
    en: { title: 'An admin home page that suits you', text: 'Put what you want to keep an eye on on the home page, such as new messages from your website or what is waiting to be published.' },
    de: { title: 'Eine Startseite nach Ihrem Bedarf', text: 'Legen Sie auf die Startseite der Verwaltung, was Sie im Blick behalten möchten, etwa neue Nachrichten von der Website oder was auf die Veröffentlichung wartet.' },
  },
  {
    stage: 'later', animal: 'octopus',
    cs: { title: 'Mobilní aplikace pro správu obsahu', text: 'Napíšete novinku, přidáte fotky přímo z telefonu a zveřejníte ji odkudkoli.' },
    en: { title: 'A mobile app for managing content', text: 'Write a news post, add photos straight from your phone and publish it from anywhere.' },
    de: { title: 'Eine mobile App zur Inhaltspflege', text: 'Schreiben Sie eine Neuigkeit, fügen Sie Fotos direkt vom Smartphone hinzu und veröffentlichen Sie sie von überall.' },
  },
  {
    stage: 'later', animal: 'bunny',
    cs: { title: 'Přenos obsahu ze stávajícího webu', text: 'Texty a obrázky z vašeho dosavadního webu přenesete do tinyzoo snadno. Nebudete je muset kopírovat ručně.' },
    en: { title: 'Moving content from your existing website', text: 'Bring the text and pictures from your current website into tinyzoo easily, without copying them by hand.' },
    de: { title: 'Inhalte von Ihrer bisherigen Website übernehmen', text: 'Texte und Bilder Ihrer bisherigen Website übernehmen Sie einfach in tinyzoo, ohne sie von Hand zu kopieren.' },
  },
  {
    stage: 'later', animal: 'fox',
    cs: { title: 'Zvažujeme: web z hotových šablon', text: 'Přemýšlíme o verzi, kterou bychom provozovali za vás. Stránky byste v ní skládali z hotových šablon, bez vývojáře. Zatím o ní nemáme rozhodnuto.' },
    en: { title: 'Under consideration: a website from ready-made templates', text: 'We are thinking about a version that we would run for you. You would build your pages from ready-made templates, without a developer. Nothing is decided yet.' },
    de: { title: 'Wir überlegen: eine Website aus fertigen Vorlagen', text: 'Wir denken über eine Version nach, die wir für Sie betreiben würden. Ihre Seiten würden Sie darin ohne Entwickler aus fertigen Vorlagen zusammenstellen. Entschieden ist noch nichts.' },
  },
  // ── done, newest first ──
  {
    stage: 'done', version: '0.7', animal: 'koala',
    cs: { title: 'Vaše logo a barva v administraci', text: 'Administrace nese logo a barvu vaší firmy. Stejně tak e-maily, které z ní chodí, třeba pozvánky a obnovení hesla.' },
    en: { title: 'Your logo and colour in the admin area', text: 'The admin area shows your company’s logo and brand colour. So do the emails it sends, such as invitations and password resets.' },
    de: { title: 'Ihr Logo und Ihre Farbe in der Verwaltung', text: 'Die Verwaltung zeigt das Logo und die Markenfarbe Ihres Unternehmens. Ebenso die E-Mails, die sie verschickt, etwa Einladungen und das Zurücksetzen des Passworts.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'owl',
    cs: { title: 'Co čeká na překlad', text: 'Na úvodní stránce administrace vidí překladatelé, které texty ještě nejsou přeložené. Jedním klepnutím se pustí do práce.' },
    en: { title: 'A list of what needs translating', text: 'The admin’s home page shows translators which texts are not translated yet. One click and they can start.' },
    de: { title: 'Was auf Übersetzung wartet', text: 'Auf der Startseite der Verwaltung sehen Übersetzer, welche Texte noch nicht übersetzt sind. Ein Klick, und sie können loslegen.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'whale',
    cs: { title: 'Každý jazyk se zveřejňuje zvlášť', text: 'Překlad dopíšete v klidu a zveřejníte, až bude hotový. Návštěvníci do té doby vidí původní verzi.' },
    en: { title: 'Each language is published on its own', text: 'Finish a translation at your own pace and publish it when it is ready. Until then, visitors see the original.' },
    de: { title: 'Jede Sprache wird einzeln veröffentlicht', text: 'Eine Übersetzung schreiben Sie in Ruhe fertig und veröffentlichen sie, wenn sie bereit ist. Bis dahin sehen Besucher das Original.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'hedgehog',
    cs: { title: 'Role na míru', text: 'Kromě administrátora, editora a autora může mít web vlastní role, třeba překladatele. U jednotlivých polí určíte, kdo je smí měnit.' },
    en: { title: 'Roles that fit your team', text: 'Besides administrator, editor and author, your website can have roles of its own, such as a translator. For each field you decide who may change it.' },
    de: { title: 'Rollen nach Maß', text: 'Neben Administrator, Redakteur und Autor kann Ihre Website eigene Rollen haben, etwa für Übersetzer. Für einzelne Felder legen Sie fest, wer sie ändern darf.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'turtle',
    cs: { title: 'Nový web rychleji', text: 'Vývojář založí nový web jedním příkazem a vybere jeho jazyky a části. Správa obsahu je připravená od prvního dne.' },
    en: { title: 'A new website, ready sooner', text: 'Your developer starts a new website with one command and picks its languages and sections. Content management is ready from day one.' },
    de: { title: 'Eine neue Website, schneller startklar', text: 'Ihr Entwickler legt eine neue Website mit einem Befehl an und wählt Sprachen und Bereiche. Die Inhaltspflege ist vom ersten Tag an bereit.' },
  },
  {
    stage: 'done', version: '0.2', animal: 'penguin',
    cs: { title: 'Doplňky pro váš web', text: 'Web může růst o další části s vlastním místem v administraci. Prvním doplňkem jsou formuláře a zprávy, které přes ně přijdou.' },
    en: { title: 'Add-ons for your website', text: 'Your website can grow with new parts that get their own place in the admin area. The first add-on is forms, with the messages they bring in.' },
    de: { title: 'Erweiterungen für Ihre Website', text: 'Ihre Website kann um neue Teile wachsen, jeder mit eigenem Platz in der Verwaltung. Die erste Erweiterung sind Formulare mit den Nachrichten, die darüber eingehen.' },
  },
  {
    stage: 'done', version: '0.2', animal: 'elephant',
    cs: { title: 'Psaní, náhled a zveřejnění', text: 'Stránky skládáte z hotových částí a hned vidíte náhled. Článek zveřejníte hned nebo naplánujete. Ke starší verzi se kdykoli vrátíte.' },
    en: { title: 'Writing, preview and publishing', text: 'Build pages from ready-made sections and see the preview straight away. Publish an article now or schedule it. Go back to an older version at any time.' },
    de: { title: 'Schreiben, Vorschau und Veröffentlichen', text: 'Seiten bauen Sie aus fertigen Bausteinen und sehen sofort die Vorschau. Einen Artikel veröffentlichen Sie sofort oder zu einem geplanten Termin. Zu einer älteren Fassung kehren Sie jederzeit zurück.' },
  },
]

/**
 * Add the plans the site does not have yet (by Czech title), and the English or German
 * text of a seeded plan that lacks it. `req(method, path, body)` is the caller's signed-in
 * admin API request (it throws on an error status). Returns how many plans it added.
 */
export async function seedPlans(req) {
  // Every plan the site has (the admin API gives at most 100 a page).
  const existing = []
  for (let page = 1; ; page++) {
    const res = await req('GET', `/api/cms/plan?limit=100&page=${page}`)
    const rows = res?.rows ?? []
    existing.push(...rows)
    if (!rows.length || existing.length >= (res?.total ?? 0)) break
  }
  const byTitle = new Map(existing.map((row) => [String(row.title ?? '').trim(), row]))
  let position = Math.max(0, ...existing.map((row) => Number(row.position) || 0))
  let added = 0
  let translated = 0
  for (const plan of PLANS) {
    const { cs, en, de, ...shared } = plan
    const found = byTitle.get(cs.title)
    if (found) {
      // Seeded before: add a translation only where there is none (a run that stopped after the Czech).
      const { row } = await req('GET', `/api/cms/plan/${found.id}`)
      const have = new Set(row?.__locales ?? [])
      for (const [locale, text] of [['en', en], ['de', de]]) {
        if (have.has(locale)) continue
        await req('PATCH', `/api/cms/plan/${found.id}?locale=${locale}`, text)
        translated++
      }
      continue
    }
    const res = await req('POST', '/api/cms/plan', { ...cs, version: null, ...shared, position: ++position })
    const id = (res.row ?? res).id
    await req('PATCH', `/api/cms/plan/${id}?locale=en`, en)
    await req('PATCH', `/api/cms/plan/${id}?locale=de`, de)
    added++
  }
  const kept = existing.length ? `, ${existing.length} the site had left as they were` : ''
  const filled = translated ? `, ${translated} missing translation${translated === 1 ? '' : 's'} added` : ''
  console.log(added || translated ? `✓ plans: ${added} added (cs, en, de)${filled}${kept}` : `· plans: the site has all ${PLANS.length}, left alone`)
  return added
}
