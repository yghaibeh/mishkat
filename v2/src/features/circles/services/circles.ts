/**
 * دورةُ حياة الحلقة — **الكاتبُ الوحيد** لكيان الحلقة (عقدُ الوحدة §١/§٣/§٤).
 *
 * لا يوجد في هذا الملفّ — **ولا في الوحدة كلِّها** — دالةُ جسرٍ ولا مزامنةٍ ولا توأمة:
 * ق-٨٨ **قاعدةٌ متقاعدة** لأنّ سببَها (ثلاثةُ سجلاتٍ منفصلة) لم يعد قائماً (عقدُ الوحدة §٩).
 * والحلقةُ تُكتب مرةً واحدةً في مكانٍ واحد، فلا شيءَ يُخاط بشيء.
 */

import type { CirclesStore } from "../data/store.js"
import type { CirclesContext } from "./context.js"
import { typeById } from "./catalog.js"
import { circlesErr, circlesOk, type Circle, type CirclesResult } from "../types.js"

export type CreateCircleInput = {
  readonly unitId: string
  readonly typeId: string
  readonly nameAr: string
  readonly capacity: number
}

/** التحقّقُ عند الحدّ (المادة ٣/٣): اسمٌ غيرُ فارغ، وسعةٌ غيرُ سالبة. */
function validateShape(nameAr: string, capacity: number): CirclesResult<null> {
  if (nameAr.trim().length === 0) return circlesErr("EMPTY_NAME")
  if (!Number.isInteger(capacity) || capacity < 0) {
    return circlesErr("INVALID_CAPACITY", String(capacity))
  }
  return circlesOk(null)
}

/**
 * **إنشاءُ حلقةٍ من أيّ نوعٍ قائم** (ع-٥/ع-٨).
 *
 * السؤالُ عن النوع سؤالٌ **واحد**: أهو في الكتالوج؟ — فلا «قسمٌ غير مفعّل» يمنع نوعاً قائماً.
 * وموطنُها مسارُ وحدتها المخزَّن، ومنه يُشتقّ النطاق في دالة الخادم (§٥.٢ ثابت ٢).
 */
export function createCircle(
  store: CirclesStore,
  ctx: CirclesContext,
  input: CreateCircleInput,
): CirclesResult<Circle> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return circlesErr("UNKNOWN_UNIT", input.unitId)
  if (typeById(store, input.typeId) === null) {
    return circlesErr("UNKNOWN_CIRCLE_TYPE", input.typeId)
  }
  const shape = validateShape(input.nameAr, input.capacity)
  if (!shape.ok) return shape

  const circle: Circle = {
    tenantId: store.tenantId,
    id: store.nextId("circle"),
    unitPath: unit.path,
    typeId: input.typeId,
    nameAr: input.nameAr.trim(),
    capacity: input.capacity,
    teacherPersonId: null,
    archivedAt: null,
    createdAt: ctx.now,
  }
  store.saveCircle(circle)
  return circlesOk(circle)
}

/** حلقةٌ حيّةٌ قابلةٌ للعمل عليها — والمؤرشفةُ تُردّ بسببٍ مميِّزٍ لا بصمت. */
function liveCircle(store: CirclesStore, circleId: string): CirclesResult<Circle> {
  const circle = store.getCircle(circleId)
  if (circle === null) return circlesErr("UNKNOWN_CIRCLE", circleId)
  if (circle.archivedAt !== null) return circlesErr("CIRCLE_ARCHIVED", circleId)
  return circlesOk(circle)
}

export { liveCircle }

export type UpdateCircleInput = {
  readonly circleId: string
  readonly nameAr?: string
  readonly typeId?: string
  readonly capacity?: number
}

/**
 * تعديلُ الحلقة — **الحقولُ الثلاثةُ وحدها**، والغائبُ يبقى كما هو (لا حقلَ يُصفَّر بالسهو).
 * وتغييرُ النوع **تغييرُ صفةٍ لا نقلٌ بين أنظمة**: لا سجلَّ يُهاجَر ولا توأمَ يُزامَن.
 */
export function updateCircle(
  store: CirclesStore,
  ctx: CirclesContext,
  input: UpdateCircleInput,
): CirclesResult<Circle> {
  void ctx
  const found = liveCircle(store, input.circleId)
  if (!found.ok) return found
  const current = found.value

  const nameAr = input.nameAr ?? current.nameAr
  const capacity = input.capacity ?? current.capacity
  const typeId = input.typeId ?? current.typeId

  if (typeById(store, typeId) === null) return circlesErr("UNKNOWN_CIRCLE_TYPE", typeId)
  const shape = validateShape(nameAr, capacity)
  if (!shape.ok) return shape

  const updated: Circle = { ...current, nameAr: nameAr.trim(), capacity, typeId }
  store.saveCircle(updated)
  return circlesOk(updated)
}

/** الأرشفةُ **تعطيلٌ منطقيٌّ بوسم** (المادة ٧/٤) — والصفُّ باقٍ فلا يضيع تاريخُ الحلقة. */
export function archiveCircle(
  store: CirclesStore,
  ctx: CirclesContext,
  input: { readonly circleId: string },
): CirclesResult<Circle> {
  const found = liveCircle(store, input.circleId)
  if (!found.ok) return found
  const archived: Circle = { ...found.value, archivedAt: ctx.now }
  store.saveCircle(archived)
  return circlesOk(archived)
}

export type AssignTeacherInput = {
  readonly circleId: string
  /** `null` يُخلي الحلقةَ من معلّمها بلا مساسٍ بها. */
  readonly teacherPersonId: string | null
}

/**
 * **إسنادُ المعلّم** — فعلُ الأمير (`circle.manage`)، والمُسنَدُ إليه **من أهل الوحدة**
 * (يُقاس بمسار تكليفه لا بمسمّاه — G6).
 *
 * **وقب-٣٨ يُفرَض في المحرّك لا هنا**: الإسنادُ يجعله صاحبَ الحلقة، ولا يمنحه القدرةَ —
 * فمَن لا تحمل حزمةُ دورِه `circle.teach` يُردّ بـ`DENIED_PERSONAL_NOT_IN_ROLE` ولو أُسنِد.
 * والحسابُ ودورُه موطنُهما التمكينُ المفوَّض في `org` — **يُستعمل ولا يُعاد بناؤه**.
 */
export function assignTeacher(
  store: CirclesStore,
  ctx: CirclesContext,
  input: AssignTeacherInput,
): CirclesResult<Circle> {
  const found = liveCircle(store, input.circleId)
  if (!found.ok) return found
  const circle = found.value

  if (input.teacherPersonId !== null && !ctx.reaches(input.teacherPersonId, circle.unitPath)) {
    return circlesErr("TEACHER_OUT_OF_SCOPE", input.teacherPersonId)
  }

  const assigned: Circle = { ...circle, teacherPersonId: input.teacherPersonId }
  store.saveCircle(assigned)
  return circlesOk(assigned)
}
