import { and, eq } from 'drizzle-orm'
import { orgUnits, weeklyRecords, roleAssignments, personContacts, notifications } from '../database/schema'
import { ROLES } from '../utils/rbac'
import type { Db } from '../utils/db'

// الإشعارات: تذكير الإدخال (يدعم هدف 80% إدخال أسبوعي). القناة: Web Push + بوت تيليغرام.

const DAY = 86_400_000

// مساجد لم تُدخل سجل الأسبوع أو تأخّرت (≥ يومين) — تحتاج تذكيراً
export async function mosquesNeedingReminder(db: Db, weekStart: string, asOf: number, lateMs = 2 * DAY) {
  const mosques = await db.select().from(orgUnits).where(eq(orgUnits.type, 'mosque')).all()
  const recs = await db.select().from(weeklyRecords).where(eq(weeklyRecords.weekStart, weekStart)).all()
  const byMosque = new Map(recs.map((r) => [r.mosqueId, r]))
  return mosques.filter((m) => {
    const r = byMosque.get(m.id)
    return !r || !r.lastEntryAt || (asOf - r.lastEntryAt) > lateMs
  })
}

// يضع تذكيرات في الطابور لأمراء المساجد المتأخرة
export async function queueEntryReminders(db: Db, weekStart: string, asOf: number) {
  const due = await mosquesNeedingReminder(db, weekStart, asOf)
  let queued = 0
  for (const m of due) {
    const amir = (await db.select().from(roleAssignments).where(and(
      eq(roleAssignments.role, ROLES.AMIR), eq(roleAssignments.orgUnitId, m.id), eq(roleAssignments.approvalStatus, 'approved'),
    )).all())[0]
    if (!amir) continue
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId: amir.personId, channel: 'telegram', kind: 'entry_reminder',
      payload: JSON.stringify({ mosqueId: m.id, mosqueName: m.name, weekStart }), status: 'queued',
      createdAt: asOf, sentAt: null,
    }).run()
    queued++
  }
  return { queued }
}

// إرسال عبر بوت تيليغرام (غلاف رقيق فوق fetch — يحتاج botToken وchatId الفعليين)
export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

// معالجة الطابور: يجلب التذكيرات ويُرسلها (chatId من جهة اتصال الشخص)
export async function dispatchQueued(db: Db, botToken: string) {
  const queued = await db.select().from(notifications).where(eq(notifications.status, 'queued')).all()
  let sent = 0
  for (const n of queued) {
    const contact = (await db.select().from(personContacts).where(eq(personContacts.personId, n.personId)).all())[0]
    const chatId = contact?.telegram
    let ok = false
    if (chatId) {
      const p = n.payload ? JSON.parse(n.payload) : {}
      ok = await sendTelegram(botToken, chatId, `تذكير: لم يُدخَل سجل «${p.mosqueName ?? ''}» لهذا الأسبوع.`)
    }
    await db.update(notifications).set({ status: ok ? 'sent' : 'failed', sentAt: Date.now() }).where(eq(notifications.id, n.id)).run()
    if (ok) sent++
  }
  return { processed: queued.length, sent }
}
