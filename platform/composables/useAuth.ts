// إدارة بسيطة لرمز الدخول على العميل (يُحفظ محلياً)
export function useToken() {
  return useState<string | null>('token', () => {
    if (import.meta.client) return localStorage.getItem('token')
    return null
  })
}

export function setToken(value: string | null) {
  const token = useToken()
  token.value = value
  if (import.meta.client) {
    if (value) localStorage.setItem('token', value)
    else localStorage.removeItem('token')
  }
}

// طلب API يضيف ترويسة المصادقة تلقائياً
export function apiFetch<T>(url: string, opts: any = {}) {
  const token = useToken()
  return $fetch<T>(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token.value ? { authorization: `Bearer ${token.value}` } : {}),
    },
  })
}
