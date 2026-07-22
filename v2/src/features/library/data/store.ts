/**
 * مستودعُ المكتبة — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §١ و§٧ و§١١).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان (ADR-001 §٦-١)، وهذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 دون تغيير سطرٍ في الخدمات
 * (طبقةُ العزل — ADR-001 §٥، وهي عينُ ما أتاح العملَ المتوازي في قب-٣١).
 *
 * أربعةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ الأرشفةُ **حالةٌ في البيانات** (المادة ٧/٤).
 *  ٣. **مفتاحُ التخزين من هنا**: يُشتقّ من عدّاد المستودع فلا يأتي من المدخل ولا يُخمَّن
 *     (المادة ٨/٤) — والوحدةُ لا تعرف مزوّداً.
 *  ٤. **الكياناتُ مجمَّدة**: تُستبدَل ولا تُعدَّل في مكانها.
 *
 * **ولا حقلَ يحفظ عدداً** في هذا السطح (عقدُ الوحدة §١): كلُّ رقمٍ استعلامٌ على المصدر —
 * فلا يوجد ما يتباعد عن الواقع أصلاً. **يُقاس بحارسٍ محتوائيّ.**
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type {
  LibraryAudience,
  LibraryCategory,
  LibraryFormat,
  LibraryMaterial,
  LibraryUnit,
  MaterialProgress,
} from "../types.js"

type Snapshot = {
  readonly materialMap: Map<string, LibraryMaterial>
  readonly progressMap: Map<string, MaterialProgress>
  readonly seq: number
}

/** مفتاحُ خط الزمن: (مادة، شخص) — سجلٌّ واحدٌ لا سجلّان (نظيرُ `UNIQUE` في v1). */
function progressKey(materialId: string, personId: string): string {
  return `${materialId}|${personId}`
}

export class LibraryStore {
  private unitMap = new Map<string, LibraryUnit>()
  private categoryMap = new Map<string, LibraryCategory>()
  private audienceMap = new Map<string, LibraryAudience>()
  private formatMap = new Map<string, LibraryFormat>()
  private materialMap = new Map<string, LibraryMaterial>()
  private progressMap = new Map<string, MaterialProgress>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  /** مفتاحُ التخزين **من المستودع** — لا من المدخل ولا من العنوان (المادة ٨/٤). */
  nextStorageKey(): string {
    return this.nextId(`${this.tenantId}/library`)
  }

  // ── المراجعُ (إسقاطُ الوحدات والمعاجم الثلاثة) ─────────────────────────────
  saveUnit(u: LibraryUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): LibraryUnit | null {
    return this.unitMap.get(id) ?? null
  }

  saveCategory(c: LibraryCategory): void {
    this.categoryMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  getCategory(id: string): LibraryCategory | null {
    return this.categoryMap.get(id) ?? null
  }
  categories(): readonly LibraryCategory[] {
    return Object.freeze([...this.categoryMap.values()])
  }

  saveAudience(a: LibraryAudience): void {
    this.audienceMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))
  }
  getAudience(id: string): LibraryAudience | null {
    return this.audienceMap.get(id) ?? null
  }
  audiences(): readonly LibraryAudience[] {
    return Object.freeze([...this.audienceMap.values()])
  }

  saveFormat(f: LibraryFormat): void {
    this.formatMap.set(f.id, Object.freeze({ ...f, tenantId: this.tenantId }))
  }
  /** الصيغةُ تُطلب **بنوع المحتوى** لأنه ما يصل من الحدّ لا معرّفُ المرجع. */
  formatByContentType(contentType: string): LibraryFormat | null {
    for (const f of this.formatMap.values()) if (f.contentType === contentType) return f
    return null
  }
  formats(): readonly LibraryFormat[] {
    return Object.freeze([...this.formatMap.values()])
  }

  // ── الموادُّ وخطوطُ الزمن ───────────────────────────────────────────────────
  saveMaterial(m: LibraryMaterial): void {
    this.materialMap.set(m.id, Object.freeze({ ...m, tenantId: this.tenantId }))
  }
  getMaterial(id: string): LibraryMaterial | null {
    return this.materialMap.get(id) ?? null
  }
  materials(): readonly LibraryMaterial[] {
    return Object.freeze([...this.materialMap.values()])
  }

  saveProgress(p: MaterialProgress): void {
    this.progressMap.set(
      progressKey(p.materialId, p.personId),
      Object.freeze({ ...p, tenantId: this.tenantId }),
    )
  }
  getProgress(materialId: string, personId: string): MaterialProgress | null {
    return this.progressMap.get(progressKey(materialId, personId)) ?? null
  }

  // ── المعاملة الذرّية ───────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      materialMap: new Map(this.materialMap),
      progressMap: new Map(this.progressMap),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.materialMap = s.materialMap
    this.progressMap = s.progressMap
    this.seq = s.seq
  }

  /** **مقطعٌ حرجٌ متزامن** (لا `await` في داخله بحكم التوقيع) — الفشلُ يُرجع العدّادَ معه. */
  transaction<T>(fn: () => T): T {
    const before = this.snapshot()
    try {
      return fn()
    } catch (e) {
      this.restore(before)
      throw e
    }
  }
}
