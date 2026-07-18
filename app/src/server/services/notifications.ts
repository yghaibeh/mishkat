import { and, eq, isNull } from 'drizzle-orm'
import { orgUnits, weeklyRecords, roleAssignments, personContacts, notifications, pushSubscriptions } from '../database/schema'
import { ROLES } from '../utils/rbac'
import type { Db } from '../utils/db'
import { sendWebPush, type Vapid } from '../utils/webpush'

const APP_ORIGIN = 'https://mishkat.yghaibeh.workers.dev'

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
      isNull(roleAssignments.endDate), // ف٥
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

// إشعار لكلّ جهةٍ أعلى تغطّي المسجد عند اعتماد الأمير (أسبوع يحتاج اعتمادكم)
// ق1 (المُحدَّث): يُشعَر جميع المسؤولين الأعلى — المربع والمنطقة والإدارة العليا — لا أقرب طبقة فقط.
// ق1-د (الوثيقة ٢٩): يُشعَر «الطبقةُ الأقرب» (NESSA) فقط — لا كلُّ المُغطِّين ولا الإدارة.
// عند شغور كلّ الطبقات فوق الوحدة ⇒ يُشعَر الإدارةُ بإشعار «كسر الزجاج» (بلا معتمِدٍ مُعيَّن).
export async function queueLayerApprovalNeeded(db: Db, mosqueId: string, mosqueName: string, mosquePath: string, weekStart: string) {
  const { approverLayerFor } = await import('./approvalRouting')
  const layer = await approverLayerFor(db, mosquePath)
  const now = Date.now()
  if (layer.kind === 'layer') {
    for (const personId of layer.approverPersonIds) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(), personId, channel: 'telegram', kind: 'layer_approval_needed',
        payload: JSON.stringify({ mosqueId, mosqueName, weekStart }), status: 'queued', createdAt: now, sentAt: null,
      }).run()
    }
    return
  }
  // شاغرٌ: كسرُ الزجاج للإدارة العليا النشطة
  const admins = await db.select().from(roleAssignments).where(and(
    eq(roleAssignments.role, ROLES.ADMIN), isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, 'approved'),
  )).all()
  const seen = new Set<string>()
  for (const a of admins) {
    if (seen.has(a.personId)) continue
    seen.add(a.personId)
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId: a.personId, channel: 'inapp', kind: 'layer_approval_needed',
      payload: JSON.stringify({ mosqueId, mosqueName, weekStart, breakGlass: true }), status: 'queued', createdAt: now, sentAt: null,
    }).run()
  }
}

// إشعار للأمير عند اعتماد أسبوعه نهائياً من الطبقة الأعلى
export async function queueFinalApproved(db: Db, mosqueId: string, mosqueName: string, weekStart: string) {
  const amir = (await db.select().from(roleAssignments).where(
    and(eq(roleAssignments.role, 'amir'), eq(roleAssignments.orgUnitId, mosqueId), isNull(roleAssignments.endDate))
  ).all())[0];
  if (!amir) return;
  await db.insert(notifications).values({
    id: crypto.randomUUID(), personId: amir.personId, channel: 'inapp',
    kind: 'week_approved',
    payload: JSON.stringify({ mosqueId, mosqueName, weekStart }),
    status: 'queued', createdAt: Date.now(), sentAt: null,
  }).run();
}

// إشعار للأمير عند رفض أسبوعه (يحتاج مراجعة وإعادة إرسال)
export async function queueRejectionNotice(db: Db, mosqueId: string, mosqueName: string, weekStart: string, reason: string) {
  const amirAssignment = (await db.select().from(roleAssignments).where(
    and(eq(roleAssignments.role, 'amir'), eq(roleAssignments.orgUnitId, mosqueId), isNull(roleAssignments.endDate))
  ).all())[0];
  if (!amirAssignment) return;
  const now = Date.now();
  await db.insert(notifications).values({
    id: crypto.randomUUID(), personId: amirAssignment.personId, channel: 'telegram',
    kind: 'week_rejected',
    payload: JSON.stringify({ mosqueId, mosqueName, weekStart, reason }),
    status: 'queued', createdAt: now, sentAt: null,
  }).run();
}

// إرسال عبر بوت تيليغرام (غلاف رقيق فوق fetch — يحتاج botToken وchatId الفعليين)
export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // بلا parse_mode: رسائلُنا نصٌّ صرفٌ بلا وسومٍ مقصودة — فإسقاطُه يُبطل حقن HTML من الأسماء (ق٤)
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    return res.ok
  } catch {
    return false
  }
}

// نصّ الإشعار (عنوان + متن + رابط) من نوعه وحمولته — مشترَكٌ بين تيليغرام وWeb Push
function buildMessage(kind: string, p: Record<string, unknown>): { title: string; body: string; url?: string } {
  const mosque = (p.mosqueName as string) ?? ''
  const week = (p.weekStart as string) ?? ''
  const url = p.mosqueId ? `${APP_ORIGIN}/mosque/${p.mosqueId}?t=report` : APP_ORIGIN
  if (kind === 'layer_approval_needed') return { title: 'أسبوعٌ يحتاج اعتمادكم', body: `يحتاج مسجد «${mosque}» اعتمادكم للأسبوع المبدوء ${week}.`, url }
  if (kind === 'week_approved') return { title: 'اعتمادٌ نهائيّ', body: `اعتُمد أسبوع مسجد «${mosque}» نهائيًّا. بارك الله فيكم.`, url }
  if (kind === 'week_rejected') return { title: 'أسبوعٌ مرفوض', body: `رُفض أسبوع مسجد «${mosque}» (${week}) — السبب: ${(p.reason as string) ?? ''}. راجِع وأعد الاعتماد.`, url }
  if (kind === 'supervision_visit_submitted') return { title: 'زيارةٌ إشرافيّة', body: `زيارةٌ إشرافيّة على «${(p.circleName as string) ?? ''}» بانتظار اعتمادك.`, url: `${APP_ORIGIN}/ala-baseera?tab=supervision` }
  if (kind === 'tahfeez_register_due') return { title: 'سجلُّ اليوم ينتظرك', body: `لم يُسجَّل سجلُّ اليوم لحلقة «${(p.circleName as string) ?? ''}» — سجّل التفقّد والتسميع.`, url: `${APP_ORIGIN}/my-circles` }
  if (kind === 'announcement') return { title: `📢 ${(p.title as string) ?? 'إعلان'}`, body: `${(p.body as string) ?? ''}${p.by ? ` — ${p.by as string}` : ''}`, url: APP_ORIGIN }
  if (kind === 'lesson_reminder') {
    const t = new Date((p.startsAt as number) ?? 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
    return { title: 'تذكيرٌ بدرس اليوم', body: `«${(p.title as string) ?? ''}» الساعة ${t}${p.place ? ` في ${p.place as string}` : ''}.`, url: APP_ORIGIN }
  }
  if (kind === 'activity_due') return { title: 'نشاطٌ يستحقّ غدًا', body: `«${(p.title as string) ?? ''}» ولم تُرسل ردّك — بادر.`, url: `${APP_ORIGIN}/duties` }
  if (kind === 'exam_due') return { title: 'تسليمٌ يُغلق قريبًا', body: `«${(p.title as string) ?? ''}» ينتهي خلال يوم — سلِّم الآن.`, url: `${APP_ORIGIN}/duties` }
  if (kind === 'exam_published') return { title: p.kind === 'homework' ? 'واجبٌ جديد' : 'اختبارٌ جديد', body: `«${(p.title as string) ?? ''}» — سلِّم قبل انتهاء الوقت.`, url: `${APP_ORIGIN}/duties` }
  if (kind === 'exam_submitted') return { title: 'تسليمٌ جديد', body: `سلّم ${(p.student as string) ?? 'طالب'} «${(p.title as string) ?? ''}» — ${p.score}/${p.maxScore}.`, url: `${APP_ORIGIN}/duties` }
  if (kind === 'activity_new') return { title: 'نشاطٌ مطلوبٌ منك', body: `«${(p.title as string) ?? ''}» — افتح «المطلوب اليوم» وأرسل ردّك.`, url: `${APP_ORIGIN}/duties` }
  if (kind === 'activity_response') return { title: 'ردٌّ جديد', body: `ردّ ${(p.student as string) ?? 'طالب'} على نشاط «${(p.title as string) ?? ''}».`, url: `${APP_ORIGIN}/duties` }
  if (kind === 'material_reminder') {
    const t = (p.title as string) ?? ''
    const d = p.daysSince as number | undefined
    return { title: 'تذكير المكتبة التدريبيّة', body: `مادّة «${t}» إلزاميّةٌ لم تُنجَز بعد${d ? ` (منذ ${d} يومًا)` : ''} — أتمّها وأقرّ بإنجازها.`, url: `${APP_ORIGIN}/library` }
  }
  if (kind === 'registration_pending') {
    const who = (p.fullName as string) ?? ''
    const role = (p.roleLabel as string) ?? ''
    const unit = p.unitName ? ` لمسجدٍ جديد «${p.unitName as string}»` : ''
    return { title: 'طلب انضمامٍ جديد', body: `${who} — ${role}${unit}. بانتظار بتّك.`, url: `${APP_ORIGIN}/duties` }
  }
  if (kind === 'supervision_due') {
    const c = (p.circleName as string) ?? ''
    const days = p.daysSince as number | null | undefined
    return p.status === 'never'
      ? { title: 'حلقةٌ تنتظر زيارتك', body: `حلقة «${c}» لم تُزَر بعد — يلزمها زيارةٌ إشرافيّة.`, url: `${APP_ORIGIN}/ala-baseera?tab=supervision` }
      : { title: 'زيارةٌ إشرافيّة متأخّرة', body: `تأخّرت زيارة حلقة «${c}»${days != null ? ` (آخر زيارة قبل ${days} يومًا)` : ''}.`, url: `${APP_ORIGIN}/ala-baseera?tab=supervision` }
  }
  if (kind === 'finance_proposal') {
    const amt = p.amountUsd ? ` (بقيمة $${p.amountUsd})` : ''
    return { title: 'اقتراحٌ ماليٌّ ينتظر اعتمادك', body: `«${(p.summary as string) ?? ''}»${amt} — افتح الملفَّ الماليَّ للبتّ.`, url: `${APP_ORIGIN}/finance` }
  }
  if (kind === 'finance_decision') {
    const s = (p.summary as string) ?? ''
    if (p.outcome === 'approved') return { title: 'اعتُمد اقتراحك الماليّ', body: `اعتُمد ونُفِّذ: «${s}».`, url: `${APP_ORIGIN}/finance` }
    if (p.outcome === 'failed') return { title: 'تعذّر تنفيذُ اقتراحك', body: `«${s}» — ${(p.error as string) ?? ''}.`, url: `${APP_ORIGIN}/finance` }
    return { title: 'رُفض اقتراحك الماليّ', body: `«${s}» — السبب: ${(p.reason as string) ?? ''}. عدِّل وأعد التقديم.`, url: `${APP_ORIGIN}/finance` }
  }
  return { title: 'تذكير الإدخال', body: `لم يُدخَل سجل «${mosque}» لهذا الأسبوع.`, url }
}

// معالجة الطابور: يُرسل عبر القناتين (تيليغرام + Web Push) لكلّ من ربطها؛ ينجح القيد إن وصلت إحداهما.
export async function dispatchQueued(db: Db, opts: { botToken?: string; vapid?: Vapid }) {
  const { botToken, vapid } = opts
  const queued = await db.select().from(notifications).where(eq(notifications.status, 'queued')).all()
  let sent = 0
  let push = 0
  let errored = 0
  for (const n of queued) {
    // عزلٌ لكلّ إشعار: حمولةٌ فاسدةٌ أو عطبٌ عابرٌ لا يوقفان تسليمَ البقيّة (تدقيق الرصد).
    try {
      let p: Record<string, unknown> = {}
      try { p = n.payload ? JSON.parse(n.payload) : {} } catch { p = {} }
      const msg = buildMessage(n.kind, p)
      const link = msg.url ? `\n${msg.url}` : ''
      let ok = false

      // القناة ١: تيليغرام
      if (botToken) {
        const contact = (await db.select().from(personContacts).where(eq(personContacts.personId, n.personId)).all())[0]
        if (contact?.telegram) ok = (await sendTelegram(botToken, contact.telegram, `${msg.body}${link}`)) || ok
      }

      // القناة ٢: Web Push (لكلّ أجهزة الشخص المشترِكة)
      if (vapid) {
        const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.personId, n.personId)).all()
        for (const s of subs) {
          const r = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, msg, vapid)
          if (r.ok) { ok = true; push++ }
          else if (r.gone) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).run() // اشتراكٌ منتهٍ ⇒ نظّف
        }
      }

      await db.update(notifications).set({ status: ok ? 'sent' : 'failed', sentAt: Date.now() }).where(eq(notifications.id, n.id)).run()
      if (ok) sent++
    } catch (e) {
      errored++
      console.error(`[dispatch] notification ${n.id} (${n.kind}) failed:`, (e as Error)?.message ?? e)
    }
  }
  return { processed: queued.length, sent, push, errored }
}
