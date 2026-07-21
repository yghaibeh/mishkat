/**
 * ق-١/ق-٢/ق-٣ — **NESSA: الأقربُ سلَفٌ إشرافيٌّ نشطٌ مُكلَّفٌ حصراً** (عقدُ الوحدة §١).
 *
 * **شرطُ الكفاية** وحدَه يُحسم هنا؛ أمّا **الشرطُ اللازم** (القدرة) فيُسأل عنه `holds` المحقون.
 * وثلاثةُ ثوابتٍ تعيش في الخوارزمية نفسِها لا في `if` تُنسى:
 *  ١. **السلَفُ صارم**: مسارُ الوحدة نفسِها ليس من أسلافها ⇒ **لا وحدةَ تعتمد عملَها** (ق-٩).
 *  ٢. **الأقربُ أعمقُ مسارٍ فيه مكلَّفٌ نشط** ⇒ تفريغُ التكليف يصعد بالتوجيه **تلقائياً** (ق-٢).
 *  ٣. **لا قائمةَ طبقاتٍ ولا اسمَ دورٍ** (ث-٣/G6): إقصاءُ الإدارة **بيانٌ في المصفوفة** لا
 *     `SUPERVISORY_LAYERS` في الكود (د-٤) — فإن مُنحت القدرةُ يوماً دخلت بلا تعديل سطر.
 */

import type { Actor } from "../../../authorization/can.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { ROOT_PATH, contains } from "../../../authorization/scope.js"
import type { CapabilityCheck } from "./authority.js"

export type RoutingContext = {
  readonly now: Date
  /** لقطةُ الفاعلين المحقونة — لا استعلامَ في الخدمة (§٤.٥). */
  readonly people: readonly Actor[]
  readonly holds: CapabilityCheck
}

export type ApproverLayer =
  | { readonly kind: "layer"; readonly scopePath: string; readonly approvers: readonly string[] }
  | { readonly kind: "vacant" }

/** قدرةُ كسر الزجاج واحدةٌ للنظام كلِّه ونطاقُها الجذر (ق-٣، الكتالوج #٦). */
const BREAK_GLASS: CapId = "approve.breakGlass"
/** قدرةُ تعديل المقفل (ق-٨، الكتالوج #٩). */
export const EDIT_LOCKED: CapId = "records.editLocked"

/**
 * أسلافُ الوحدة **من الأعمق إلى الجذر**، ومسارُ الوحدة نفسِها **ليس منها**.
 * `/men/homs/sq2/khalid/` ⟵ `[/men/homs/sq2/, /men/homs/, /men/, /]`
 */
export function ancestorsOf(unitPath: string): readonly string[] {
  const segments = unitPath.split("/").filter((s) => s.length > 0)
  const out: string[] = []
  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    out.push(`/${segments.slice(0, depth).join("/")}/`)
  }
  if (unitPath !== ROOT_PATH) out.push(ROOT_PATH)
  return out
}

/** إسنادٌ **فعّالٌ معتمَدٌ عند هذا المسار بعينه** — أساسُ «مُكلَّفٌ نشط» (ق-١). */
function isAssignedAt(actor: Actor, scopePath: string, now: Date): boolean {
  return actor.assignments.some(
    (a) =>
      a.scopePath === scopePath &&
      a.approvalStatus === "approved" &&
      !a.unitArchived &&
      a.startDate.getTime() <= now.getTime() &&
      (a.endDate === null || a.endDate.getTime() > now.getTime()),
  )
}

/** مَن كُلِّف عند مسارٍ بعينه **ويملك القدرةَ على الوحدة** — مرتَّبون حتمياً. */
export function candidatesAt(
  ctx: RoutingContext,
  capability: CapId,
  layerPath: string,
  unitPath: string,
): readonly string[] {
  return ctx.people
    .filter((p) => isAssignedAt(p, layerPath, ctx.now) && ctx.holds(p.personId, capability, unitPath))
    .map((p) => p.personId)
    .sort()
}

/**
 * **الطبقةُ الأقرب** (ق-١): أوّلُ سلَفٍ — من الأعمق — فيه مكلَّفٌ نشطٌ يملك القدرة.
 * فإن خلت الأسلافُ كلُّها فالجوابُ **شغورٌ كليّ** لا «الإدارة» (ق-٣: كسرُ الزجاج بابٌ آخر).
 */
export function approverLayerFor(
  ctx: RoutingContext,
  capability: CapId,
  unitPath: string,
): ApproverLayer {
  for (const layerPath of ancestorsOf(unitPath)) {
    const approvers = candidatesAt(ctx, capability, layerPath, unitPath)
    if (approvers.length > 0) return { kind: "layer", scopePath: layerPath, approvers }
  }
  return { kind: "vacant" }
}

/** حاملو كسر الزجاج — قدرةٌ **جذرية**: تُطلب على الجذر صراحةً فلا يكون الشمولُ سهواً. */
export function breakGlassHolders(ctx: RoutingContext): readonly string[] {
  return ctx.people
    .filter((p) => ctx.holds(p.personId, BREAK_GLASS, ROOT_PATH))
    .map((p) => p.personId)
    .sort()
}

/**
 * ق-١٢ — **أهو سلَفٌ أعلى من الأقرب؟** (لا الأقربُ نفسُه ولا مَن دونه).
 * يُقاس بالإسناد: مكلَّفٌ عند سلَفٍ **يحتوي مسارَ الأقرب احتواءً صارماً**.
 */
export function isAboveLayer(ctx: RoutingContext, personId: string, layerPath: string): boolean {
  const person = ctx.people.find((p) => p.personId === personId)
  if (person === undefined) return false
  return ancestorsOf(layerPath).some((path) => isAssignedAt(person, path, ctx.now))
}

/** ق-٨ — أهو مكلَّفٌ عند سلَفٍ **صارم** فوق الوحدة؟ (شرطُ تعديل المقفل مع قدرته). */
export function isAboveUnit(ctx: RoutingContext, personId: string, unitPath: string): boolean {
  const person = ctx.people.find((p) => p.personId === personId)
  if (person === undefined) return false
  return ancestorsOf(unitPath).some((path) => isAssignedAt(person, path, ctx.now))
}

/** ق-١٧ — الاطّلاعُ الهابط: أنطاقُ الطلبِ داخلَ ما أنظر فيه؟ */
export function withinScope(scopePath: string, unitPath: string): boolean {
  return contains(scopePath, unitPath)
}
