---
'tinyzoo': patch
---

Shared editing in the admin runs on Hocuspocus 4 (was 3). Nothing changes for editors or for your site: an admin tab that was open during the deploy keeps working against the new server (the two versions speak the same protocol) and reconnects as before. Messages from one editor are now applied strictly in the order they arrive, and a tab that is open but quiet in the background stays connected.
