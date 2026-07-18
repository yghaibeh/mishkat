<script setup lang="ts">
const login = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await $fetch<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { login: login.value, password: password.value },
    })
    setToken(res.token)
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'تعذّر الدخول'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <form class="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6" @submit.prevent="submit">
      <h1 class="text-xl font-medium text-brand">منصة المسجد المؤثر</h1>
      <p class="text-sm text-gray-500">تسجيل الدخول</p>
      <input v-model="login" placeholder="اسم الدخول" class="w-full rounded-md border p-2" />
      <input v-model="password" type="password" placeholder="كلمة المرور" class="w-full rounded-md border p-2" />
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button :disabled="loading" class="w-full rounded-md bg-brand p-2 text-white disabled:opacity-50">
        {{ loading ? '...' : 'دخول' }}
      </button>
    </form>
  </div>
</template>
