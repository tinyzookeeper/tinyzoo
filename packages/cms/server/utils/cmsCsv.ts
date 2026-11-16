/**
 * A cell of a CSV file for Excel or Sheets, made safe: a text that starts like a formula
 * would be *run* by the spreadsheet (`=HYPERLINK(…)`, `+cmd|…`, `@SUM(…)`) with whatever a
 * visitor typed into a form. Those get a leading apostrophe, which shows as plain text.
 *
 *  - `=` and `@` always (nothing real starts with them), and a leading tab or carriage return
 *    (some programs read them as the start of a formula);
 *  - `+` and `-` only when what follows is not a number: a phone number ("+420 777 123 456",
 *    "+1 (555) 123-4567") or a negative amount is data, while "+SUM(…)", "-2+cmd|…" are not.
 *    A formula made of digits and operators only cannot do anything but arithmetic.
 */
const NUMBER_LIKE = /^[+-]\s?[0-9][0-9 ()./-]*$/

export function neutraliseCell(s: string): string {
  if (/^[=@\t\r]/.test(s)) return `'${s}`
  if (/^[+-]/.test(s) && !NUMBER_LIKE.test(s)) return `'${s}`
  return s
}

/** One cell, neutralised and quoted when it holds a separator, a quote or a line break. */
export function csvCell(s: string): string {
  const safe = neutraliseCell(s)
  return /[",\n\r;]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}
