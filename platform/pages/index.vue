<script setup lang="ts">
interface Me {
  fullName: string
  assignments: Array<{ role: string; orgUnitId: string; portfolio: string | null }>
}
interface OrgUnit { id: string; name: string; type: string; genderTrack: string }

const me = ref<Me | null>(null)
const units = ref<OrgUnit[]>([])
const error = ref('')

onMounted(async () => {
  try {
    me.value = await apiFetch<Me>('/api/auth/me')
    units.value = await apiFetch<OrgUnit[]>('/api/org-units')
  } catch {
    await navigateTo('/login')
  }
})

function logout() {
  setToken(null)
  navigateTo('/login')
}

const roleLabels: Record<string, string> = {
  admin: 'الإدارة العليا', rabita: 'مسؤول رابطة', bloc: 'مسؤول كتلة', square: 'مسؤول مربع',
  amir: 'أمير مسجد', deputy: 'نائب', secretary: 'أمين سر', treasurer: 'أمين صندوق',
  committee: 'مسؤول لجنة', member: 'عضو', participant: 'مشترك',
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6 p-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-medium text-brand">المسجد المؤثر</h1>
      <button class="text-sm text-gray-500 underline" @click="logout">خروج</button>
    </header>

    <section v-if="me" class="rounded-xl border bg-white p-4">
      <p class="font-medium">{{ me.fullName }}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <span
          v-for="(a, i) in me.assignments" :key="i"
          class="rounded-md bg-brand/10 px-2 py-1 text-xs text-brand-dark"
        >{{ roleLabels[a.role] || a.role }}{{ a.portfolio ? ` · ${a.portfolio}` : '' }}</span>
      </div>
    </section>

    <section class="rounded-xl border bg-white p-4">
      <h2 class="mb-2 text-sm text-gray-500">الوحدات ضمن نطاقي ({{ units.length }})</h2>
      <ul class="divide-y">
        <li v-for="u in units" :key="u.id" class="flex justify-between py-2 text-sm">
          <span>{{ u.name }}</span>
          <span class="text-gray-400">{{ u.type }}<span v-if="u.genderTrack === 'female'"> · نساء</span></span>
        </li>
      </ul>
    </section>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>
