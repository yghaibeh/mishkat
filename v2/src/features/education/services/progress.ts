/**
 * **ق-٩٢ — تقدّمُ الطالب في المنهج: مشتقٌّ لا مخزَّن** (عقدُ الوحدة §٥).
 *
 * القاعدةُ نصاً: «عند **اعتماد** درسٍ له مجلس، تُعلَّم **الحاضرات** «أكملن المجلس» آلياً،
 * مع إمكان التعديل اليدويّ». وفي v2 لا يُكتب شيءٌ عند الاعتماد أصلاً: **المصفوفةُ تُبنى
 * لحظةَ السؤال** من ثلاثة مصادر لا رابعَ لها — ملتحقو الحلقة · مجالسُ منهاج نوعها · دروسُها
 * **المعتمَدة** (يُسأل عنها منفذاً — G22).
 *
 * **ولماذا الاشتقاق؟** لأنّ العدّادَ المخزَّن هو بعينه ما أنتج ع-١٩ وع-٢٩ في v1: تُكتب قيمةٌ
 * في لحظة، ثم يتغيّر الواقعُ ولا تتغيّر — «انفصامُ الكتابة عن القراءة» (ج٥). وما لا يُخزَّن
 * **لا يستطيع** أن يتباعد.
 *
 * **والتصحيحُ اليدويُّ بصمةٌ فوق الاشتقاق** (قب-٩): مَن/ماذا/متى/لماذا ظاهرةٌ في سجلٍّ يُلحق
 * ولا يُمحى، وآخرُ بصمةٍ تغلب — وحذفُ البصمات يُعيد الاشتقاقَ الخام كما هو.
 */

import type { EducationStore } from "../data/store.js"
import type { EducationContext } from "./context.js"
import { curriculumForCircleType, sessionsOfCurriculum } from "./curriculum.js"
import { attendanceOf, lessonsOfCircle } from "./lessons.js"
import {
  educationErr,
  educationOk,
  type EducationResult,
  type ProgressCorrection,
} from "../types.js"

/** مصدرُ الخليّة: اشتقاقٌ من درسٍ معتمَد، أو بصمةُ تصحيحٍ تغلبه — **معلنٌ لا مبهم**. */
export type ProgressSource = "derived" | "correction"

export type ProgressCell = {
  readonly sessionId: string
  readonly completed: boolean
  readonly source: ProgressSource
}

export type ProgressRow = {
  readonly enrollmentId: string
  readonly nameAr: string
  readonly cells: readonly ProgressCell[]
}

export type ProgressMatrix = {
  readonly circleId: string
  readonly curriculumId: string
  readonly curriculumAr: string
  readonly sessions: readonly { readonly id: string; readonly ar: string }[]
  readonly rows: readonly ProgressRow[]
  /** أرقامٌ **تُحسب هنا لحظةَ السؤال** — ولا حقلَ في أيّ كيانٍ يحفظها. */
  readonly completedCells: number
  readonly totalCells: number
}

/** آخرُ بصمةِ تصحيحٍ لخليّةٍ بعينها — الإلحاقُ سجلٌّ، والأحدثُ هو الحاكم. */
function correctionFor(
  store: EducationStore,
  circleId: string,
  enrollmentId: string,
  sessionId: string,
): ProgressCorrection | null {
  let latest: ProgressCorrection | null = null
  for (const c of store.corrections()) {
    if (c.circleId !== circleId || c.enrollmentId !== enrollmentId || c.sessionId !== sessionId) continue
    if (latest === null || c.at.getTime() >= latest.at.getTime()) latest = c
  }
  return latest
}

/**
 * **مصفوفةُ تقدّم المنهج** (IA ك-٤) — طلابٌ × مجالس.
 * والخليّةُ «أُكملت» ⟺ **حضر الطالبُ درساً على ذلك المجلس واعتُمد ذلك الدرس**؛ فالتسجيلُ
 * وحده لا يحرّك شيئاً، والاعتمادُ يحرّكه **بلا كتابةٍ ثانية**.
 */
export function curriculumProgress(
  store: EducationStore,
  ctx: EducationContext,
  circleId: string,
): EducationResult<ProgressMatrix> {
  const circle = ctx.circleOf(circleId)
  if (circle === null) return educationErr("UNKNOWN_CIRCLE", circleId)
  const curriculum = curriculumForCircleType(store, circle.typeId)
  if (curriculum === null) return educationErr("NO_CURRICULUM_FOR_TYPE", circle.typeId)

  const sessions = sessionsOfCurriculum(store, curriculum.id)
  const roster = ctx.rosterOf(circle.id)

  // **الدروسُ المعتمَدة وحدها** — والسؤالُ عن حالٍ لا عن سلسلة (G22).
  const approvedBySession = new Map<string, ReadonlySet<string>>()
  for (const lesson of lessonsOfCircle(store, circle.id)) {
    if (!ctx.isLessonApproved(lesson.id)) continue
    const present = new Set(
      attendanceOf(store, lesson.id)
        .filter((a) => a.present)
        .map((a) => a.enrollmentId),
    )
    const merged = new Set(approvedBySession.get(lesson.sessionId) ?? [])
    for (const id of present) merged.add(id)
    approvedBySession.set(lesson.sessionId, merged)
  }

  let completedCells = 0
  const rows = roster.map<ProgressRow>((member) => ({
    enrollmentId: member.id,
    nameAr: member.nameAr,
    cells: sessions.map<ProgressCell>((session) => {
      const derived = approvedBySession.get(session.id)?.has(member.id) === true
      const correction = correctionFor(store, circle.id, member.id, session.id)
      const completed = correction === null ? derived : correction.completed
      if (completed) completedCells += 1
      return {
        sessionId: session.id,
        completed,
        source: correction === null ? "derived" : "correction",
      }
    }),
  }))

  return educationOk({
    circleId: circle.id,
    curriculumId: curriculum.id,
    curriculumAr: curriculum.ar,
    sessions: sessions.map((s) => ({ id: s.id, ar: s.ar })),
    rows,
    completedCells,
    totalCells: rows.length * sessions.length,
  })
}

export type MarkProgressInput = {
  readonly circleId: string
  readonly enrollmentId: string
  readonly sessionId: string
  readonly completed: boolean
  readonly reasonAr: string
}

/**
 * **التصحيحُ اليدويّ المحكوم** (ق-٩٢ ذيلاً · قب-٩): بابٌ ضيّقٌ **بأثرٍ مدقَّقٍ ظاهر** —
 * ولا يُلغي الاشتقاقَ بل يعلوه، فيبقى مصدرُ الحقيقة واحداً ويبقى التدخّلُ مقروءاً.
 */
export function markProgress(
  store: EducationStore,
  ctx: EducationContext,
  input: MarkProgressInput,
): EducationResult<ProgressCorrection> {
  const circle = ctx.circleOf(input.circleId)
  if (circle === null) return educationErr("UNKNOWN_CIRCLE", input.circleId)
  const curriculum = curriculumForCircleType(store, circle.typeId)
  if (curriculum === null) return educationErr("NO_CURRICULUM_FOR_TYPE", circle.typeId)

  const reason = input.reasonAr.trim()
  if (reason.length === 0) return educationErr("EMPTY_REASON")

  if (!ctx.rosterOf(circle.id).some((m) => m.id === input.enrollmentId)) {
    return educationErr("NOT_ENROLLED", input.enrollmentId)
  }
  if (!sessionsOfCurriculum(store, curriculum.id).some((s) => s.id === input.sessionId)) {
    return educationErr("UNKNOWN_SESSION", input.sessionId)
  }

  const correction: ProgressCorrection = {
    tenantId: store.tenantId,
    id: store.nextId("fix"),
    circleId: circle.id,
    enrollmentId: input.enrollmentId,
    sessionId: input.sessionId,
    completed: input.completed,
    at: ctx.now,
    byPersonId: ctx.actorPersonId,
    reasonAr: reason,
  }
  store.saveCorrection(correction)
  return educationOk(correction)
}
