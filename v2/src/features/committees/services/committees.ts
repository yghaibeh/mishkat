/**
 * ب-١٨ + ع-١٧ — **الأميرُ يشكّل لجانَ مسجده** (عقدُ الوحدة §١).
 *
 * ثلاثةُ ثوابتٍ بنيويّة:
 *  ١. **مسارُ اللجنة يُبنى بدالة** من مسار مسجدها ومعرّفها (ت-٢: «اجعل بناء المسار دالة»)،
 *     فيصير أميرُ المسجد **أقربَ سلَفٍ إشرافيٍّ فوقها** — وسلسلةُ ق-١٣ تجري عليها **بالبنية**
 *     لا بحالةٍ خاصة في محرّك الاعتماد.
 *  ٢. **الوحدةُ لا تُنشئ حساباً أبداً**: تمكينُ حسابِ مسؤول اللجنة (ع-١٧) **مبنيٌّ في وحدة
 *     `org`** (`users.provision` — قب-٤)، ويصل هنا **معرّفاً جاهزاً** أو لا يصل فيبقى
 *     المسؤولُ **اسماً حرّاً** (ق-٣١). لا استيرادَ لوحدة التوفير، ولا نسخةَ ثانيةٌ منها.
 *  ٣. **لا محو**: الإيقافُ حالةٌ في البيانات (المادة ٧/٤) — تخرج اللجنةُ من العاملة وتبقى
 *     أنشطتُها المعتمَدة محفوظةً في سجل مسجدها.
 *
 * و**صفر فحصِ دور** (G6): القدرةُ تُفرَض عند حدّ الخادم، وهذه الطبقةُ لا تعرف دوراً.
 */

import type { CommitteeStore } from "../data/store.js"
import { contains } from "../../../authorization/scope.js"
import { areCommitteesEnabled, type CommitteeContext } from "./context.js"
import { err, ok, type Committee, type Result } from "../types.js"

/** بناءُ مسار اللجنة **دالةٌ** لا سلسلةٌ حرّة (ت-٢) — والثابتُ: يبدأ بـ`/` وينتهي بـ`/`. */
export function committeePath(mosquePath: string, committeeId: string): string {
  return `${mosquePath}${committeeId}/`
}

export type FormCommitteeInput = {
  readonly id: string
  readonly mosqueUnitId: string
  readonly labelAr: string
  /** معرّفُ حسابِ المسؤول إن مُكِّن له (ع-١٧)، و`null` لاسمٍ حرٍّ بلا حساب (ق-٣١). */
  readonly headPersonId: string | null
  readonly headNameAr: string
}

export function formCommittee(
  store: CommitteeStore,
  ctx: CommitteeContext,
  input: FormCommitteeInput,
): Result<Committee> {
  // النطاقُ يُشتقّ من الكيان المخزَّن لا من مدخل العميل (§٥.٢) — والمجهولُ يُقفل ولا يُفتح.
  const mosque = store.getUnit(input.mosqueUnitId)
  if (mosque === null) return err("UNKNOWN_MOSQUE_UNIT", input.mosqueUnitId)
  if (!areCommitteesEnabled(ctx, mosque.path)) return err("MODULE_DISABLED", "feature.committees")
  if (store.getCommittee(input.id) !== null) return err("DUPLICATE_COMMITTEE", input.id)
  if (input.labelAr.trim().length === 0) return err("EMPTY_LABEL", input.id)
  // ق-٣١: الاسمُ يُحفظ دائماً — لجنةٌ بلا مسؤولٍ مسمّىً لا يُعرف مَن يُسأل عنها.
  if (input.headNameAr.trim().length === 0) return err("EMPTY_HEAD_NAME", input.id)

  return store.transaction(() => {
    const committee: Committee = {
      tenantId: store.tenantId,
      id: input.id,
      mosqueUnitId: mosque.id,
      mosquePath: mosque.path,
      path: committeePath(mosque.path, input.id),
      labelAr: input.labelAr.trim(),
      headPersonId: input.headPersonId,
      headNameAr: input.headNameAr.trim(),
      active: true,
    }
    store.saveCommittee(committee)
    return ok(store.getCommittee(committee.id)!)
  })
}

/** الإيقافُ **حالةٌ لا حذف** (المادة ٧/٤): تُخفى من العاملة ولا تُمحى بياناتُها. */
export function deactivateCommittee(
  store: CommitteeStore,
  ctx: CommitteeContext,
  input: { readonly committeeId: string },
): Result<Committee> {
  const committee = store.getCommittee(input.committeeId)
  if (committee === null) return err("COMMITTEE_NOT_FOUND", input.committeeId)
  if (!areCommitteesEnabled(ctx, committee.mosquePath)) {
    return err("MODULE_DISABLED", "feature.committees")
  }
  store.saveCommittee({ ...committee, active: false })
  return ok(store.getCommittee(committee.id)!)
}

/**
 * ق-١٧ — **الاطّلاعُ الهابط بالاحتواء لا بالدور**: كلُّ لجنةٍ مسارُها داخلَ النطاق المسؤول عنه.
 * فمسجدٌ يرى لجانَه، والمربعُ فوقه يرى لجانَ مساجده — **بلا سطرٍ يذكر دوراً** (G6).
 */
export function committeesWithin(
  store: CommitteeStore,
  scopePath: string,
  options: { readonly includeInactive?: boolean } = {},
): readonly Committee[] {
  const includeInactive = options.includeInactive === true
  return store
    .committees()
    .filter((c) => contains(scopePath, c.path) && (includeInactive || c.active))
}

/**
 * «لجنتي» (`committee.own` — قدرةٌ **شخصية**، ك-٢٣): ما يقوده هذا الشخصُ بعينه.
 * وعزلُها **ملكيةٌ لا نطاق**: مسؤولُ لجنةٍ لا يرى لجنةً أخرى ولو كانت في مسجده.
 */
export function committeesLedBy(
  store: CommitteeStore,
  personId: string | null,
): readonly Committee[] {
  if (personId === null) return []
  return store.committees().filter((c) => c.active && c.headPersonId === personId)
}
