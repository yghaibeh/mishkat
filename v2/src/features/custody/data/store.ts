/**
 * مستودعُ العُهد — طبقةُ بيانات الوحدة (عقدُ الوحدة §١/§٣/§٦).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١؛ هذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 بلا تغيير سطرٍ في الخدمات.
 *
 * ثلاثةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسارٍ يبلغ البيانات:
 *  ١. **لا حائزَ ولا حالةَ مخزَّنة** (ق-٧٨/ق-٨٠): ليس في هذا السطح ما يحفظهما — فلا بابَ ثانياً.
 *  ٢. **لا محو** (ق-٨٠، المادة ٧/٤): **صفر دالةِ حذف**؛ والحركةُ لا يُكتب فوقها —
 *     `appendMove` ترمي على معرّفٍ مكرَّر، و`stampReceipt` تختم **بصمةَ الإقرار وحدها**.
 *  ٣. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { Asset, CustodyAuditRecord, CustodyMove, CustodyUnit } from "../types.js"

type Snapshot = {
  readonly unitMap: Map<string, CustodyUnit>
  readonly assetMap: Map<string, Asset>
  readonly moveList: CustodyMove[]
  readonly auditList: CustodyAuditRecord[]
  readonly seq: number
}

export class CustodyStore {
  private unitMap = new Map<string, CustodyUnit>()
  private assetMap = new Map<string, Asset>()
  private moveList: CustodyMove[] = []
  private auditList: CustodyAuditRecord[] = []
  private seq = 0

  constructor(readonly tenantId: string) {}

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

  // ── التدقيق (ق-٨٣) ─────────────────────────────────────────────────────────
  /** المُنشئُ لا يزوّد `tenantId` — اشتقاقٌ لا مدخل. */
  appendAudit(entry: Omit<CustodyAuditRecord, "tenantId">): void {
    this.auditList.push(Object.freeze({ ...entry, tenantId: this.tenantId }))
  }
  audit(): readonly CustodyAuditRecord[] {
    return Object.freeze([...this.auditList])
  }

  // ── المعاملة الذرّية ───────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      unitMap: new Map(this.unitMap),
      assetMap: new Map(this.assetMap),
      moveList: [...this.moveList],
      auditList: [...this.auditList],
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.unitMap = s.unitMap
    this.assetMap = s.assetMap
    this.moveList = s.moveList
    this.auditList = s.auditList
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
