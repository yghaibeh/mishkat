/**
 * كتالوجُ المنهاج — **بياناتٌ مرجعية قابلة للتوسّع** (قب-٢٢، عقدُ الوحدة §٢).
 *
 * **معنى «منتج» هنا**: إضافةُ منهاجٍ **صفوفٌ تُحفظ**، لا سطرُ كودٍ يُنشر — فلا تحتاج الشبكةُ
 * مبرمجاً لتفتح منهاجاً ثانياً. ولذلك **ليس في هذا الملفّ اسمُ منهاجٍ ولا اسمُ نوعِ حلقةٍ
 * واحد**: كلُّها قيمُ صفوفٍ في المستودع (نظيرُ كتالوج أنواع الحلقات في T16 وكتالوج الأنشطة في T10).
 *
 * **وليس فيه سؤالُ «أمفعَّل؟»** — وهو جوهرُ علاج ع-٨: مفتاحُ التفعيل **بابٌ ثانٍ للمنع** فوق
 * الصلاحية، ولا يُحرَس بالانضباط بل **بغياب الحقل** (`types.ts`).
 */

import type { EducationStore } from "../data/store.js"
import type { EducationContext } from "./context.js"
import {
  educationErr,
  educationOk,
  type Curriculum,
  type CurriculumBook,
  type CurriculumLevel,
  type CurriculumSession,
  type EducationResult,
} from "../types.js"

/** ترتيبٌ حتميّ: الرتبةُ أولاً ثم المعرّف — فلا يتقلّب العرضُ بترتيب الإدخال. */
function byOrdinal<T extends { readonly ordinal: number; readonly id: string }>(a: T, b: T): number {
  return a.ordinal === b.ordinal ? a.id.localeCompare(b.id) : a.ordinal - b.ordinal
}

/** كلُّ المناهج مرتّبةً حتمياً — **بلا مرشّحِ حالة**: كلُّ صفٍّ منهاجٌ صالحٌ بحكم وجوده. */
export function allCurricula(store: EducationStore): readonly Curriculum[] {
  return [...store.curricula()].sort((a, b) => a.id.localeCompare(b.id))
}

/** منهاجُ نوعِ الحلقة — **يُعثر عليه بالنوع لا باسمٍ مُصلَّب**؛ ونوعٌ بلا منهاجٍ ⇒ `null`. */
export function curriculumForCircleType(
  store: EducationStore,
  circleTypeId: string,
): Curriculum | null {
  return allCurricula(store).find((c) => c.circleTypeId === circleTypeId) ?? null
}

export function sessionById(store: EducationStore, sessionId: string): CurriculumSession | null {
  return store.getSession(sessionId)
}

/** منهاجُ المجلس — صعوداً: مجلسٌ ⟵ كتابٌ ⟵ مستوىً ⟵ منهاج. */
export function curriculumOfSession(store: EducationStore, sessionId: string): Curriculum | null {
  const session = store.getSession(sessionId)
  if (session === null) return null
  const book = store.getBook(session.bookId)
  if (book === null) return null
  const level = store.getLevel(book.levelId)
  if (level === null) return null
  return store.getCurriculum(level.curriculumId)
}

/** مجالسُ المنهاج مرتّبةً بالمستوى فالكتاب فالمجلس — **ترتيبٌ حتميّ لا ترتيبُ إدخال**. */
export function sessionsOfCurriculum(
  store: EducationStore,
  curriculumId: string,
): readonly CurriculumSession[] {
  const out: CurriculumSession[] = []
  const levels = store.levels().filter((l) => l.curriculumId === curriculumId).sort(byOrdinal)
  for (const level of levels) {
    const books = store.books().filter((b) => b.levelId === level.id).sort(byOrdinal)
    for (const book of books) {
      out.push(...store.sessions().filter((s) => s.bookId === book.id).sort(byOrdinal))
    }
  }
  return Object.freeze(out)
}

// ── شجرةُ المنهاج (نموذجُ عرضٍ مشتقّ لا كيانٌ مخزَّن) ─────────────────────────

export type ManhajSession = { readonly id: string; readonly ar: string }
export type ManhajBook = { readonly id: string; readonly ar: string; readonly sessions: readonly ManhajSession[] }
export type ManhajLevel = { readonly id: string; readonly ar: string; readonly books: readonly ManhajBook[] }
export type ManhajCurriculum = {
  readonly id: string
  readonly ar: string
  readonly circleTypeId: string
  readonly levels: readonly ManhajLevel[]
}

/** الشجرةُ كاملةً من الصفوف — **كلُّ صفٍّ يظهر**، فلا يختفي منهاجٌ لأنه أُضيف متأخراً. */
export function manhajTree(store: EducationStore): readonly ManhajCurriculum[] {
  return allCurricula(store).map((curriculum) => ({
    id: curriculum.id,
    ar: curriculum.ar,
    circleTypeId: curriculum.circleTypeId,
    levels: store
      .levels()
      .filter((l) => l.curriculumId === curriculum.id)
      .sort(byOrdinal)
      .map((level) => ({
        id: level.id,
        ar: level.ar,
        books: store
          .books()
          .filter((b) => b.levelId === level.id)
          .sort(byOrdinal)
          .map((book) => ({
            id: book.id,
            ar: book.ar,
            sessions: store
              .sessions()
              .filter((s) => s.bookId === book.id)
              .sort(byOrdinal)
              .map((s) => ({ id: s.id, ar: s.ar })),
          })),
      })),
  }))
}

// ── الكتابةُ: صفوفٌ تُضاف بياناً (قب-٢٢) ──────────────────────────────────────

/** التحقّقُ عند الحدّ (المادة ٣/٣): اسمٌ غيرُ فارغ، ورتبةٌ صحيحةٌ غيرُ سالبة. */
function shape(ar: string, ordinal?: number): EducationResult<null> {
  if (ar.trim().length === 0) return educationErr("EMPTY_NAME")
  if (ordinal !== undefined && (!Number.isInteger(ordinal) || ordinal < 0)) {
    return educationErr("INVALID_ORDINAL", String(ordinal))
  }
  return educationOk(null)
}

export type UpsertCurriculumInput = {
  readonly id: string
  readonly ar: string
  readonly circleTypeId: string
}

/**
 * **منهاجٌ يُضاف بياناً فيعمل فوراً** (قب-٢٢) — والنوعُ **من كتالوج الأنواع** لا من كتابةٍ
 * حرّة (ق-٨٩): فمعجمُ الأنواع مصدرٌ واحدٌ يُسأل، لا معجمان يتباعدان (CR-014).
 */
export function upsertCurriculum(
  store: EducationStore,
  ctx: EducationContext,
  input: UpsertCurriculumInput,
): EducationResult<Curriculum> {
  const valid = shape(input.ar)
  if (!valid.ok) return valid
  if (!ctx.circleTypeIds().includes(input.circleTypeId)) {
    return educationErr("UNKNOWN_CIRCLE_TYPE", input.circleTypeId)
  }
  const row: Curriculum = {
    tenantId: store.tenantId,
    id: input.id,
    ar: input.ar.trim(),
    circleTypeId: input.circleTypeId,
  }
  store.saveCurriculum(row)
  return educationOk(row)
}

export type UpsertLevelInput = {
  readonly id: string
  readonly curriculumId: string
  readonly ar: string
  readonly ordinal: number
}

export function upsertLevel(
  store: EducationStore,
  ctx: EducationContext,
  input: UpsertLevelInput,
): EducationResult<CurriculumLevel> {
  void ctx
  const valid = shape(input.ar, input.ordinal)
  if (!valid.ok) return valid
  if (store.getCurriculum(input.curriculumId) === null) {
    return educationErr("UNKNOWN_CURRICULUM", input.curriculumId)
  }
  const row: CurriculumLevel = {
    tenantId: store.tenantId,
    id: input.id,
    curriculumId: input.curriculumId,
    ar: input.ar.trim(),
    ordinal: input.ordinal,
  }
  store.saveLevel(row)
  return educationOk(row)
}

export type UpsertBookInput = {
  readonly id: string
  readonly levelId: string
  readonly ar: string
  readonly ordinal: number
}

export function upsertBook(
  store: EducationStore,
  ctx: EducationContext,
  input: UpsertBookInput,
): EducationResult<CurriculumBook> {
  void ctx
  const valid = shape(input.ar, input.ordinal)
  if (!valid.ok) return valid
  if (store.getLevel(input.levelId) === null) return educationErr("UNKNOWN_LEVEL", input.levelId)
  const row: CurriculumBook = {
    tenantId: store.tenantId,
    id: input.id,
    levelId: input.levelId,
    ar: input.ar.trim(),
    ordinal: input.ordinal,
  }
  store.saveBook(row)
  return educationOk(row)
}

export type UpsertSessionInput = {
  readonly id: string
  readonly bookId: string
  readonly ar: string
  readonly ordinal: number
}

export function upsertSession(
  store: EducationStore,
  ctx: EducationContext,
  input: UpsertSessionInput,
): EducationResult<CurriculumSession> {
  void ctx
  const valid = shape(input.ar, input.ordinal)
  if (!valid.ok) return valid
  if (store.getBook(input.bookId) === null) return educationErr("UNKNOWN_BOOK", input.bookId)
  const row: CurriculumSession = {
    tenantId: store.tenantId,
    id: input.id,
    bookId: input.bookId,
    ar: input.ar.trim(),
    ordinal: input.ordinal,
  }
  store.saveSession(row)
  return educationOk(row)
}
