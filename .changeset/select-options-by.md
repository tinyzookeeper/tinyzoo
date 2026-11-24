---
"tinyzoo": minor
---

A choice can follow another choice. `f.select({ optionsBy: { field: 'look', options: { atelier: ['bronz', 'oliva'], negativ: ['mosaz'] } } })` makes the admin offer only the options listed under the other field's value, and move the value to the first of them when the other field changes and the chosen one is no longer offered. `swatches` (`{ bronz: ['#7a5a3a', '#faf8f4'] }`) shows a few colours as dots beside an option's name, for a palette. The stored value is still any of `options`; a select without `optionsBy` behaves as before.
