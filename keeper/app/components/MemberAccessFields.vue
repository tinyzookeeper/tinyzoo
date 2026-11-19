<script setup lang="ts">
import type { MemberRole } from '#keeper/types/keeper'

// A person's role and which clients' sites they see: used when adding and when changing someone.
defineProps<{
  roles: { value: MemberRole; label: string; description: string }[]
  scopes: { value: 'all' | 'some'; label: string; description: string }[]
  clients: { label: string; value: string }[]
}>()
const role = defineModel<MemberRole>('role', { required: true })
const scope = defineModel<'all' | 'some'>('scope', { required: true })
const clientIds = defineModel<string[]>('clientIds', { required: true })
// Owners and admins always see every client.
const limitable = computed(() => role.value !== 'owner' && role.value !== 'admin')
</script>

<template>
  <UFormField label="Role" name="role">
    <URadioGroup v-model="role" :items="roles" variant="card" class="w-full" />
  </UFormField>
  <template v-if="limitable">
    <UFormField label="Sees" name="scope">
      <URadioGroup v-model="scope" :items="scopes" variant="card" orientation="horizontal" class="w-full" :ui="{ fieldset: 'grid grid-cols-1 gap-2 sm:grid-cols-2' }" />
    </UFormField>
    <UFormField v-if="scope === 'some'" label="Clients" name="clientIds" :description="clients.length ? undefined : 'There are no clients yet: add one under Clients first.'">
      <USelectMenu v-model="clientIds" :items="clients" value-key="value" multiple placeholder="Pick clients" :disabled="!clients.length" class="w-full" />
    </UFormField>
  </template>
</template>
