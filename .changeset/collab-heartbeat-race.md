---
'tinyzoo': patch
---

Shared editing: when the last person closed a document at the moment the server was checking who has it open, the document could stay marked as "being edited" after everyone had left. A later change to the entry made elsewhere then did not start the shared text afresh until the 90-second window ran out. The check now waits for that moment to pass.
