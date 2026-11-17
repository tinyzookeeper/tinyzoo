---
'tinyzoo': minor
---

A custom field renderer is told when it must not change its value. `CmsAdminField` has `readOnly` (set when the person's role may read the field but not edit it, `.access({ edit })`), and `CmsFieldEditProps` has a `readOnly` prop, `true` when that is so or when the whole entry is read-only for the person. Every renderer the registry resolves gets it, the built-in ones too; the built-in gallery and blocks fields no longer let a read-only field be reordered by dragging. This is part of the admin extension points that 1.0 freezes (`test/contracts/api-tinyzoo.txt`: two optional members added).

### Upgrade

Nothing is required: a renderer that does not declare the prop works as before. If your renderer is made of anything but native form controls (buttons that are not disabled, a drag handle, a canvas), declare `readOnly` (`defineProps<CmsFieldEditProps>()`) and stop editing when it is set; the server refuses a write to a field the role may not edit in any case ([the admin guide](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/admin.md#extensibility--the-field--view-registry)).
