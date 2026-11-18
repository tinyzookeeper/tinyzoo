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
    cs: { title: 'Co znamená tinyzoo 1.0', text: 'Po aktualizaci v rámci verze 1 bude váš web dál fungovat bez úprav. Příručku pro editory i dokumentaci pro vývojáře najdete na tomto webu.' },
    en: { title: 'What tinyzoo 1.0 means', text: 'Your website keeps working after updates within version 1, with no rework needed. You’ll find the guide for editors and the developer documentation on this site.' },
    de: { title: 'Was tinyzoo 1.0 bedeutet', text: 'Bei Updates innerhalb der Version 1 läuft Ihre Website ohne Anpassungen weiter. Das Handbuch für Redakteure und die Dokumentation für Entwickler finden Sie auf dieser Website.' },
  },
  // ── next (1.1) ──
  {
    stage: 'next', version: '1.1', animal: 'bird',
    cs: { title: 'Překlady ke kontrole', text: 'Překladatel předá hotový překlad ke kontrole. Editor dostane upozornění v administraci a na přání i e-mailem.' },
    en: { title: 'Translations for review', text: 'Translators mark finished translations for review. Editors get a notification in the admin area and can choose to get it by email too.' },
    de: { title: 'Übersetzungen zur Prüfung', text: 'Übersetzer geben fertige Übersetzungen zur Prüfung weiter. Redakteure erhalten eine Benachrichtigung in der Verwaltung und auf Wunsch auch per E-Mail.' },
  },
  {
    stage: 'next', version: '1.1', animal: 'fox',
    cs: { title: 'Nastavení vzhledu administrace', text: 'Na nové stránce „Vzhled“ nastaví administrátor barvu i loga bez pomoci vývojáře.' },
    en: { title: 'Customise the admin area', text: 'The new ‘Look’ page lets administrators set the colour and logos without a developer.' },
    de: { title: 'Die Verwaltung selbst gestalten', text: 'Auf der neuen Seite „Aussehen“ legen Administratoren Farbe und Logos ohne Hilfe eines Entwicklers fest.' },
  },
  // ── later ──
  {
    stage: 'later', animal: 'elephant',
    cs: { title: 'Správa více webů', text: 'Přihlásíte se jednou a všechny své weby budete spravovat z jedné administrace.' },
    en: { title: 'Manage multiple websites', text: 'Sign in once and manage all your websites from the same admin area.' },
    de: { title: 'Mehrere Websites verwalten', text: 'Sie melden sich einmal an und betreuen alle Ihre Websites in derselben Verwaltung.' },
  },
  {
    stage: 'later', animal: 'frog',
    cs: { title: 'Nahrávání obsahu z tabulek', text: 'Seznam produktů, akcí nebo kontaktů nahrajete rovnou z tabulky, třeba z Excelu.' },
    en: { title: 'Import from spreadsheets', text: 'Add lists of products, events or contacts straight from a spreadsheet, such as an Excel file.' },
    de: { title: 'Inhalte aus Tabellen übernehmen', text: 'Übernehmen Sie Listen mit Produkten, Veranstaltungen oder Kontakten direkt aus einer Tabelle, etwa aus Excel.' },
  },
  {
    stage: 'later', animal: 'bird',
    cs: { title: 'Vlastní úvodní stránka administrace', text: 'Sami si vyberete, co se zobrazí na úvodní stránce administrace. Po ruce tak budete mít třeba nové zprávy z webu nebo obsah, který čeká na zveřejnění.' },
    en: { title: 'Your admin home page', text: 'Choose what appears on the admin home page, such as new messages from your website or content waiting to go live.' },
    de: { title: 'Ihre Startseite in der Verwaltung', text: 'Sie wählen, was auf der Startseite Ihrer Verwaltung erscheint. So haben Sie etwa neue Nachrichten von Ihrer Website oder anstehende Veröffentlichungen im Blick.' },
  },
  {
    stage: 'later', animal: 'octopus',
    cs: { title: 'Mobilní aplikace pro editory', text: 'V aplikaci napíšete novinku a přidáte fotky přímo z telefonu. Zveřejníte ji odkudkoli.' },
    en: { title: 'Mobile app for editors', text: 'Write a news post in the app and add photos from your phone. Publish it wherever you are.' },
    de: { title: 'Eine App für die Redaktion', text: 'In der App schreiben Sie einen Beitrag und fügen Fotos direkt vom Smartphone hinzu. Veröffentlichen können Sie ihn von überall.' },
  },
  {
    stage: 'later', animal: 'bunny',
    cs: { title: 'Přenos obsahu do tinyzoo', text: 'Texty a obrázky ze svého webu přenesete do tinyzoo bez ručního kopírování.' },
    en: { title: 'Bring your content to tinyzoo', text: 'Move text and images from your existing website to tinyzoo without copying them by hand.' },
    de: { title: 'Website-Inhalte übernehmen', text: 'Übertragen Sie Texte und Bilder Ihrer bisherigen Website in tinyzoo, ohne sie von Hand zu kopieren.' },
  },
  {
    stage: 'later', animal: 'fox',
    cs: { title: 'Web z hotových šablon', text: 'Tuto verzi tinyzoo budeme provozovat za vás. Stránky si v ní poskládáte z hotových šablon bez pomoci vývojáře.' },
    en: { title: 'Build a website from templates', text: 'We’ll run this version of tinyzoo for you. You’ll build your pages from ready-made templates without a developer.' },
    de: { title: 'Ihre Website aus Vorlagen', text: 'Wir betreiben diese Version von tinyzoo für Sie. Mit fertigen Vorlagen erstellen Sie Ihre Seiten ohne Hilfe eines Entwicklers.' },
  },
  // ── done, newest first ──
  {
    stage: 'done', version: '0.7', animal: 'koala',
    cs: { title: 'Firemní logo a barva', text: 'Logo a barvu vaší firmy uvidíte v administraci i v e-mailech, třeba v pozvánkách nebo ve zprávách pro obnovu hesla.' },
    en: { title: 'Your logo and brand colour', text: 'Your company’s logo and colour appear in the admin area and in emails such as invitations and password resets.' },
    de: { title: 'Ihr Logo und Ihre Markenfarbe', text: 'Das Logo und die Farbe Ihres Unternehmens erscheinen in der Verwaltung und in E-Mails, etwa in Einladungen oder Nachrichten zum Zurücksetzen des Passworts.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'owl',
    cs: { title: 'Přehled chybějících překladů', text: 'Na úvodní stránce administrace překladatelé vidí, které texty čekají na překlad. Jedním kliknutím si je otevřou v příslušném jazyce.' },
    en: { title: 'Find missing translations', text: 'Translators can see what needs translating on the admin home page. A single click opens the entry in the right language.' },
    de: { title: 'Fehlende Übersetzungen finden', text: 'Auf der Startseite der Verwaltung sehen Übersetzer, welche Texte noch auf eine Übersetzung warten. Mit einem Klick öffnen sie den Eintrag in der passenden Sprache.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'whale',
    cs: { title: 'Samostatné zveřejňování překladů', text: 'Překlad zveřejníte, až bude hotový. Do té doby zůstává na webu původní jazyková verze.' },
    en: { title: 'Publish translations separately', text: 'Publish each translation when it’s ready. In the meantime, visitors can read the original.' },
    de: { title: 'Übersetzungen einzeln veröffentlichen', text: 'Sie können jede Übersetzung einzeln veröffentlichen, sobald sie fertig ist. Bis dahin bleibt die ursprüngliche Sprachfassung auf der Website verfügbar.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'hedgehog',
    cs: { title: 'Vlastní role v týmu', text: 'K rolím administrátora, editora a autora můžete přidat vlastní, třeba překladatele. U každého pole určíte, kdo ho smí upravovat.' },
    en: { title: 'Custom roles for your team', text: 'Add roles such as translator alongside administrator, editor and author. Set who can edit each field.' },
    de: { title: 'Eigene Rollen für Ihr Team', text: 'Ergänzen Sie die Rollen für Administratoren, Redakteure und Autoren um eigene Rollen, etwa für Übersetzer. Für jedes Feld legen Sie fest, wer es bearbeiten darf.' },
  },
  {
    stage: 'done', version: '0.6', animal: 'turtle',
    cs: { title: 'Rychlejší založení webu', text: 'Vývojář založí web jedním příkazem a rovnou vybere jeho jazyky i části. Obsah můžete upravovat od prvního dne.' },
    en: { title: 'Set up a website faster', text: 'Your developer sets up the website with one command and chooses its languages and sections. You can edit content from day one.' },
    de: { title: 'Schneller zur eigenen Website', text: 'Ihr Entwickler richtet die Website mit einem Befehl ein und wählt dabei Sprachen und Bereiche aus. Sie können die Inhalte vom ersten Tag an bearbeiten.' },
  },
  {
    stage: 'done', version: '0.2', animal: 'penguin',
    cs: { title: 'Rozšíření webu', text: 'Web můžete rozšířit o funkce, které mají vlastní místo v administraci. První doplněk přidává formuláře i přehled zpráv od návštěvníků.' },
    en: { title: 'Extend your website', text: 'Add features with their own section in the admin area. The first add-on gives you forms and a place to read messages from visitors.' },
    de: { title: 'Ihre Website erweitern', text: 'Neue Funktionen erhalten einen eigenen Bereich in der Verwaltung. Die erste Erweiterung bringt Formulare und eine Übersicht der eingegangenen Nachrichten.' },
  },
  {
    stage: 'done', version: '0.2', animal: 'elephant',
    cs: { title: 'Od návrhu ke zveřejnění', text: 'Stránky skládáte z hotových částí a hned vidíte náhled. Články můžete zveřejnit hned nebo v naplánovaný čas a starší verzi kdykoli obnovit.' },
    en: { title: 'From draft to publication', text: 'Build pages from ready-made sections and preview them as you go. Publish articles straight away or schedule them, and restore earlier versions at any time.' },
    de: { title: 'Vom Entwurf zur Veröffentlichung', text: 'Sie bauen Seiten aus fertigen Bausteinen und sehen sofort eine Vorschau. Beiträge veröffentlichen Sie sofort oder zum gewählten Termin und können jederzeit eine frühere Fassung wiederherstellen.' },
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
