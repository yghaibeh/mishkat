/**
 * استمرارُ **سجلّ التدقيق الواحد** — CR-027 (`db/README.md` الحسم ٣).
 *
 * قبل التوحيد كان كلُّ مستودعٍ يُسقط قيودَه بنفسه، ويُميَّز صفُّه بـ`owns` على عمود
 * `source`. وكان ذلك يحمل **عطباً صامتاً**: التسلسلُ كان يُشتقّ من **موضع القيد في القائمة
 * المحمَّلة** (`index + 1`)، فجلسةٌ بنطاقٍ جزئيّ تُعيد ترقيمَ ما حمّلته من ١ ⟵ فتكتب فوق
 * قيدِ وحدةٍ **خارج النطاق** بالمفتاح نفسِه. **محوٌ صامتٌ في جدولٍ ملحقٍ فقط** (المادة ٧/٤).
 *
 * وبعد التوحيد صار **التسلسلُ ملكَ السجلّ**: يُحفظ في `sequences` كسائر العدّادات فينجو
 * عبور القاعدة (TESTING_POLICY §٥)، ويُستأنف بالأعلى بين المحمَّل والمحفوظ — فالنطاقُ
 * الجزئيُّ لا يُصادم ما لم يره.
 */

import { AuditJournal, type AuditEntryRecord } from "../../audit/journal.js"
import { encodeDate, readDate, readInt, readText, readTextOrNull } from "../encode.js"
import { TENANT_ROOT_PATH, tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { sequenceRow } from "./shared.js"

const SOURCE = "audit"
const SEQUENCE = "audit.seq"

/**
 * سقفُ صفوف وحدة العمل (G23) — سجلُّ التدقيق **أكبرُ مستهلكٍ للسعة في القاعدة**
 * (٣٦٪ من النمو — ADR ملحق أ)، فسقفُه أعلى من سقف المستودعات وأشدُّ لزوماً.
 * وأولُ إخفاقٍ له يتعذّر إصلاحُه بتضييق النطاق ⟵ CR-026 يُعاد فتحه (قب-٤٨).
 */
const ROW_BUDGET = 40_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/**
 * صفُّ التدقيق — **شكلُ `AuditEntry` المعلن حقلاً بحقل** (`contracts.ts`). والحقولُ
 * الأربعةُ الأخيرة تبقى `NULL` اليوم لأن **لا مُستدعِيَ يملكها بعد** (الأدوارُ لحظتها،
 * والانتحال، والقرار، ورمزُ السبب، ومعرّفُ الطلب) — وعمودُها موجودٌ منذ الهجرة الأولى
 * عمداً: إضافتُه لاحقاً إلى أكبر جدولٍ في القاعدة هي الهجرةُ التي نتجنّبها.
 *
 * **و`before`/`after` صار لهما كاتبٌ في T26-ب-١**: ق-٨٣ يوجب أن يحمل قيدُ العُهد لقطتَي
 * الحال قبل الحركة وبعدها — فالعمودان اللذان انتُظرا يُملآن الآن، وهذا بعينه ما جعل
 * تركَهما في الهجرة الأولى قراراً صائباً لا احتياطاً زائداً.
 */
function auditRow(record: AuditEntryRecord): SqlRow {
  return {
    tenant_id: record.tenantId,
    unit_path: record.unitPath,
    source: record.source,
    seq: record.seq,
    at: encodeDate(record.at),
    actor_person_id: record.actorPersonId,
    action: record.action,
    capability: record.capability,
    target_type: record.targetType,
    target_id: record.targetId,
    reason: record.reason,
    scope_exact: record.scopeExact ? 1 : 0,
    actor_roles_at_time: null,
    impersonated_by: null,
    decision: null,
    reason_code: null,
    request_id: null,
    before: record.before,
    after: record.after,
  }
}

export function persistentAudit(journal: AuditJournal): PersistentStore {
  const tenantId = journal.tenantId

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      // **الجدولُ كلُّه** — لا `owns` بعد اليوم: مصدرٌ واحدٌ لا يقتسمه اثنان (المادة ١/٢).
      "audit_log",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(journal.all().map(auditRow), "audit_log"),
        collect([sequenceRow(tenantId, SEQUENCE, journal.sequence)], "sequences"),
      ]),

    load: (rows) => {
      // **بترتيب التسلسل**: السجلُّ ملحقٌ فقط وترتيبُه جزءٌ من معناه.
      const ordered = [...table(rows, "audit_log").values()].sort(
        (a, b) => readInt(a, "seq") - readInt(b, "seq"),
      )
      journal.restore(
        ordered.map((row) => ({
          tenantId,
          source: readText(row, "source"),
          seq: readInt(row, "seq"),
          id: `${readText(row, "source")}-${readInt(row, "seq")}`,
          unitPath: readText(row, "unit_path"),
          scopeExact: readInt(row, "scope_exact") !== 0,
          at: readDate(row, "at"),
          actorPersonId: readText(row, "actor_person_id"),
          action: readText(row, "action"),
          capability: readTextOrNull(row, "capability"),
          targetType: readTextOrNull(row, "target_type") ?? "",
          targetId: readText(row, "target_id"),
          reason: readTextOrNull(row, "reason"),
          before: readTextOrNull(row, "before"),
          after: readTextOrNull(row, "after"),
        })),
      )

      // العدّادُ **الأعلى بين المحمَّل والمحفوظ** — فقيدٌ جديدٌ لا يدهس قيداً خارج النطاق.
      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      journal.resumeAt(stored === undefined ? 0 : readInt(stored, "value"))
    },
  }
}

/** نطاقُ العدّادات وما ليس نطاقُه وحدةً — الشبكةُ كلُّها (README الحسم ٢). */
export const AUDIT_SEQUENCE_SCOPE = TENANT_ROOT_PATH
