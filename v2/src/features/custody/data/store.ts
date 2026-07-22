/**
 * مستودعُ العُهد — طبقةُ بيانات الوحدة (عقدُ الوحدة §١/§٣/§٦).
 *
 * **ويُقذف إلى D1 من T26-ب-١**: الهجرة `0003_custody.sql` والمستودعُ
 * `db/repositories/custodyRepository.ts` **يُسقطانه ويُحمّلانه بلا تغيير توقيعٍ واحد** —
 * فهذا الصنفُ هو نفسُه الذي تراه الخدمةُ حرفياً، لا وكيلٌ ولا اعتراضُ نداءات
 * (`db/README.md` الحسم ١، الطبقة ٢).
 *
 * ثلاثةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسارٍ يبلغ البيانات:
 *  ١. **لا حائزَ ولا حالةَ مخزَّنة** (ق-٧٨/ق-٨٠): ليس في هذا السطح ما يحفظهما — فلا بابَ ثانياً.
 *  ٢. **لا محو** (ق-٨٠، المادة ٧/٤): **صفر دالةِ حذف**؛ والحركةُ لا يُكتب فوقها —
 *     `appendMove` ترمي على معرّفٍ مكرَّر، و`stampReceipt` تختم **بصمةَ الإقرار وحدها**.
 *  ٣. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *
 * **وسجلُّ التدقيق مُحقَنٌ لا مملوك** (CR-027/قب-٤٩): كان هنا `auditList` محليٌّ أضيقُ من
 * العقد المعلن — وهو **آخرُ ما بقي من العدوى التي أوقفتها CR-027** في هذه الموجة. فأُلغي،
 * وصار السجلُّ مِرفقاً عابراً للوحدات يُحقن كما يُحقن مُحلِّلُ الإعدادات: **تناديه الوحدةُ
 * ولا تملكه**، فيسكن قيدُها وقيدُ غيرها جدولاً واحداً بتسلسلٍ واحد.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import { AuditJournal, type AuditMark } from "../../../audit/journal.js"
import type { Asset, CustodyMove, CustodyUnit } from "../types.js"

type Snapshot = {
  readonly unitMap: Map<string, CustodyUnit>
  readonly assetMap: Map<string, Asset>
  readonly moveList: CustodyMove[]
  /** علامةٌ لا نسخة: السجلُّ ملحقٌ فقط فالارتدادُ **قصٌّ** (`AuditJournal.mark`). */
  readonly auditMark: AuditMark
  readonly seq: number
}

export class CustodyStore {
  private unitMap = new Map<string, CustodyUnit>()
  private assetMap = new Map<string, Asset>()
  private moveList: CustodyMove[] = []
  private seq = 0

  constructor(
    readonly tenantId: string,
    /**
     * **السجلُّ الواحد** (CR-027) — يُحقن ولا يُملَك، و**نفسُه يُمرَّر لكلِّ مستودعات وحدة
     * العمل**: سجلّان لجدولٍ واحد يمحو أحدُهما صفوفَ الآخر بالمفتاح الطبيعيّ نفسِه.
     */
    readonly audit: AuditJournal = new AuditJournal(tenantId),
  ) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── إسقاطُ الوحدات (قراءةٌ لاشتقاق النطاق) ──────────────────────────────────
  saveUnit(u: CustodyUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): CustodyUnit | null {
    return this.unitMap.get(id) ?? null
  }
  /** تعدادُ الإسقاط — يحتاجه **الإسقاطُ إلى القاعدة** وحدَه؛ قراءةٌ لا سطحُ تحرير. */
  units(): readonly CustodyUnit[] {
    return Object.freeze([...this.unitMap.values()])
  }

  // ── الأصول ─────────────────────────────────────────────────────────────────
  saveAsset(a: Asset): void {
    this.assetMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))
  }
  getAsset(id: string): Asset | null {
    return this.assetMap.get(id) ?? null
  }
  assets(): readonly Asset[] {
    return Object.freeze([...this.assetMap.values()])
  }

  // ── سلسلةُ الحيازة: **إلحاقٌ فقط** ─────────────────────────────────────────
  /** الحركةُ تُلحق ولا تُستبدل: معرّفٌ مكرَّرٌ رميةٌ برمجية لا كتابةٌ فوق سابقه (ق-٧٨). */
  appendMove(m: CustodyMove): void {
    if (this.moveList.some((x) => x.id === m.id)) {
      throw new Error(`حركةُ عهدةٍ مكرَّرةُ المعرّف: ${m.id} — السلسلةُ إلحاقٌ لا استبدال`)
    }
    this.moveList.push(Object.freeze({ ...m, tenantId: this.tenantId }))
  }

  getMove(id: string): CustodyMove | null {
    return this.moveList.find((m) => m.id === id) ?? null
  }

  moves(): readonly CustodyMove[] {
    return Object.freeze([...this.moveList])
  }

  /**
   * **الكاتبُ الضيّق الوحيد بعد الإلحاق**: بصمةُ الإقرار (ق-٧٩) — ولا يمسّ حائزاً ولا نوعاً
   * ولا ترتيباً. ختمٌ ثانٍ على مختومةٍ رميةٌ برمجية (الحارسُ الدلاليّ في الخدمة).
   */
  stampReceipt(moveId: string, personId: string, at: Date): void {
    const index = this.moveList.findIndex((m) => m.id === moveId)
    const current = this.moveList[index]
    if (current === undefined) {
      throw new Error(`ختمُ إقرارٍ لحركةٍ غير موجودة: ${moveId}`)
    }
    if (current.acknowledgedBy !== null) {
      throw new Error(`ختمُ إقرارٍ ثانٍ على حركةٍ مختومة: ${moveId}`)
    }
    this.moveList[index] = Object.freeze({
      ...current,
      acknowledgedBy: personId,
      acknowledgedAt: at,
    })
  }

  // ── المعاملة الذرّية ───────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      unitMap: new Map(this.unitMap),
      assetMap: new Map(this.assetMap),
      moveList: [...this.moveList],
      auditMark: this.audit.mark(),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.unitMap = s.unitMap
    this.assetMap = s.assetMap
    this.moveList = s.moveList
    this.audit.rollbackTo(s.auditMark)
    this.seq = s.seq
  }

  /**
   * **مقطعٌ حرجٌ متزامن** (لا `await` في داخله بحكم التوقيع): الحركةُ وقيدُ تدقيقها يُكتبان
   * معاً ويرتدّان معاً — فحركةٌ بلا تدقيقٍ مستحيلةٌ بالبناء (ق-٨٣).
   */
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
