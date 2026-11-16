// Changelog format for tinyzoo and @tinyzoo/client.
//
// Changesets already groups entries by bump (Major / Minor / Patch Changes). This
// generator keeps the entry itself readable: the first line becomes the bullet, and
// the `### Upgrade` section of a changeset (the steps a site has to take) is turned
// into a bold, indented "Upgrade" block under it, so it survives as part of the
// list item instead of becoming a stray heading.
//
// Write changesets with the rules in CONTRIBUTING.md.

const UPGRADE = /^#{2,4}\s*Upgrade\s*$/im

function indent(text, by = '  ') {
  return text
    .split('\n')
    .map((line) => (line.trim() ? by + line : ''))
    .join('\n')
}

function getReleaseLine(changeset) {
  const summary = changeset.summary.replace(/<!--[\s\S]*?-->/g, '').trim()
  const found = UPGRADE.exec(summary)
  const body = found ? summary.slice(0, found.index).trim() : summary
  const upgrade = found ? summary.slice(found.index + found[0].length).trim() : ''

  const [first, ...rest] = body.split('\n').map((line) => line.trimEnd())
  const lines = [`- ${first}`]
  const more = rest.join('\n').trim()
  if (more) lines.push('', indent(more))
  if (upgrade) lines.push('', '  **Upgrade**', '', indent(upgrade))
  return lines.join('\n')
}

// The two packages do not depend on each other, so there is nothing to say here.
function getDependencyReleaseLine() {
  return Promise.resolve('')
}

module.exports = { getReleaseLine, getDependencyReleaseLine }
