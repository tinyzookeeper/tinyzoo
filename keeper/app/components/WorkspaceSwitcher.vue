<script setup lang="ts">
// The workspace at the top of the sidebar (Postyard's switcher): every workspace I am in, with
// a dot for trouble there, then this workspace's settings and a new one.
defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ create: [] }>()
const { me, workspace, link, swap, everywhere } = useScope()
const showEverywhere = computed(() => hasEverywhere(me.value))
const trouble = computed(() => workingWorkspaces(me.value).reduce((h, w) => ({ sites: h.sites + w.sites, down: h.down + w.down, behind: h.behind + w.behind }), { sites: 0, down: 0, behind: 0 }))
const open = ref(false)
const sorted = computed(() => [...(me.value?.workspaces ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
const initial = (name?: string) => (name ?? 'K').trim().charAt(0).toUpperCase()
function go(to: string) {
  open.value = false
  return navigateTo(to)
}
function create() {
  open.value = false
  emit('create')
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start', sideOffset: 6 }" :ui="{ content: 'w-72 p-1.5' }">
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-elevated"
      :class="[collapsed && 'justify-center px-0', open && 'bg-elevated']"
      :aria-label="`Workspace: ${everywhere ? 'every workspace' : workspace?.name ?? 'none'}. Switch workspace`"
    >
      <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-inverted text-[11px] font-semibold text-inverted">
        <UIcon v-if="everywhere" name="i-lucide-layout-grid" class="size-4" />
        <template v-else>{{ initial(workspace?.name) }}</template>
      </span>
      <template v-if="!collapsed">
        <span class="k-display min-w-0 flex-1 truncate text-[16px] text-highlighted">{{ everywhere ? 'Every workspace' : workspace?.name ?? 'Keeper' }}</span>
        <UIcon name="i-lucide-chevrons-up-down" class="size-3.5 shrink-0 text-dimmed" />
      </template>
    </button>

    <template #content>
      <template v-if="showEverywhere">
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-highlighted transition-colors hover:bg-elevated"
          :class="everywhere && 'bg-elevated font-medium'"
          @click="go('/home')"
        >
          <UIcon name="i-lucide-layout-grid" class="size-4 text-muted" />
          <span class="flex-1 text-left">Every workspace</span>
          <HealthDot v-if="trouble.down || trouble.behind" :health="trouble" />
          <UIcon v-if="everywhere" name="i-lucide-check" class="size-4 shrink-0" />
        </button>
        <USeparator class="my-1.5" />
      </template>
      <p class="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-dimmed">Workspaces</p>
      <div class="flex max-h-[50vh] flex-col overflow-y-auto">
        <button
          v-for="w in sorted"
          :key="w.id"
          type="button"
          class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-highlighted transition-colors hover:bg-elevated"
          :class="w.id === workspace?.id && 'bg-elevated font-medium'"
          @click="go(swap(w.slug))"
        >
          <span class="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold" :class="w.id === workspace?.id ? 'bg-inverted text-inverted' : 'bg-(--k-moment-strong) text-highlighted'">{{ initial(w.name) }}</span>
          <span class="min-w-0 flex-1 truncate text-left">{{ w.name }}</span>
          <HealthDot v-if="w.down || w.behind" :health="w" />
          <UIcon v-if="w.id === workspace?.id" name="i-lucide-check" class="size-4 shrink-0" />
        </button>
      </div>
      <USeparator class="my-1.5" />
      <button v-if="workspace" type="button" class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-toned transition-colors hover:bg-elevated hover:text-highlighted" @click="go(link('/settings/general'))">
        <UIcon name="i-lucide-settings-2" class="size-4" />Workspace settings
      </button>
      <button type="button" class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-toned transition-colors hover:bg-elevated hover:text-highlighted" @click="create">
        <UIcon name="i-lucide-plus" class="size-4" />New workspace
      </button>
    </template>
  </UPopover>
</template>
