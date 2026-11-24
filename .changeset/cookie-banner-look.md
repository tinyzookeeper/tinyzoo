---
"tinyzoo": minor
---

The cookie banner (`<CmsConsent />`) looks calmer, and no longer looks selected when a page opens. It took the focus on arrival (so a keyboard or screen reader reaches it first) and the browser drew a focus ring around it for every visitor; it still takes the focus, without the ring, and the next Tab shows the ring on its first button. On a large screen it is now a small card in the bottom right corner (`--cms-consent-width` defaults to 25rem); at phone width it runs along the bottom edge and the settings rise from the bottom. "Accept all" and "Reject all" stay side by side, the same size and style, with "Settings" as a quieter line under them; the settings dialog has softer switches and a calmer footer. The `--cms-consent-*` variables work as before.
