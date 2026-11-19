---
'tinyzoo': patch
---

**`tinyzoo seed` compares decimals by their value.** The site gives a decimal (`f.number({ int: false })`) back as text (`"2.50"`, or `"49.13504"` inside a group), and the seed compared that with its own number (`2.5`). So every run printed `✓ updated …` and saved a new version. Now `2.5`, `"2.5"` and `"2.50"` are the same decimal, in a field, a group, a list or a block, and a second run saves nothing, as the seeding guide says.

### Upgrade

Nothing to do. A seed that writes decimals as text (`toFixed(2)`, `String(…)`) only to get around this can write plain numbers again.
