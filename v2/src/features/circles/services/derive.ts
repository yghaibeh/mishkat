/**
 * **الاشتقاقات** — عقدُ الوحدة §٦: *كلُّ رقمٍ استعلامٌ على المصدر الواحد، و**صفر عدّادٍ مخزَّن***.
 *
 * ثلاثةُ بلاغاتٍ ميدانية جذرُها واحد: رقمٌ مخزَّنٌ تباعد عن واقعه —
 *  - **ع-٢٩**: «أضفتُ لسامح ٣ حلقات فالعدد في صفحته ٠».
 *  - **ع-١٩**: «أضفنا حلقاتٍ فلماذا لم يظهر في الإحصاء سوى على بصيرة؟»
 *  - **ع-٢**: «لماذا مكررة مرتين؟»
 * وعلاجُها هنا **بنيويّ**: لا يوجد عدّادٌ يُحدَّث فيُنسى، ولا قائمتان تُدمجان فتتضاعفان.
 * كلُّ دالةٍ في هذا الملفّ **قراءةٌ محضة** — ولا تكتب حرفاً.
 */

import { contains } from "../../../authorization/scope.js"
import type { CirclesStore } from "../data/store.js"
import { allTypes } from "./catalog.js"
import type { Circle, Enrollment } from "../types.js"

/** الحلقاتُ الحيّةُ وحدها — المؤرشفةُ وسمٌ يُقرأ لا صفٌّ يُمحى. */
function live(store: CirclesStore): readonly Circle[] {
  return store.circles().filter((c) => c.archivedAt === null)
}

/** ترتيبٌ **حتميّ** لا يتغيّر بين تشغيلين: بالمسار ثم بالمعرّف. */
function ordered(circles: readonly Circle[]): readonly Circle[] {
  return [...circles].sort(
    (a, b) => a.unitPath.localeCompare(b.unitPath) || a.id.localeCompare(b.id),
  )
}

/**
 * حلقاتُ نطاقٍ وما تحته، **بمرشّح نوعٍ واحدٍ اختياريّ** (ب-٢٨: مرشّحٌ لا تبويبات).
 * **بلا تكرار بنيوياً**: المصدرُ خريطةٌ بمفتاح المعرّف، فلا دمجَ قائمتين يُضاعف صفّاً (ع-٢).
 */
export function circlesInScope(
  store: CirclesStore,
  scopePath: string,
  typeId?: string,
): readonly Circle[] {
  const inScope = live(store).filter((c) => contains(scopePath, c.unitPath))
  const filtered = typeId === undefined ? inScope : inScope.filter((c) => c.typeId === typeId)
  return ordered(filtered)
}

/**
 * **حلقاتُ المعلّم** — تُشتقّ من الإسناد **لحظةَ السؤال** لا من عدّادٍ مخزَّن (ع-٢٩).
 * والإسنادُ **حقلٌ على الحلقة** لا صفُّ ربطٍ ثانٍ، فإسنادان للشخص نفسِه لا يُنتجان صفّين.
 */
export function circlesOfTeacher(store: CirclesStore, personId: string): readonly Circle[] {
  return ordered(live(store).filter((c) => c.teacherPersonId === personId))
}

/** ملتحقو الحلقة **الحاليّون** — من سجلٍّ واحد، مرتّبين حتمياً. */
export function enrollmentsOf(store: CirclesStore, circleId: string): readonly Enrollment[] {
  return store
    .enrollments()
    .filter((e) => e.circleId === circleId && e.leftAt === null)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** نموذجُ الحلقة المعروض: **السعةُ والملتحقون والمتبقّي من مصدرٍ واحد** (ع-٣، ق-١١١). */
export type CircleView = {
  readonly id: string
  readonly nameAr: string
  readonly typeId: string
  readonly typeAr: string
  readonly unitPath: string
  readonly teacherPersonId: string | null
  readonly capacity: number
  readonly enrolled: number
  readonly remaining: number
  readonly full: boolean
}

/** نصُّ نوعٍ غائبٍ من الكتالوج — لا يُلفَّق اسمٌ، ويبقى المعرّفُ ظاهراً للتشخيص (ق-١١٢). */
const UNNAMED_TYPE = ""

function viewOf(store: CirclesStore, circle: Circle): CircleView {
  const enrolled = enrollmentsOf(store, circle.id).length
  return {
    id: circle.id,
    nameAr: circle.nameAr,
    typeId: circle.typeId,
    typeAr: store.getType(circle.typeId)?.ar ?? UNNAMED_TYPE,
    unitPath: circle.unitPath,
    teacherPersonId: circle.teacherPersonId,
    capacity: circle.capacity,
    enrolled,
    remaining: circle.capacity - enrolled,
    full: enrolled >= circle.capacity,
  }
}

export function circleView(store: CirclesStore, circleId: string): CircleView | null {
  const circle = store.getCircle(circleId)
  return circle === null ? null : viewOf(store, circle)
}

/** إسقاطُ قائمةٍ من الحلقات إلى نماذج عرضٍ — **مصدرٌ واحدٌ للصفحة** (ق-١١١). */
export function viewsOf(store: CirclesStore, circles: readonly Circle[]): readonly CircleView[] {
  return circles.map((c) => viewOf(store, c))
}

export type CircleTypeCount = {
  readonly typeId: string
  readonly ar: string
  readonly count: number
}

export type CircleStats = {
  readonly scopePath: string
  readonly total: number
  readonly byType: readonly CircleTypeCount[]
}

/**
 * **إحصاءُ النطاق شاملاً كلَّ الأنواع** (ع-١٩).
 *
 * **يبدأ من الكتالوج لا من الموجود**: لكل نوعٍ مسجَّلٍ صفٌّ **ولو كان صفراً** — فلا يختفي
 * نوعٌ من الإحصاء لأنه فارغ (وهو عينُ ما رآه العميل: «لم يظهر سوى على بصيرة»).
 * والإجماليُّ **مجموعُ التفصيل** لا رقمٌ ثانٍ يُحسب على حدة (ق-١١١).
 */
export function circleStats(store: CirclesStore, scopePath: string): CircleStats {
  const inScope = circlesInScope(store, scopePath)
  const byType = allTypes(store).map((type) => ({
    typeId: type.id,
    ar: type.ar,
    count: inScope.filter((c) => c.typeId === type.id).length,
  }))
  return {
    scopePath,
    total: byType.reduce((sum, row) => sum + row.count, 0),
    byType,
  }
}
