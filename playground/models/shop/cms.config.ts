// A second content model, "shop", for the tests of two sites with different models in one
// process (test/api/tenants-models.spec.ts). It is small on purpose and unlike the playground's
// own model: collections only it has (product, category), two names both models use with another
// shape (post, tag) so their tables and relation tables share a name, and a form of its own.
// Its plugins are the playground's, with the same options in the same order: a build registers
// the plugins' pages and routes once, so it refuses models whose plugins differ.
import { defineEntity, defineLocales, f } from "tinyzoo"
import { defineForm, defineFormSettings, formsPlugin } from "tinyzoo/forms"
import { analyticsPlugin } from "tinyzoo/analytics"
import { consentPlugin } from "tinyzoo/consent"
import { eventsPlugin } from "../../cms-plugins/events"

// Only Czech (the playground has Czech and English): the consent plugin is localized, so a language set is needed.
export const locales = defineLocales({ default: "cs", locales: ["cs"] })

export const Category = defineEntity("category", {
  label: { en: "Categories", cs: "Kategorie" },
  labelSingular: { en: "Category", cs: "Kategorie" },
  icon: "i-lucide-folder",
  titleField: "name",
  admin: { list: { columns: ["name"] } },
  fields: {
    name: f.text({ required: true }).label({ en: "Name", cs: "Název" }),
  },
  content: { public: true },
})

export const Product = defineEntity("product", {
  label: { en: "Products", cs: "Produkty" },
  labelSingular: { en: "Product", cs: "Produkt" },
  icon: "i-lucide-shopping-bag",
  titleField: "title",
  admin: { list: { columns: ["title", "price"], searchable: ["title"] } },
  fields: {
    title: f.text({ required: true }).label({ en: "Title", cs: "Název" }),
    slug: f.slug({ from: "title", unique: true }).label({ en: "URL address", cs: "Adresa (URL)" }),
    price: f.number({ min: 0 }).optional().label({ en: "Price", cs: "Cena" }),
    description: f.text({ multiline: true }).optional().label({ en: "Description", cs: "Popis" }),
    categories: f.relation({ to: () => Category, kind: "many-to-many" }).label({ en: "Categories", cs: "Kategorie" }),
  },
  // Public, with an address: the sitemap lists it and the site search finds it.
  content: { public: true, slug: "slug", path: "/shop/:slug", populate: ["categories"] },
})

// The same names as the playground's tag and post, another shape.
export const Tag = defineEntity("tag", {
  label: { en: "Tags", cs: "Štítky" },
  labelSingular: { en: "Tag", cs: "Štítek" },
  icon: "i-lucide-tag",
  titleField: "label",
  admin: { list: { columns: ["label"] } },
  fields: {
    label: f.text({ required: true }).label({ en: "Label", cs: "Popisek" }),
  },
  content: { public: true },
})

export const Post = defineEntity("post", {
  label: { en: "Posts", cs: "Příspěvky" },
  labelSingular: { en: "Post", cs: "Příspěvek" },
  icon: "i-lucide-newspaper",
  titleField: "title",
  admin: { list: { columns: ["title", "summary"], searchable: ["title"] } },
  fields: {
    title: f.text({ required: true }).label({ en: "Title", cs: "Název" }),
    slug: f.slug({ from: "title", unique: true }).label({ en: "URL address", cs: "Adresa (URL)" }),
    summary: f.text({ required: true, max: 300 }).label({ en: "Summary", cs: "Shrnutí" }),
    body: f.text({ multiline: true }).optional().label({ en: "Text", cs: "Text" }),
    tags: f.relation({ to: () => Tag, kind: "many-to-many" }).label({ en: "Tags", cs: "Štítky" }),
  },
  content: { public: true, slug: "slug", populate: ["tags"] },
})

export const plugins = [
  formsPlugin(),
  eventsPlugin(),
  analyticsPlugin({ mode: "consent" }),
  consentPlugin({
    localized: true,
    services: {
      marketing: [{
        name: "YouTube",
        provider: "Google Ireland Limited",
        purpose: { en: "Plays the videos embedded in our pages.", cs: "Přehrává videa vložená do našich stránek.", de: "Spielt die in unsere Seiten eingebetteten Videos ab." },
        cookies: ["YSC", "VISITOR_INFO1_LIVE"],
        duration: { en: "Up to 6 months", cs: "Až 6 měsíců", de: "Bis zu 6 Monate" },
        privacyUrl: "https://policies.google.com/privacy",
      }],
    },
  }),
]

export const OrderForm = defineForm("orderForm", {
  label: { en: "Order form", cs: "Objednávka" },
  labelSingular: { en: "Order", cs: "Objednávka" },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: "Your name", cs: "Vaše jméno" }),
    email: f.text({ required: true, format: "email" }).label({ en: "Email", cs: "E-mail" }),
    product: f.text({ required: true, max: 200 }).label({ en: "Product", cs: "Produkt" }),
    quantity: f.number({ min: 1 }).optional().label({ en: "Quantity", cs: "Počet" }),
  },
  successMessage: { en: "Thank you, we will confirm your order.", cs: "Děkujeme, objednávku potvrdíme." },
})

export const FormSettings = defineFormSettings()
