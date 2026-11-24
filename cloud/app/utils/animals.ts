// tinyzoo's animal family (the muted set, packages/cms/app/assets/brand/characters/muted).
const files = import.meta.glob('../assets/brand/animals/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export const animals = Object.entries(files)
  .map(([path, url]) => ({ name: path.split('/').pop()!.replace(/\.svg$/, ''), url }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

/** One animal by name ('elephant', 'owl'…). */
export function animal(name: string): { name: string; url: string } {
  return animals.find((a) => a.name === name) ?? animals[0]!
}

/** The same animal for the same seed (a site's id) every time. */
export function animalFor(seed: string): { name: string; url: string } {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return animals[h % animals.length]!
}
