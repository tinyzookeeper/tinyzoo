// Fill the website with its content through the admin API (the same way an editor
// would): pages, updates, menus, settings and the videos.
//
//   SEED_URL=http://localhost:3000 SEED_EMAIL=… SEED_PASSWORD=… pnpm seed
//
// On an empty site it creates the first administrator with these details. Run it
// once on a fresh database; it does not delete anything.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const base = (process.env.SEED_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const email = process.env.SEED_EMAIL ?? 'admin@example.com'
const password = process.env.SEED_PASSWORD
if (!password) { console.error('Set SEED_PASSWORD (and SEED_EMAIL) for the administrator.'); process.exit(2) }
const MEDIA = join(dirname(fileURLToPath(import.meta.url)), '../seed/media')

let cookie = ''
async function req(method, path, body) {
  const headers = { accept: 'application/json', origin: base }
  if (cookie) headers.cookie = cookie
  let payload
  if (body instanceof FormData) payload = body
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(base + path, { method, headers, body: payload, redirect: 'manual' })
  const set = res.headers.getSetCookie(); if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ')
  const text = await res.text(); let json = text; try { json = JSON.parse(text) } catch {}
  if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  return json
}
const id = () => Math.random().toString(36).slice(2, 10)
const item = (fields) => ({ id: id(), type: 'item', ...fields })
const p = (...parts) => ({ type: 'paragraph', content: parts.map((t) => (typeof t === 'string' ? { type: 'text', text: t } : t)) })
const h2 = (text) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })
const ul = (...items) => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) })
const doc = (...content) => ({ type: 'doc', content })
// A link inside a paragraph: p('See ', a('the guide', '/en/docs/editors'), '.')
const a = (text, href) => ({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })

// ── sign in (or set up the first administrator) ──
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/admin/login`)).ok) break } catch {} await new Promise((r) => setTimeout(r, 500)) }
const status = await req('GET', '/api/cms/_auth/status').catch(() => null)
// A production site asks for its setup code (NUXT_CMS_AUTH_SETUP_TOKEN) before the first account.
if (status?.needsSetup) await req('POST', '/api/cms/_auth/setup', { name: 'tinyzoo', email, password, token: process.env.SEED_SETUP_TOKEN || undefined })
else await req('POST', '/api/cms/_auth/login', { email, password })

async function upload(file, mime) {
  const fd = new FormData()
  fd.append('file', new Blob([readFileSync(join(MEDIA, file))], { type: mime }), file)
  fd.append('library', '1')
  return req('POST', '/api/cms/_media', fd)
}
const video = {}
for (const v of ['link', 'form', 'duplicate', 'menu']) video[v] = (await upload(`${v}.mp4`, 'video/mp4')).id
// The same clips recorded in the English and German admin (<clip>.<lang>.mp4), for those pages.
const videoIn = { cs: video }
for (const lang of ['en', 'de']) {
  videoIn[lang] = {}
  for (const v of Object.keys(video)) {
    videoIn[lang][v] = existsSync(join(MEDIA, `${v}.${lang}.mp4`)) ? (await upload(`${v}.${lang}.mp4`, 'video/mp4')).id : video[v]
  }
}
// Illustrations (generated for tinyzoo, no client data): covers, pictures in text, sharing.
const img = {}
for (const i of ['blocks', 'forms', 'links', 'testing', 'collab', 'preview', 'schedule', 'desk', 'search']) img[i] = await upload(`${i}.jpg`, 'image/jpeg')
const picture = (m, alt) => ({ type: 'image', attrs: { src: m.url, mediaId: m.id, alt } })

// ── pages ──
// Created entries by their Czech address, so the translations below can find them.
const created = { page: {}, news: {} }
const page = async (title, slug, sections, extra = {}) => {
  const res = await req('POST', '/api/cms/page', { title, slug, status: 'published', sections, ...extra })
  created.page[slug] = (res.row ?? res).id
}

await page('Úvod', 'home', [
  {
    id: id(), type: 'hero', eyebrow: null,
    // Další možnosti: „Váš web. Úpravy v klidu.“ / „Místo, kde se staráte o svůj web.“ / „Pište, skládejte, zveřejňujte.“
    heading: 'Ať se vám web dobře upravuje.',
    text: 'Web postavíme společně s vámi. K němu dostanete tinyzoo: českou administraci, kde píšete články, skládáte stránky a zveřejňujete obsah.\nChceme, aby to byla příjemná, klidná práce. Zkuste si ukázku a řekněte nám, jak se vám v ní pracuje.',
    primaryLabel: 'Vyzkoušet administraci', primaryUrl: '/demo',
    secondaryLabel: 'Napsat nám postřehy', secondaryUrl: '/zpetna-vazba',
    video: video.link, image: null,
  },
  {
    id: id(), type: 'features', eyebrow: null,
    heading: 'Všechno potřebné máte po ruce.',
    text: 'Napište novinku, upravte stránku nebo si přečtěte zprávu z webu. Administrace je česky a funguje i na telefonu.',
    items: [
      item({ title: 'Texty, obrázky a odkazy', text: 'Pište s nadpisy i seznamy. K obrázku doplňte popis a určete, co má zůstat vidět při ořezu. Odkaz najdete podle názvu stránky.', animal: 'bunny' }),
      item({ title: 'Stránka podle vašich potřeb', text: 'Vyberte hotové části stránky: třeba karty, otázky a odpovědi nebo video. Pořadí změníte přetažením. Vedle hned vidíte náhled, i pro telefon.', animal: 'elephant' }),
      item({ title: 'Společně v jednom článku', text: 'Pište ve stejném článku s kolegou. Vidíte, kde druhý právě píše, a vaše změny se navzájem nepřepíšou.', animal: 'octopus' }),
      item({ title: 'Ještě kontrola před zveřejněním', text: 'Chybí povinný údaj nebo popis obrázku? Administrace vás upozorní a nechá vás ho rovnou doplnit.', animal: 'bird' }),
      item({ title: 'Zveřejníte, až budete připraveni', text: 'Článek můžete zveřejnit hned nebo vybrat den a čas. Historie verzí vám dovolí vrátit se ke starší podobě.', animal: 'frog' }),
      item({ title: 'Zprávy z webu pohromadě', text: 'Zprávy z formulářů najdete v administraci. Upozornění přijde e-mailem. Zprávy si také stáhnete jako tabulku pro Excel.', animal: 'fox' }),
    ],
  },
  {
    id: id(), type: 'showcase', eyebrow: null,
    heading: 'Čtyři drobné úkoly z běžného dne.',
    text: 'Krátká videa ukazují práci přímo v administraci. Stejné úpravy si pak můžete vyzkoušet sami.',
    items: [
      item({ title: 'Vložte odkaz podle názvu stránky', text: 'Označíte slova v textu a vyhledáte cílovou stránku. Její adresu nemusíte kopírovat.', video: video.link }),
      item({ title: 'Přečtěte si zprávu z webu', text: 'Návštěvník vyplní formulář a zpráva se objeví v administraci. E-mail vás upozorní, že přišla.', video: video.form }),
      item({ title: 'Upravte článek nebo začněte kopií', text: 'Projděte si seznam článků, otevřete jeden z nich a upravte ho. Nový článek můžete založit i jako kopii stávajícího.', video: video.duplicate }),
      item({ title: 'Přidejte druhou úroveň menu', text: 'Zařadíte stránku pod jinou položku. Na webu ji pak návštěvníci najdou v rozbalovacím menu.', video: video.menu }),
    ],
  },
  {
    id: id(), type: 'steps', eyebrow: null,
    heading: 'Od společného zadání k vašemu článku.',
    items: [
      item({ title: 'Společně připravíme web', text: 'Projdeme si, co má váš web umět a jaký obsah na něm budete měnit. Podle toho ho pro vás postavíme.' }),
      item({ title: 'Dostanete svou administraci', text: 'V tinyzoo najdete stránky, články i knihovnu obrázků. Tady se budete o obsah svého webu starat.' }),
      item({ title: 'Píšete a sledujete náhled', text: 'Doplňte text a obrázky nebo poskládejte stránku z hotových částí. V náhledu si ji prohlédnete ještě před zveřejněním.' }),
      item({ title: 'Zveřejníte ve svůj čas', text: 'Doplňte případné chybějící údaje a zveřejněte hotový obsah. Nebo zvolte den a čas, kdy se má na webu objevit.' }),
    ],
  },
  {
    id: id(), type: 'cta', heading: 'Zkuste si upravit vlastní článek.',
    text: 'V ukázkové administraci můžete zkoušet bez obav. Každou noc ji obnovujeme. Vaše postřehy nám pomohou před pilotem na prvním klientském webu.',
    primaryLabel: 'Otevřít ukázku', primaryUrl: '/demo', secondaryLabel: 'Podělit se o zkušenost', secondaryUrl: '/zpetna-vazba', animal: 'fox',
  },
  {
    id: id(), type: 'faq', heading: 'Než se pustíte do úprav',
    text: 'Pár odpovědí na to, co vás možná napadlo.',
    items: [
      item({ question: 'Potřebuji nejdřív školení?', answer: 'Ukázku si můžete otevřít a zkusit první článek rovnou. Na stránce s ukázkou najdete pár konkrétních úkolů. V pilotu chceme zjistit i to, kde lidé potřebují vysvětlení. Pokud se někde ztratíte, napište nám.' }),
      item({ question: 'Můžu při zkoušení něco pokazit?', answer: 'Ukázková administrace je tu na zkoušení. Každou noc ji vrátíme do výchozího stavu, takže nic nemůžete trvale pokazit. Ani vaše úpravy v ní nezůstanou. Na vlastním webu si rozepsaný obsah můžete nejdřív prohlédnout v náhledu.' }),
      item({ question: 'Co když stejný článek upravujeme dva?', answer: 'Můžete v něm psát současně. Každý vidí, kde právě píše druhý, a změny se navzájem nepřepíšou.' }),
      item({ question: 'Můžu se vrátit ke starší verzi?', answer: 'Ano. V historii verzí se můžete vrátit k dřívější podobě obsahu.' }),
      item({ question: 'Jak rychle najdu starší článek?', answer: 'Stiskněte ⌘K (ve Windows Ctrl+K) nebo klikněte na Hledat a napište kterékoli slovo z článku. Vyhledávání najde i koncepty a poradí si s překlepem.' }),
      item({ question: 'Funguje administrace na telefonu?', answer: 'Ano, obsah můžete upravovat i na telefonu. Náhled stránky navíc přepnete na zobrazení pro telefon, abyste viděli, jak bude vypadat návštěvníkům. Do budoucna plánujeme i samostatnou mobilní aplikaci.' }),
      item({ question: 'Je tinyzoo hotové? Můžu ho už zkusit?', answer: 'Ukázka je otevřená všem a každou noc se obnovuje. tinyzoo je nové. Má přes 350 automatických testů a před pilotem jsme v něm podrobně prošli všechny běžné úkoly editora. Nalezené chyby jsme opravili. Klienti ho při své práci zatím nepoužívali, to teprve ověříme v pilotu. O další vývoj i opravy se staráme sami.' }),
      item({ question: 'Co když potřebuji něco navíc?', answer: 'Řekněte nám, co potřebujete na webu dělat. Katalog hotových doplňků nemáme. Další možnosti připravujeme pro konkrétní web.' }),
    ],
  },
], { metaDescription: 'tinyzoo je česká administrace pro váš web. Pište články, skládejte stránky a prohlížejte si náhled. Zkuste ukázku a napište nám své postřehy.' })

await page('Plány', 'plany', [
  {
    id: id(), type: 'roadmap', eyebrow: null,
    heading: 'Na čem pracujeme a kam tinyzoo míří.',
    text: 'Tady jsou naše plány pro další vývoj tinyzoo. Pořadí vybíráme podle toho, co nám lidé říkají při zkoušení ukázky a při práci s obsahem.',
    items: [
      item({ title: 'Pilot na prvním klientském webu', text: 'Chystáme pilot na prvním klientském webu. Chceme poznat, jak skuteční editoři pracují s vlastním obsahem a kde potřebují pomoc.', stage: 'now', animal: 'bunny' }),
      item({ title: 'Úpravy podle postřehů z ukázky', text: 'Sbíráme postřehy, které nám posíláte z ukázky. Podle nich chceme dál upravovat administraci, aby se vám v ní dobře pracovalo.', stage: 'now', animal: 'bird' }),
      item({ title: 'Doplňkové moduly', text: 'Chceme připravit doplňkové moduly, se kterými by váš web mohl růst podle nových potřeb.', stage: 'next', animal: 'frog' }),
      item({ title: 'Role a oprávnění na míru', text: 'Chceme umožnit vlastní role a určit, kdo smí měnit které části obsahu. Pomůže to větším týmům a webům s více editory.', stage: 'next', animal: 'fox' }),
      item({ title: 'Mobilní aplikace pro správu obsahu', text: 'Stále víc lidí chce spravovat obsah rovnou z telefonu. Plánujeme aplikaci, ve které byste mohli napsat novinku, přidat fotky přímo z telefonu a zveřejnit ji odkudkoli.', stage: 'later', animal: 'octopus' }),
      item({ title: 'Přenos obsahu ze stávajícího webu', text: 'Chceme usnadnit přenos textů a obrázků z vašeho stávajícího webu do tinyzoo.', stage: 'later', animal: 'elephant' }),
    ],
    note: 'Plány se mohou měnit. Napište nám, co byste pro svůj web potřebovali.',
  },
  {
    id: id(), type: 'cta', heading: 'Co by pomohlo vám?',
    text: 'Zkuste si ukázku tinyzoo nebo nám napište, co při úpravách webu potřebujete. Vaše zkušenost nám pomůže vybrat další kroky.',
    primaryLabel: 'Vyzkoušet ukázku', primaryUrl: '/demo', secondaryLabel: 'Napsat nám', secondaryUrl: '/zpetna-vazba', animal: 'fox',
  },
], { metaDescription: 'Kam míří tinyzoo? Podívejte se na plány od prvního pilotu po mobilní aplikaci. Zkuste ukázku a napište nám, co byste potřebovali.' })

await page('Vyzkoušejte administraci', 'demo', [{
  id: id(), type: 'demo', heading: 'Zkuste si upravit web.',
  text: 'Ukázka je otevřená všem. Přihlaste se pomocí údajů na této stránce a pusťte se do úprav. Každou noc ji obnovujeme, takže nic nemůžete trvale pokazit. Vaše práce tu ale nezůstane. Tady je pár úkolů na začátek.',
  tips: [
    item({ text: 'Napište krátkou novinku s nadpisem a seznamem. Přidejte obrázek, jeho popis a vyberte část, která má zůstat vidět při ořezu.' }),
    item({ text: 'Označte několik slov a vložte odkaz. Cílovou stránku vyhledejte podle jejího názvu.' }),
    item({ text: 'Přidejte na stránku hotovou část a přesuňte ji přetažením. Prohlédněte si náhled i v zobrazení pro telefon.' }),
    item({ text: 'Připravte článek a naplánujte jeho zveřejnění na zítřejší ráno.' }),
    item({ text: 'Otevřete stejný článek ve dvou oknech. Pište střídavě v obou a sledujte, kde se změny objevují.' }),
    item({ text: 'Najděte zprávy z webového formuláře a stáhněte si je jako tabulku pro Excel.' }),
  ],
}], { metaDescription: 'Vyzkoušejte českou administraci tinyzoo. Napište novinku, upravte stránku a prohlédněte si náhled. Ukázku každou noc obnovujeme.' })

await page('Zpětná vazba', 'zpetna-vazba', [{
  id: id(), type: 'feedback', heading: 'Jak se vám v tinyzoo pracovalo?',
  text: 'Napište nám, co vám šlo snadno, kde jste se zarazili nebo co vám chybělo. Pomůže i drobný postřeh z jednoho úkolu. Vaše zkušenost nám pomůže připravit pilot na prvním klientském webu.',
}], { metaDescription: 'Zkusili jste tinyzoo? Napište nám, co se vám při úpravách webu dařilo a kde jste se zarazili. Vaše postřehy pomohou připravit pilot.' })

// ── for developers: the same product from the code side ──
const configCode = `import { defineEntity, f } from 'tinyzoo'

// Pole pro editora, typovaný obsah pro web.
export const News = defineEntity('news', {
  label: { cs: 'Aktuality', en: 'News' },
  titleField: 'title',
  fields: {
    title: f.text({ required: true }).localized(),
    slug: f.slug({ from: 'title', unique: true }),
    cover: f.media({ accept: 'image/*' }),
    body: f.richtext(),
  },
  content: { public: true, path: '/aktuality/:slug' },
})`
const pageCode = `<script setup lang="ts">
import type { News } from '~/lib/cms-content'

const { slug } = useRoute().params
const { data } = await useFetch<{ item: News }>(
  \`/api/content/news/\${slug}\`,
)
</script>

<template>
  <h1>{{ data?.item.title }}</h1>
  <CmsImage :media="data?.item.cover" />
  <CmsContent :doc="data?.item.body" />
</template>`

await page('Pro vývojáře', 'pro-vyvojare', [
  {
    id: id(), type: 'hero', eyebrow: null,
    // Další možnosti: „Ať se v Nuxtu dobře pracuje i s obsahem.“ / „Web v Nuxtu, včetně správy obsahu.“ / „Od modelu obsahu k české administraci.“
    heading: 'Správa obsahu přímo v Nuxtu.',
    text: 'Klientské weby stavíme v Nuxtu. K webu patří i místo, kde se klient stará o obsah. Proto vyvíjíme tinyzoo: CMS s modelem v TypeScriptu a českou administrací.\nWeb i správa obsahu běží v jedné aplikaci. Jeden projekt, jeden deploy.',
    primaryLabel: 'Vyzkoušet administraci', primaryUrl: '/demo',
    secondaryLabel: 'Co chystáme', secondaryUrl: '/plany',
    video: video.duplicate, image: null,
  },
  {
    id: id(), type: 'code', eyebrow: null,
    heading: 'Začněte obsahem, který web potřebuje.',
    text: 'V cms.config.ts popíšete články, bloky stránek i formuláře. Z modelu vznikne administrace. Přes generovaný klientský soubor se typy dostanou až do Vue šablon. tinyzoo je Nuxt layer a modul, který běží přímo ve vaší aplikaci.',
    files: [item({ name: 'cms.config.ts', code: configCode }), item({ name: 'pages/aktuality/[slug].vue', code: pageCode })],
    chips: 'defineEntity(), defineBlock(), definePages(), defineForm(), f.list()',
  },
  {
    id: id(), type: 'steps', eyebrow: null,
    heading: 'Od prvního příkazu ke správě obsahu.',
    items: [
      item({ title: 'Založte projekt', text: 'Příkaz pnpm create tinyzoo se zeptá na jazyky, části webu a ukázkový obsah a připraví základ projektu. Dál stavíte web v Nuxtu.', command: 'pnpm create tinyzoo' }),
      item({ title: 'Popište obsah', text: 'Do cms.config.ts zapište, jaký obsah bude klient upravovat. Z modelu se vygeneruje jeho administrace.', command: 'pnpm db:generate' }),
      item({ title: 'Nasaďte aplikaci', text: 'tinyzoo používá Node a Postgres. My nasazujeme přes Pushbase. Web i administraci nasadíte společně.', command: 'pnpm build' }),
      item({ title: 'Projděte web s klientem', text: 'Společně si vyzkoušejte úpravy obsahu, živý náhled a plánování zveřejnění. Je to příležitost zjistit, jak se klientovi s připraveným obsahem pracuje.' }),
    ],
  },
  {
    id: id(), type: 'faq', heading: 'Otázky vývojářů',
    items: [
      item({ question: 'Co už je součástí tinyzoo?', answer: 'Stránky z bloků, seznamy uvnitř bloků a formuláře. Dále menu s podpoložkami, přesměrování, SEO pole a překlady. Knihovna médií připravuje obrázky v potřebných velikostech na vyžádání. Při úpravách je k dispozici živý náhled, společné psaní v reálném čase, plánování zveřejnění a historie verzí. Návštěvníci webu i editoři mohou obsah prohledávat a vyhledávání si poradí i s překlepy.' }),
      item({ question: 'Co když potřebujeme něco navíc?', answer: 'Další možnosti píšeme jako vlastní moduly v kódu. Řekněte nám, co váš web potřebuje. Společně projdeme, jak ho rozšířit.' }),
      item({ question: 'Jak se dostaneme k obsahu?', answer: 'Obsah je uložený v běžných tabulkách Postgresu. K dispozici je také obsahové API popsané v OpenAPI. Ve Vue šablonách pracujete s typy z generovaného klientského souboru.' }),
      item({ question: 'Kdo se stará o údržbu?', answer: 'Vývoj i opravy zajišťujeme sami. Napříč weby aktualizujeme jeden balíček. tinyzoo je mladé. Přes 350 automatických testů a podrobná zkouška všech běžných úkolů editora nám pomáhají ověřovat jeho fungování. Zkušenosti z dalšího používání budeme sbírat postupně.' }),
    ],
  },
  {
    id: id(), type: 'cta', heading: 'Podívejte se na web očima editora.',
    text: 'Zkuste si upravit článek a prohlédnout náhled. Pak nám napište, jak se vám pracovalo a co byste pro svůj web potřebovali.',
    primaryLabel: 'Vyzkoušet administraci', primaryUrl: '/demo', secondaryLabel: 'Napsat nám postřehy', secondaryUrl: '/zpetna-vazba', animal: 'frog',
  },
], { metaDescription: 'tinyzoo pro weby v Nuxtu: model obsahu v TypeScriptu, česká administrace a typy až do Vue šablon. Poznejte model obsahu a práci s API.' })

// ── what's new ──
const days = (n) => new Date(Date.now() - n * 86400000).toISOString()
const covers = { 'seznamy-v-blocich': 'blocks', 'formulare': 'forms', 'odkazy-vyberem-stranky': 'links', 'opravy-z-testu': 'testing', 'spolecne-psani': 'collab', 'nahled-vedle-editoru': 'preview', 'planovani': 'schedule', 'vyhledavani': 'search' }
const update = async (title, slug, kind, ago, perex, body, extra = {}) => {
  const res = await req('POST', '/api/cms/news', {
    title, slug, kind, status: 'published', publishedAt: days(ago), perex, body, cover: img[covers[slug]]?.id ?? null, ...extra,
  })
  created.news[slug] = (res.row ?? res).id
}
// 0.6, called in this order so that the roles come first on the website (the same day, the newest last).
await update('Nový web jedním příkazem: pnpm create tinyzoo', 'pnpm-create-tinyzoo', 'feature', 0,
  'Příkaz se zeptá na jazyky, části webu a ukázkový obsah. Za pár minut máte web se správou obsahu, který rovnou spustíte.',
  doc(p('Vyberete jazyky webu (první je výchozí), části, které web potřebuje (aktuality, kontaktní formulář, přesměrování, vyhledávání), a jestli chcete ukázkový obsah. Co nechcete, v projektu vůbec nebude.'),
    p('Každá otázka má i přepínač, takže příkaz spustíte i bez ptaní: pnpm create tinyzoo muj-web --languages cs,en --presets news,search --no-demo --yes.'),
    p('Nový projekt má také soubor AGENTS.md. Je to krátký návod pro asistenta, se kterým programujete: kde je model obsahu, jak se mění a na co nesahat.'),
    p('Krok za krokem to popisuje ', a('návod Getting started', '/dokumentace/pro-vyvojare/getting-started'), ' v dokumentaci (zatím v angličtině).')), { cover: img.desk.id })
await update('Každý jazyk se zveřejňuje zvlášť, s originálem po ruce', 'jazyky-zvlast', 'feature', 0,
  'Anglickou verzi článku v klidu dopíšete a zveřejníte, až bude hotová. Při překládání máte český text pořád na očích.',
  doc(p('Každý jazyk má svůj stav: koncept, naplánováno, nebo na webu. Překlad jde na web vždy spolu s českou verzí, takže se tam nedostane nic z nehotového českého textu. Vývojář to zapne tam, kde to dává smysl, třeba u článků.'),
    p('V nepřeloženém poli je šedě český text. Přesně ten by návštěvník viděl, dokud pole nepřeložíte. Delší text si zobrazíte vedle originálu a překládáte odstavec po odstavci.'),
    p('V seznamu článků poznáte stav každého jazyka podle malé značky. Na telefonu přepnete jazyk klepnutím na jeho název nahoře.'),
    p('Jak překládat a zveřejnit jazyk, popisuje kapitola ', a('Překlady', '/dokumentace/pro-editory/preklady'), ' v příručce pro editory.')))
await update('Role na míru a pole, která smí měnit jen někdo', 'role-na-miru', 'feature', 0,
  'Vedle administrátora, editora a autora může mít web vlastní role, třeba překladatele. U jednotlivých polí určíte, kdo je smí měnit.',
  doc(p('Vývojář webu nastaví role podle toho, kdo ve firmě co dělá. Překladatel třeba upravuje jen články a nic nezveřejňuje. Správce autorů se stará o jejich profily a do knihovny médií nevidí.'),
    p('Pole, které smí měnit jen někdo, má šedé pozadí a zámek. Pod ním je napsáno, kdo ho změní, takže víte, za kým jít.'),
    p('V části Tým najdete přehled Co která role může?. V pozvánce i při změně role je u každé role jedna věta o tom, co smí.'),
    p('Co která role smí a co dělat u pole se zámkem, popisuje kapitola ', a('Role a oprávnění', '/dokumentace/pro-editory/role-a-opravneni'), ' v příručce pro editory.')))
await update('Karty a otázky na jedné stránce', 'seznamy-v-blocich', 'feature', 1,
  'Do stránky nově poskládáte karty nebo otázky a odpovědi. Jejich pořadí změníte přetažením.',
  doc(p('Stránku můžete sestavit z hotových částí, třeba z karet nebo otázek a odpovědí. Doplňte vlastní texty a seřaďte části přetažením.'),
    p('I tento web jsme poskládali stejným způsobem.')))
await update('Vyhledávání na webu i v administraci', 'vyhledavani', 'feature', 1,
  'Návštěvníci najdou obsah vašeho webu podle kteréhokoli slova. V administraci najdete jakýkoli záznam přes ⌘K.',
  doc(p('Vyhledávání prochází nadpisy, texty i obsah bloků. Nezáleží na diakritice ani na velikosti písmen a poradí si i s překlepem, takže „zimni pripava“ najde „Zimní příprava“.'),
    p('V administraci otevřete hledání tlačítkem v postranním panelu nebo zkratkou ⌘K (Ctrl+K). Najdete v něm i koncepty a texty v ostatních jazycích.')))
await update('Zprávy z formulářů v administraci', 'formulare', 'feature', 2,
  'Nové zprávy z webu najdete pohromadě. Na každou vás upozorní e-mail.',
  doc(p('Zprávy z webových formulářů se ukládají do administrace. Na novou zprávu vás upozorní e-mail. Pro další práci si je stáhnete jako tabulku pro Excel.'),
    p('Součástí formulářů je ochrana proti spamu.')))
await update('Odkaz vložíte podle názvu stránky', 'odkazy-vyberem-stranky', 'feature', 3,
  'Při psaní vyhledáte cílovou stránku podle názvu. Adresu už nemusíte kopírovat.',
  doc(p('Označte slova, ze kterých chcete udělat odkaz. Vyhledejte stránku podle názvu a vyberte ji. Můžete zůstat u rozepsaného textu.')))
await update('Opravili jsme chyby ze zkoušky administrace', 'opravy-z-testu', 'fix', 4,
  'Před pilotem jsme podrobně prošli všechny běžné úkoly editora. Všechny nalezené chyby jsme opravili.',
  doc(p('Při zkoušce se našly dvě závažné a přibližně dvacet menších chyb. Všechny jsme opravili. tinyzoo má také přes 350 automatických testů.'),
    p('Klienti administraci při své práci zatím nepoužívali. Jejich zkušenosti chceme získat v pilotu na prvním klientském webu.')))

await update('V jednom článku můžete psát společně', 'spolecne-psani', 'feature', 6,
  'Pište s kolegou ve stejnou chvíli. Oba uvidíte, kde druhý právě píše.',
  doc(p('Článek nově může upravovat několik lidí najednou. Vidíte, kde ostatní píšou, a vaše změny se navzájem nepřepíšou.'),
    picture(img.desk, 'Pracovní stůl s notebookem při psaní článku'),
    p('Můžete tak společně doplňovat text nebo ho s kolegou procházet a opravovat.')))
await update('Při úpravách vidíte náhled stránky', 'nahled-vedle-editoru', 'improvement', 8,
  'Vedle úprav máte živý náhled. Přepnete ho i na zobrazení pro telefon.',
  doc(p('Když skládáte stránku, hned vedle vidíte, jak bude vypadat. Náhled můžete přepnout na telefon.'),
    p('Prohlédnete si i rozepsaný obsah, který ještě není na webu.')))
await update('Vyberte den a čas zveřejnění', 'planovani', 'feature', 10,
  'Novinku připravíte předem. Na webu se objeví ve chvíli, kterou zvolíte.',
  doc(p('Při plánování zveřejnění vyberte den a čas. Článek můžete připravit třeba dnes a nechat ho vyjít v pondělí ráno.'),
    p('Pokud se potřebujete vrátit ke starší podobě textu, najdete ji v historii verzí.')))
// One planned for later and one draft: the admin shows every state of an entry.
await update('Připravujeme první pilot', 'pilot-na-klientskem-webu', 'feature', -3,
  'Chystáme zkoušku na prvním klientském webu. Zajímá nás, jak se lidem upravuje skutečný obsah.',
  doc(p('V pilotu si tinyzoo vyzkoušejí skuteční editoři při péči o svůj web. Jejich postřehy nám ukážou, co ještě potřebuje upravit.')), { cover: img.desk.id })
await update('Postřehy pro další úpravy', 'co-chystame-dal', 'improvement', 0,
  'Připravujeme si místo pro zkušenosti z ukázky a prvního pilotu.',
  doc(p('Chceme zachytit, co lidem při úpravách pomáhá a kde potřebují lepší vysvětlení. Tento text je zatím rozepsaný.')), { status: 'draft', publishedAt: null })

// ── menus and settings ──
const link = (label, url, sub = false) => ({ id: id(), type: 'link', label, url, newTab: false, sub })
await req('PUT', '/api/cms/_singleton/navigation', {
  main: [link('Plány', '/plany'), link('Novinky', '/novinky'), link('Pro vývojáře', '/pro-vyvojare'), link('Napište nám', '/zpetna-vazba')],
  footer: [link('Úvod', '/'), link('Plány', '/plany'), link('Vyzkoušet administraci', '/demo'), link('Novinky', '/novinky'), link('Pro vývojáře', '/pro-vyvojare'), link('Napište nám', '/zpetna-vazba'), link('Design systém', '/design-system'), link('Upravit tento web', '/admin')],
})
await req('PUT', '/api/cms/_singleton/siteSettings', {
  siteName: 'tinyzoo', ogImage: img.desk.id, tagline: 'Ať se vám web dobře upravuje.',
  footerNote: 'Chystáme pilot na prvním klientském webu. Zkuste ukázku a napište nám, jak se vám pracovalo.',
  metaDescription: 'tinyzoo je česká administrace pro váš web. Pište články, skládejte stránky a prohlížejte si náhled. Zkuste ukázku a podělte se o svou zkušenost.',
})

// ── translations: English and German (seed/translations/<lang>.mjs) ──
// Each file exports a function that gets the same helpers and media as above and
// returns its texts, keyed by the Czech address of the page or update it translates.
const helpers = { id, item, p, a, h2, ul, doc, link, picture, video, img, code: { configCode, pageCode } }
for (const lang of ['en', 'de']) {
  const file = join(dirname(fileURLToPath(import.meta.url)), `../seed/translations/${lang}.mjs`)
  if (!existsSync(file)) { console.log(`· no ${lang} translation yet`); continue }
  const tr = (await import(pathToFileURL(file).href)).default({ ...helpers, video: videoIn[lang] })
  for (const [key, fields] of Object.entries(tr.pages ?? {})) {
    if (!created.page[key]) throw new Error(`${lang}: no page with the address ${key}`)
    await req('PATCH', `/api/cms/page/${created.page[key]}?locale=${lang}`, fields)
  }
  for (const [key, fields] of Object.entries(tr.news ?? {})) {
    if (!created.news[key]) throw new Error(`${lang}: no update with the address ${key}`)
    await req('PATCH', `/api/cms/news/${created.news[key]}?locale=${lang}`, fields)
  }
  if (tr.navigation) await req('PUT', `/api/cms/_singleton/navigation?locale=${lang}`, tr.navigation)
  if (tr.settings) await req('PUT', `/api/cms/_singleton/siteSettings?locale=${lang}`, tr.settings)
  console.log(`✓ ${lang}`)
}
console.log('✓ seeded', base)
