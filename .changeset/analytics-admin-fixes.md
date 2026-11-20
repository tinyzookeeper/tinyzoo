---
'tinyzoo': patch
---

**Analytics: clearer about who is counted, and no switch to stop it by accident.**

- The Analytics page says under "On the website now" that your own visits are not counted while you are signed in to the admin. Opening the website in the same browser no longer looks like counting is broken.
- The "Counting visits" switch is gone from the top of the Analytics page. Counting is switched off in Settings → Counting visits, and the admin asks first. While it is off, the Analytics page says so and links to the setting.
- `f.boolean({ confirmOff })`: a switch whose "off" stops something asks before it is saved switched off, with your text. Analytics uses it for "Count visits".

### Upgrade

Nothing to do.
