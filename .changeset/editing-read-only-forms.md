---
'tinyzoo': patch
---

Forms a person cannot save now open read-only, with the reason. The entry and settings endpoints tell the form whether this person may save (`can: { update, why }`, the same rules a save applies: the role, someone else's entry, an entry that is live); an author opening someone else's post, the site settings, navigation, a redirect or a new tag sees a lock badge and a sentence ("Only its author or an editor can change this.") instead of fields that cannot be saved, and no Save button. A refused save shows a message in the admin's language for any status (not found, conflict, invalid, refused), never the server's English.

Saving an empty translation no longer makes the language count as translated ("Missing: EN" and the publish warning stay); a translation emptied entirely is removed. Language names inside sentences come in the admin's own language and are phrased so no declension is needed ("Remove the translation: English?"). The German "saved … ago" no longer runs together. Switching the language on Navigation or Site settings reloads that language's values and version (no false conflict on Save translation); "The other fields are shared" shows only when there are other fields.
