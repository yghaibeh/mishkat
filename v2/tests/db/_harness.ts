/**
 * مِشْجَبُ اختبارات طبقة الاستمرار — قاعدةٌ حقيقية في الذاكرة، مهاجَرةٌ بالهجرات نفسِها
 * التي تُشحن (لا مخطط اختبارٍ موازٍ — المادة ١/٢).
 *
 * **حتميّ** (TESTING_POLICY §٥): لا عشوائيّة ولا ساعةَ زمن-تشغيل — التواريخ مثبَّتة،
 * والمعرّفاتُ من عدّاد المستودع.
 */

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { openSqliteDriver, type SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { applyMigrations, type Migration } from "../../src/db/migrations/runner.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { AuditJournal } from "../../src/audit/journal.js"
import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import { persistentOrg } from "../../src/db/repositories/orgRepository.js"
import { persistentLedger } from "../../src/db/repositories/ledgerRepository.js"
import { OrgStore } from "../../src/features/org/data/store.js"
import { LedgerStore } from "../../src/features/ledger/data/store.js"
import type { AccountKind } from "../../src/features/ledger/types.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(HERE, "../../src/db/migrations")

export const NOW = new Date("2026-07-20T00:00:00.000Z")
export const MAIN = "t-main"
/** شبكةٌ ثانية **بنفس المسارات النسبيّة عمداً** — فيثبت أن التطابق لا يسرّب (قب-١٨). */
export const OTHER = "t-aleppo"

/** الهجراتُ المشحونة، مقروءةً من مجلدها — لا نسخةَ ثانية في الاختبار. */
export function shippedMigrations(): readonly Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }))
}

/** قاعدةٌ نظيفة + الهجرات مطبَّقة. */
export async function freshDb(): Promise<SqliteDriver> {
  const driver = openSqliteDriver()
  await applyMigrations(driver, shippedMigrations())
  return driver
}

/**
 * **سجلُّ تدقيقٍ واحدٌ تتقاسمه الوحدتان** (CR-027): هذا هو التوحيدُ عملياً — لا سجلَّ
 * لكلِّ وحدة، بل مِرفقٌ واحدٌ يُحقن فيهما فيسكن قيدُهما جدولاً واحداً بتسلسلٍ واحد.
 */
export type Stores = {
  readonly org: OrgStore
  readonly ledger: LedgerStore
  readonly audit: AuditJournal
}

export function freshStores(tenantId: string): Stores {
  const audit = new AuditJournal(tenantId)
  return { org: new OrgStore(tenantId, audit), ledger: new LedgerStore(tenantId, audit), audit }
}

export const CHART: readonly { id: string; ar: string; kind: AccountKind }[] = [
  { id: "cash", ar: "النقد", kind: "asset" },
  { id: "revenue.donations", ar: "إيرادُ التبرعات", kind: "revenue" },
  { id: "expense.general", ar: "مصروفٌ عام", kind: "expense" },
]

export const UNITS: readonly { id: string; path: string; type: string; labelAr: string; parentId: string | null }[] = [
  { id: "men", path: "/men/", type: "section", labelAr: "قسم الرجال", parentId: null },
  { id: "r1", path: "/men/r1/", type: "region", labelAr: "المنطقة الأولى", parentId: "men" },
  { id: "m1", path: "/men/r1/m1/", type: "mosque", labelAr: "مسجد الفاروق", parentId: "r1" },
  { id: "m2", path: "/men/r1/m2/", type: "mosque", labelAr: "مسجد النور", parentId: "r1" },
]

/** يبذر المراجعَ في مستودعين طازجين — **لا يكتب في القاعدة** (البذرُ عبر `flush` كغيره). */
export function seedStores(tenantId: string): Stores {
  const { org, ledger, audit } = freshStores(tenantId)
  for (const u of UNITS) {
    org.saveUnit({
      tenantId,
      id: u.id,
      type: u.type as never,
      labelAr: u.labelAr,
      parentId: u.parentId,
      path: u.path,
      section: "men",
      archived: false,
    })
    ledger.saveUnit({ tenantId, id: u.id, path: u.path })
  }
  for (const a of CHART) ledger.saveAccount({ tenantId, id: a.id, ar: a.ar, kind: a.kind })
  ledger.saveFund({ tenantId, id: "general", ar: "الصندوق العام", restricted: false })
  ledger.saveFund({ tenantId, id: "zakat", ar: "صندوق الزكاة", restricted: true })
  return { org, ledger, audit }
}

/** المراجعُ (شجرةُ الحسابات والصناديق) تُمرَّر صراحةً عند البذر — انظر `LedgerReferences`. */
export const REFERENCES = {
  accounts: CHART.map((a) => ({ tenantId: "", id: a.id, ar: a.ar, kind: a.kind })),
  funds: [
    { tenantId: "", id: "general", ar: "الصندوق العام", restricted: false },
    { tenantId: "", id: "zakat", ar: "صندوق الزكاة", restricted: true },
  ],
}

export function unitOfWorkFor(
  driver: SqliteDriver,
  stores: Stores,
  scope: Scope,
  withReferences = false,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentOrg(stores.org))
  uow.enlist(persistentLedger(stores.ledger, withReferences ? REFERENCES : null))
  uow.enlist(persistentAudit(stores.audit))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ من القاعدة ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ
 * واحدة. هذه هي طبقةُ الاستمرار كما تُستعمل فعلاً — والاختباراتُ تستهلكها لا تحاكيها.
 */
export async function session<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (stores: Stores) => T,
  scopePath = "/",
): Promise<T> {
  const stores = freshStores(tenantId)
  const uow = unitOfWorkFor(driver, stores, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(stores)
  await uow.flush()
  return value
}

/**
 * بذرُ المراجع أولَ مرة: مستودعانِ مبذوران يُحمَّلان على قاعدةٍ فارغة ⟵ الفارقُ هو البذرةُ
 * كلُّها ⟵ قذفةٌ واحدة. **البذرُ يسلك طريقَ الكتابة نفسَه** فلا يختبر الطقمُ طريقاً لا يُشحن.
 */
export async function seedSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  const stores = seedStores(tenantId)
  const uow = unitOfWorkFor(driver, stores, { tenantId, scopePath: "/" }, true)
  await uow.hydrate()
  await uow.flush()
}

/** كلُّ صفوف جدولٍ كما هي في القاعدة — للتوكيد المباشر على الأثر الدائم. */
export async function rowsOf(driver: SqliteDriver, table: string): Promise<readonly unknown[]> {
  return driver.all({ sql: `SELECT * FROM ${table}`, params: [] })
}
