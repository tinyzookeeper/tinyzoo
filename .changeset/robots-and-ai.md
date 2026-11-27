---
"tinyzoo": minor
---

Analytics: "Who else reads your website?" The server now counts the pages robots load, by robot, in four groups: AI assistants opening a page for a person who asked them (ChatGPT, Claude, Perplexity…), search engines, AI crawlers and other robots. The Visitors page shows them in a new card: in Simple, a sentence about the AI assistants and the four numbers; in Detailed, also every robot by name. They are never in the visitor numbers.

- Only the robot's name and the day are kept, as rows of `analytics_daily` with the dimension `robot`. No migration: the table is there already. The nightly totals leave these rows alone.
- A person's page costs one look at its user agent; robots are counted after the response is sent.
- On by default; `analyticsPlugin({ countRobots: false })` switches it off. Switching counting off in the admin stops it too.
- The rollups for a fleet monitor are unchanged.
