<script setup lang="ts">
import type { Member, Team } from '#keeper/types/keeper'

// The workspace's teams: groups of sites. Owners and admins make, rename, delete and move them
// (to another workspace, with their sites); a team's lead renames it and chooses who is on it.
const toast = useToast()
const { me, wsSlug, workspace, isManager, team: current, swap } = useScope()
const { data: teams, refresh } = await useFetch<Team[]>(() => `/api/w/${wsSlug.value}/teams`, { key: `teams-${wsSlug.value}`, default: () => [] })
const mayPickPeople = computed(() => isManager.value || teams.value.some((t) => t.canManage))
const { data: members } = await useFetch<Member[]>(() => `/api/w/${wsSlug.value}/members`, { key: `members-${wsSlug.value}`, default: () => [], immediate: mayPickPeople.value })
const memberItems = computed(() => members.value.map((m) => ({ label: m.name || m.email, value: m.id, description: ROLE_LABELS[m.role] })))

async function after() {
  await Promise.all([refresh(), refreshMe()])
}

// ── A new team ──
const newOpen = ref(false)
const newName = ref('')
const newBusy = ref(false)
async function create() {
  newBusy.value = true
  try {
    await $fetch(`/api/w/${wsSlug.value}/teams`, { method: 'POST', body: { name: newName.value.trim() } })
    newOpen.value = false
    await after()
  }
  catch (err) {
    toast.add({ title: 'Could not make the team', description: errorMessage(err), color: 'error' })
  }
  finally {
    newBusy.value = false
  }
}

// ── Change a team: its name and its people (with their leads) ──
const editing = ref<Team | null>(null)
const editOpen = computed({ get: () => !!editing.value, set: (v: boolean) => { if (!v) editing.value = null } })
const form = reactive({ name: '', people: [] as string[], leads: [] as string[] })
function openEdit(t: Team) {
  form.name = t.name
  form.people = t.people.map((p) => p.userId)
  form.leads = t.people.filter((p) => p.role === 'lead').map((p) => p.userId)
  editing.value = t
}
// The team as the list has it now: its logo changes at once, before Save.
const editingNow = computed(() => teams.value.find((t) => t.id === editing.value?.id) ?? editing.value)
const nameOf = (id: string) => members.value.find((m) => m.id === id)?.name || members.value.find((m) => m.id === id)?.email || 'Someone'
function toggleLead(id: string, on: boolean) {
  form.leads = on ? [...new Set([...form.leads, id])] : form.leads.filter((x) => x !== id)
}
const editBusy = ref(false)
async function saveEdit() {
  if (!editing.value) return
  editBusy.value = true
  try {
    await $fetch(`/api/w/${wsSlug.value}/teams/${editing.value.id}`, {
      method: 'PATCH',
      body: {
        name: form.name.trim(),
        ...(mayPickPeople.value ? { people: form.people.map((userId) => ({ userId, role: form.leads.includes(userId) ? 'lead' : 'member' })) } : {}),
      },
    })
    editing.value = null
    await after()
  }
  catch (err) {
    toast.add({ title: 'Could not save the team', description: errorMessage(err), color: 'error' })
  }
  finally {
    editBusy.value = false
  }
}

async function makeDefault(t: Team) {
  try {
    await $fetch(`/api/w/${wsSlug.value}/teams/${t.id}`, { method: 'PATCH', body: { isDefault: true } })
    toast.add({ title: `${t.name} is the default team`, color: 'success', icon: 'i-lucide-house' })
    await after()
  }
  catch (err) {
    toast.add({ title: 'Could not change the default team', description: errorMessage(err), color: 'error' })
  }
}

// ── Delete ──
const removing = ref<Team | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: (v: boolean) => { if (!v) removing.value = null } })
const removeBusy = ref(false)
async function remove() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    const t = removing.value
    await $fetch(`/api/w/${wsSlug.value}/teams/${t.id}`, { method: 'DELETE' })
    removing.value = null
    await after()
    if (current.value?.id === t.id) await navigateTo(swap(wsSlug.value, 'all'))
  }
  catch (err) {
    toast.add({ title: 'Could not delete the team', description: errorMessage(err), color: 'error' })
  }
  finally {
    removeBusy.value = false
  }
}

// ── Move to another workspace (an owner or admin of both) ──
const moving = ref<Team | null>(null)
const moveOpen = computed({ get: () => !!moving.value, set: (v: boolean) => { if (!v) moving.value = null } })
const moveTo = ref('')
const moveConfirm = ref('')
const moveBusy = ref(false)
const targets = computed(() => (me.value?.workspaces ?? [])
  .filter((w) => w.id !== workspace.value?.id && (w.role === 'owner' || w.role === 'admin'))
  .map((w) => ({ label: w.name, value: w.slug })))
function openMove(t: Team) {
  moveTo.value = targets.value[0]?.value ?? ''
  moveConfirm.value = ''
  moving.value = t
}
const onlyTeam = computed(() => teams.value.length === 1)
async function move() {
  if (!moving.value) return
  moveBusy.value = true
  try {
    const t = moving.value
    const res = await $fetch<{ workspaceSlug: string; teamSlug: string }>(`/api/w/${wsSlug.value}/teams/${t.id}/move`, { method: 'POST', body: { workspace: moveTo.value, confirm: moveConfirm.value } })
    moving.value = null
    await refreshMe()
    toast.add({ title: `${t.name} moved`, description: 'Its sites, history and people came along.', color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/w/${res.workspaceSlug}/t/${res.teamSlug}/settings/teams`)
  }
  catch (err) {
    toast.add({ title: 'Could not move the team', description: errorMessage(err), color: 'error' })
  }
  finally {
    moveBusy.value = false
  }
}

function menuFor(t: Team) {
  return [
    [
      ...(t.canManage ? [{ label: 'Change', icon: 'i-lucide-pencil', onSelect: () => openEdit(t) }] : []),
      ...(isManager.value && !t.isDefault ? [{ label: 'Make default', icon: 'i-lucide-house', onSelect: () => makeDefault(t) }] : []),
      ...(isManager.value ? [{ label: 'Move to another workspace', icon: 'i-lucide-arrow-right-left', disabled: !targets.value.length || (t.isDefault && !onlyTeam.value), onSelect: () => openMove(t) }] : []),
    ],
    ...(isManager.value && !t.isDefault ? [[{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, disabled: t.sites > 0, onSelect: () => { removing.value = t } }]] : []),
  ]
}
const initials = (name: string) => name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="min-w-0 flex-1 text-sm text-pretty text-toned">
        Groups of sites in {{ workspace?.name }}. Owners and admins see every team; members and guests only the teams they are on.
      </p>
      <UButton v-if="isManager" label="New team" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="() => { newName = ''; newOpen = true }" />
    </div>

    <ul class="k-card divide-y divide-(--ui-border-muted)">
      <li v-for="t in teams" :key="t.id" class="flex items-center gap-3 px-4 py-3">
        <KLogo :logo="t.logo" class="size-8 rounded-lg">
          <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--k-moment-strong) text-xs font-semibold text-highlighted">{{ initials(t.name) }}</span>
        </KLogo>
        <div class="min-w-0 flex-1">
          <p class="flex min-w-0 items-center gap-2 text-sm font-medium text-highlighted">
            <span class="truncate">{{ t.name }}</span>
            <UBadge v-if="t.isDefault" label="Default" icon="i-lucide-house" color="neutral" variant="subtle" size="sm" class="shrink-0" />
          </p>
          <p class="truncate text-xs text-muted">
            {{ t.sites === 1 ? '1 site' : `${t.sites} sites` }}
            <template v-if="t.people.some((p) => p.role === 'lead')"> · lead {{ t.people.filter((p) => p.role === 'lead').map((p) => p.name || p.email).join(', ') }}</template>
            <template v-else-if="t.people.length"> · {{ t.people.length === 1 ? '1 person' : `${t.people.length} people` }}</template>
          </p>
        </div>
        <div class="hidden -space-x-1.5 sm:flex">
          <span v-for="p in t.people.slice(0, 4)" :key="p.userId" class="inline-flex size-6 items-center justify-center rounded-full border-2 border-(--k-surface) bg-(--k-moment-bg) text-[10px] font-semibold text-highlighted" :title="p.name || p.email">{{ initials(p.name || p.email) }}</span>
        </div>
        <UDropdownMenu v-if="menuFor(t).flat().length" :items="menuFor(t)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" square :aria-label="`${t.name}: more`" />
        </UDropdownMenu>
      </li>
    </ul>
    <p class="text-xs text-pretty text-muted">The default team is where new sites and invitations go when no team is named.</p>

    <!-- A new team -->
    <UModal v-model:open="newOpen" title="New team" description="You lead it. Its address is made from the name once.">
      <template #body>
        <form id="new-team" @submit.prevent="create">
          <UFormField label="Name" name="name">
            <UInput v-model="newName" required maxlength="80" autofocus placeholder="Konfigure" class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { newOpen = false }" />
          <UButton type="submit" form="new-team" label="Make team" :loading="newBusy" />
        </div>
      </template>
    </UModal>

    <!-- Change a team -->
    <UModal v-model:open="editOpen" :title="`Change ${editing?.name ?? 'team'}`">
      <template #body>
        <form id="edit-team" class="flex flex-col gap-4" @submit.prevent="saveEdit">
          <UFormField label="Name" name="name" description="Its address stays when you rename it.">
            <UInput v-model="form.name" required maxlength="80" class="w-full" />
          </UFormField>
          <UFormField v-if="editingNow" label="Logo" name="logo" description="Shown in the team switcher and the lists. It changes straight away.">
            <LogoPicker :origin="editingNow" :name="editingNow.name" kind="team" :endpoint="`/api/w/${wsSlug}/teams/${editingNow.id}/logo`" can-edit class="mt-1" @changed="after" />
          </UFormField>
          <UFormField v-if="mayPickPeople" label="People" name="people" description="Owners and admins see every team without being on it.">
            <USelectMenu v-model="form.people" :items="memberItems" value-key="value" multiple placeholder="Pick people" class="w-full" />
          </UFormField>
          <ul v-if="mayPickPeople && form.people.length" class="flex flex-col gap-2">
            <li v-for="id in form.people" :key="id" class="flex items-center gap-3 text-sm">
              <span class="min-w-0 flex-1 truncate text-highlighted">{{ nameOf(id) }}</span>
              <UCheckbox :model-value="form.leads.includes(id)" label="Lead" @update:model-value="(v) => toggleLead(id, !!v)" />
            </li>
          </ul>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { editing = null }" />
          <UButton type="submit" form="edit-team" label="Save" :loading="editBusy" />
        </div>
      </template>
    </UModal>

    <!-- Move a team -->
    <UModal v-model:open="moveOpen" :title="`Move ${moving?.name ?? 'team'}`" description="To another workspace you own or run, with its sites, their history and its people.">
      <template #body>
        <form id="move-team" class="flex flex-col gap-4" @submit.prevent="move">
          <UFormField label="To" name="workspace">
            <USelect v-model="moveTo" :items="targets" class="w-full" />
          </UFormField>
          <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-pretty text-toned">
            <li>Every site keeps its address in Keeper, its checks and incidents.</li>
            <li>Its people join the other workspace as members (guests as guests).</li>
            <li v-if="onlyTeam">{{ workspace?.name }} keeps an empty team, General. Delete the workspace afterwards if nothing is left in it.</li>
          </ul>
          <UFormField :label="`Type ${moving?.name} to confirm`" name="confirm">
            <UInput v-model="moveConfirm" class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { moving = null }" />
          <UButton type="submit" form="move-team" label="Move team" :loading="moveBusy" :disabled="!moveTo || moveConfirm !== moving?.name" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="removeOpen" :title="`Delete ${removing?.name ?? 'team'}?`" description="It has no sites. The people on it stay in the workspace.">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { removing = null }" />
          <UButton label="Delete team" color="error" :loading="removeBusy" @click="remove" />
        </div>
      </template>
    </UModal>
  </div>
</template>
