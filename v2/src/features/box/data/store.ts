/**
 * مستودعُ الصندوق — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §٢/§٣/§٥).
 *
 * **ما لا يعيش هنا أهمُّ ممّا يعيش**: لا رصيدَ ولا مجموعَ ولا نسخةَ مبلغ (ق-٦٠) — المالُ كلُّه
 * في دفتر النواة، وهذا المستودعُ يحفظ **مراجعَ الصندوق** (قاموسُ فئات الصرف) و**توثيقَ
 * التسليم** (مَن سلّم ومَن أقرّ) لا غير.
 *
 * ثلاثةُ ثوابتٍ تعيش هنا فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): المستودعُ يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ إيقافُ الفئة **حالةٌ في البيانات** (المادة ٧/٤).
 *  ٣. **ذرّيةٌ عابرةٌ للمستودعين**: `atomically` تلفّ معاملةَ هذا المستودع حول معاملة الدفتر،
 *     فيرتدّان معاً — فلا قيدٌ بلا سجلِّ تسليمه ولا سجلٌّ بلا قيده.
 *
 * **وسجلُّ التدقيق مُحقَنٌ لا مملوك** (CR-027 · شرطُ قب-٤٩): كانت `data/tenant.ts` تُنشئ
 * `LedgerStore` **بسجلِّه الافتراضيّ الخاصّ**، فصار لدفترٍ واحدٍ سجلّان يوم يجتمع الصندوقُ
 * والرواتبُ في قاعدةٍ واحدة — وهو **عينُ ما ألغته CR-027**: تسلسلان يبدآن من ١ فيكتب
 * أحدُهما فوق صفوف الآخر بالمفتاح الطبيعيّ `(tenant_id, source, seq)`. فصار **بناءُ الحزمة
 * من موضعٍ واحدٍ** (`boxStoresFor`) يحقن سجلاً واحداً ويُعلنه ضلعاً في الحزمة.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import { AuditJournal } from "../../../audit/journal.js"
import { LedgerStore } from "../../ledger/data/store.js"
import type { BoxHandover, SpendCategory } from "../types.js"

/** حزمةُ مستودعَي الشبكة الواحدة — الدفترُ مصدرُ المال، والصندوقُ مراجعُه وتوثيقُه. */
export type BoxStores = {
  readonly ledger: LedgerStore
  readonly box: BoxStore
}

/**
 * **مصنعُ الحزمة الواحد** (شرطُ قب-٤٩) — كلُّ من يبني حزمةَ صندوقٍ يبنيها من هنا،
 * بسجلِّ تدقيقٍ **واحدٍ مُحقَن**. وكان بناؤها متكرّراً في موضعين (`box/data/tenant.ts`
 * و`approval/data/tenant.ts`) **فتباعدا** — وهذا هو **مصدرُ الحقيقة الثاني** الذي جعل
 * شرطَ قب-٤٩ لازماً (المادة ١/٢).
 *
 * > **ولماذا لم يصر السجلُّ ضلعاً ثالثاً مُعلَناً في `BoxStores`؟** لأنه **موجودٌ بالفعل**
 * > ضلعاً واحداً لا ثانيَ له: `stores.ledger.audit`. وإعلانُه مرّةً أخرى في الحزمة **مِقبضٌ
 * > ثانٍ لشيءٍ واحد** يوجب حارساً يُثبت أنهما هما — وثمنُه تحريرُ خمسة مواضعَ قائمة **منها
 * > اختبارُ `approval`** وهي محظورةٌ عليّ نصّاً. فالمصنعُ يحمل الثابتَ، والوحدةُ تُلحق
 * > `persistentAudit(stores.ledger.audit)` — سجلٌّ واحدٌ لا يُتصوَّر معه ثانٍ.
 */
export function boxStoresFor(
  tenantId: string,
  audit: AuditJournal = new AuditJournal(tenantId),
): BoxStores {
  return { ledger: new LedgerStore(tenantId, audit), box: new BoxStore(tenantId) }
}

type Snapshot = {
  readonly categoryMap: Map<string, SpendCategory>
  readonly handoverMap: Map<string, BoxHandover>
  readonly seq: number
}

export class BoxStore {
  private categoryMap = new Map<string, SpendCategory>()
  private handoverMap = new Map<string, BoxHandover>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── القاموس المغلق المركزيّ (ق-٦٤) — مراجعُ بياناتٍ تُدار ولا تُنشر كوداً ──
  saveCategory(category: SpendCategory): void {
    this.categoryMap.set(category.id, Object.freeze({ ...category, tenantId: this.tenantId }))
  }
  getCategory(id: string): SpendCategory | null {
    return this.categoryMap.get(id) ?? null
  }
  categories(): readonly SpendCategory[] {
    return Object.freeze([...this.categoryMap.values()])
  }

  // ── توثيقُ التسليم (ق-٦١) ───────────────────────────────────────────────────
  saveHandover(handover: BoxHandover): void {
    this.handoverMap.set(handover.id, Object.freeze({ ...handover, tenantId: this.tenantId }))
  }
  getHandover(id: string): BoxHandover | null {
    return this.handoverMap.get(id) ?? null
  }
  handovers(): readonly BoxHandover[] {
    return Object.freeze([...this.handoverMap.values()])
  }

  // ── المعاملة الذرّية ────────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      categoryMap: new Map(this.categoryMap),
      handoverMap: new Map(this.handoverMap),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.categoryMap = s.categoryMap
    this.handoverMap = s.handoverMap
    this.seq = s.seq
  }

  /** **مقطعٌ حرجٌ متزامن** (لا `await` في داخله بحكم التوقيع) — نظيرُ معاملة الدفتر. */
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

/**
 * ذرّيةٌ **عابرةٌ للمستودعين**: أيُّ رميةٍ في الداخل تُرجع الدفترَ ومستودعَ الصندوق معاً إلى
 * ما قبل العملية — فلا يبقى قيدٌ بلا توثيقِ تسليمه ولا توثيقٌ بلا قيده (عقدُ الوحدة §٢.٣).
 */
export function atomically<T>(stores: BoxStores, fn: () => T): T {
  return stores.box.transaction(() => stores.ledger.transaction(fn))
}
