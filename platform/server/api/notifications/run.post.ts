import { useDb } from '../../utils/db'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { weekStartSaturday } from '../../utils/week'
import { queueEntryReminders, dispatchQueued } from '../../services/notifications'

// تشغيل تذكيرات الإدخال للأسبوع الجاري ثم إرسال الطابور — الإدارة العليا
// (يُستحسن ربطه لاحقاً بـCron Trigger في Cloudflare)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'تشغيل الإشعارات للإدارة العليا' })
  const db = useDb(event)
  const cfg = useRuntimeConfig(event)
  const now = Date.now()
  const weekStart = weekStartSaturday(new Date(now))

  const queued = await queueEntryReminders(db, weekStart, now)
  const dispatched = cfg.telegramBotToken ? await dispatchQueued(db, cfg.telegramBotToken) : { processed: 0, sent: 0, skipped: 'لا botToken' }
  return { weekStart, queued, dispatched }
})
