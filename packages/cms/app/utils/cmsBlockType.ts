// Which block types the website may draw. A block's `type` picks a component by name
// (`hero` → BlockHero), and the name is derived from it, so odd spellings (`Hero`,
// `_hero`, `-hero`, `hero-`) would all land on the component of a known type. Only the
// spelling a definition can be written in counts: starts with a lower-case letter or a
// digit, words joined by single `_` or `-`.
const RENDERABLE = /^[a-z0-9][A-Za-z0-9]*([_-][A-Za-z0-9]+)*$/

/** Is this a block type that maps to exactly one component name? */
export function renderableBlockType(type: unknown): type is string {
  return typeof type === 'string' && RENDERABLE.test(type)
}
