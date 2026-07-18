import { verifyToken } from '../utils/auth'

// يقرأ رمز Bearer ويملأ event.context.auth — دون فرض الدخول (الفرض في requireUser)
export default defineEventHandler(async (event) => {
  const header = getRequestHeader(event, 'authorization')
  if (!header?.startsWith('Bearer ')) return
  const token = header.slice(7)
  try {
    const cfg = useRuntimeConfig(event)
    const payload = await verifyToken<{ sub: string; pid: string }>(token, cfg.jwtSecret)
    if (payload?.sub && payload?.pid) {
      ;(event.context as any).auth = { userId: payload.sub, personId: payload.pid }
    }
  } catch {
    // رمز غير صالح/منتهٍ — يُتجاهل بصمت، والمسارات المحمية ترفض عبر requireUser
  }
})
