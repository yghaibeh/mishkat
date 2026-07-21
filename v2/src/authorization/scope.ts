/**
 * النطاق وثابت تمثيله — SPEC_authorization §١.٥ و§٥.٢.
 *
 * الثابت الملزم: كل مسار يبدأ بـ`/` وينتهي بـ`/`.
 * بدون الشرطة الختامية يصير `/men/r1` بادئةً لـ`/men/r10` فيرى مسؤولُ المنطقة ١
 * بياناتِ المنطقة ١٠ — تسريبُ نطاقٍ صامت.
 */

export const ROOT_PATH = "/"

export type UnitScope = { readonly kind: "unit"; readonly path: string }
export type SelfScope = {
  readonly kind: "self"
  readonly ownerPersonId: string
  readonly entityType: string
  readonly entityId: string
}
/** لا نطاق: الكيان غير موجود ⇒ رفض. يُقفل ولا يُفتح (§٥.٢ ثابت ٣). */
export type NoScope = { readonly kind: "none" }

export type Scope = UnitScope | SelfScope | NoScope

export const NO_SCOPE: NoScope = Object.freeze({ kind: "none" })

/** ثابت التمثيل (§١.٥) — حارسه بوابة، ويُفحص على كل مسار مخزَّن ومبنيّ. */
export function isValidScopePath(path: string): boolean {
  if (path === ROOT_PATH) return true
  if (!path.startsWith("/") || !path.endsWith("/")) return false
  if (path.includes("//")) return false
  return true
}

function assertValidPath(path: string, label: string): void {
  if (!isValidScopePath(path)) {
    throw new Error(`مسار نطاق مخالف لثابت التمثيل (§١.٥) في ${label}: ${JSON.stringify(path)}`)
  }
}

/**
 * `contains(a, b)` ⟺ `b` محتوىً في `a` — بشرط الشرطة الختامية.
 * يرمي على مسار مخالف بدل أن يجيب صامتاً: الجواب الصامت على مدخل فاسد هو الثغرة نفسها.
 */
export function contains(outer: string, inner: string): boolean {
  assertValidPath(outer, "المحتوي")
  assertValidPath(inner, "المحتوى")
  return inner.startsWith(outer)
}

/** النمط الأول من ثلاثة (§٥.٢): نطاق وحدة مشتقٌّ من الكيان المخزَّن لا من مدخل العميل. */
export function unitScope(path: string | null | undefined): UnitScope | NoScope {
  if (path === null || path === undefined) return NO_SCOPE
  assertValidPath(path, "unitScope")
  return { kind: "unit", path }
}

/** النمط الثاني: الجذر — للقدرات الجذرية. */
export function rootScope(): UnitScope {
  return { kind: "unit", path: ROOT_PATH }
}

/** النمط الثالث: الملكية — للقدرات الشخصية. */
export function selfScope(ownerPersonId: string, entityType: string, entityId: string): SelfScope {
  return { kind: "self", ownerPersonId, entityType, entityId }
}
