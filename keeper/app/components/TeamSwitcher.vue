<script setup lang="ts">
// The team below the workspace (Postyard's switcher): "All teams", a place of its own
// (/t/all), and each team I see. Hidden in a workspace with a single team.
defineProps<{ collapsed?: boolean }>()
const { workspace, team, isManager, isGuest, link, swap } = useScope()
const open = ref(false)
function go(to: string) {
  open.value = false
  return navigateTo(to)
}
const teamInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
</script>

<template>
  <UPopover v-if="workspace && workspace.teams.length > 1 && !isGuest" v-model:open="open" :content="{ align: 'start', sideOffset: 6 }" :ui="{ content: 'w-64 p-1.5' }">
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-2 rounded-lg border border-default px-2 py-1.5 text-left text-sm transition-colors hover:bg-elevated"
      :class="[collapsed && 'justify-center border-0 px-0', open && 'bg-elevated']"
      :aria-label="`Team: ${team?.name ?? 'All teams'}. Switch team`"
    >
      <span class="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-(--k-moment-strong) text-[10px] font-semibold text-highlighted">
        <UIcon v-if="!team" name="i-lucide-layers" class="size-3.5" />
        <template v-else>{{ teamInitials(team.name) }}</template>
      </span>
      <template v-if="!collapsed">
        <span class="min-w-0 flex-1 truncate font-medium text-highlighted">{{ team?.name ?? 'All teams' }}</span>
        <UIcon name="i-lucide-chevrons-up-down" class="size-3.5 shrink-0 text-dimmed" />
      </template>
    </button>

    <template #content>
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-highlighted transition-colors hover:bg-elevated"
        :class="!team && 'bg-elevated font-medium'"
        @click="go(swap(workspace.slug, 'all'))"
      >
        <UIcon name="i-lucide-layers" class="size-4 text-muted" />
        <span class="flex-1 text-left">All teams</span>
        <span class="text-xs text-dimmed tabular-nums">{{ workspace.sites }}</span>
      </button>
      <USeparator class="my-1.5" />
      <button
        v-for="t in workspace.teams"
        :key="t.id"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-highlighted transition-colors hover:bg-elevated"
        :class="t.id === team?.id && 'bg-elevated font-medium'"
        @click="go(swap(workspace.slug, t.slug))"
      >
        <span class="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-(--k-moment-strong) text-[10px] font-semibold">{{ teamInitials(t.name) }}</span>
        <span class="min-w-0 flex-1 truncate text-left">{{ t.name }}</span>
        <HealthDot v-if="t.down || t.behind" :health="t" />
        <span class="text-xs text-dimmed tabular-nums">{{ t.sites }}</span>
      </button>
      <USeparator class="my-1.5" />
      <button type="button" class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-toned transition-colors hover:bg-elevated hover:text-highlighted" @click="go(link('/settings/teams'))">
        <UIcon name="i-lucide-settings-2" class="size-4" />{{ isManager ? 'Manage teams' : 'Teams' }}
      </button>
    </template>
  </UPopover>
</template>
