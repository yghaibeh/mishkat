/**
 * **الثابتُ الحاكم لطبقة الاستمرار**: لا قيدٌ بلا سجلِّ تسليمه، ولا سجلٌّ بلا قيده.
 * (`db/README.md` الحسم ١ · عقدُ وحدة الصندوق §٢.٣ · ADR-001 ع-٤)
 *
 * يُقاس **في المسارين** وعلى **الأثر الدائم** لا على الذاكرة وحدها: بعد كلِّ فشلٍ تُسأل
 * القاعدةُ نفسُها. والقاعدةُ الذهبية سارية: **السلبُ أكثر من الإيجاب**.
 */

import { describe, expect, it } from "vitest"
import { LedgerStorageError, type Cents } from "../../src/features/ledger/types.js"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { LedgerStore } from "../../src/features/ledger/data/store.js"
import { OrgStore } from "../../src/features/org/data/store.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { persistentLedger } from "../../src/db/repositories/ledgerRepository.js"
import { MAIN, NOW, freshDb, freshStores, rowsOf, seedSession, session, unitOfWorkFor } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function donation(sourceId: string): Parameters<typeof postJournal>[2] {
  return {
    at: NOW,
    unitId: "m1",
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation" as const,
    sourceId,
    lines: [
      { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(10_000) },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(10_000),
      },
    ],
  }
}

/** «سجلُّ التسليم» في وحدتَي الريادة: قيدُ التدقيق المرافق للقيد الماليّ (المادة ٤/٨). */
function appendHandoverRecord(org: OrgStore, targetId: string): void {
  org.audit.append({
    at: NOW,
    actorPersonId: "u-finance",
    action: "box.handover",
    capability: "finance.entry",
    unitPath: "/men/r1/m1/",
    targetType: "entry",
    targetId,
    reason: null,
    // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
    // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
    before: null,
    after: null,
  })
}

describe("الذرّية العابرة للمستودعين — على الأثر الدائم", () => {
  it("الذرّية: قيدٌ فاشلٌ **لا يترك** سجلَّ تسليم", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)

    const { org, ledger, audit } = freshStores(MAIN)
    const uow = unitOfWorkFor(driver, { org, ledger, audit }, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()

    expect(() =>
      org.transaction(() =>
        ledger.transaction(() => {
          appendHandoverRecord(org, "je-سيسقط")
          const entryId = ledger.openEntry({
            voucherNo: "R-0001",
            voucherSeq: 1,
            at: NOW,
            unitPath: "/men/r1/m1/",
            memoAr: "قيدٌ سيسقط",
            sourceType: "donation",
            sourceId: "d-fail",
            postingKey: "donation:d-fail",
            reversalOf: null,
            reasonAr: null,
            postedBy: "u-finance",
          })
          // حسابٌ مجهول ⟵ رميةُ التكامل المرجعيّ من طبقة البيانات نفسِها.
          ledger.appendLine(entryId, {
            accountId: "لا-وجود-له",
            unitPath: "/men/r1/m1/",
            fundId: null,
            currency: "USD",
            debit: c(1),
            credit: c(0),
            kind: "normal",
            deductionKind: null,
          })
        }),
      ),
    ).toThrow(LedgerStorageError)

    await uow.flush()
    expect(await rowsOf(driver, "journal_entries")).toHaveLength(0)
    expect(await rowsOf(driver, "audit_log")).toHaveLength(0)
    driver.close()
  })

  it("الذرّية: سجلٌّ فاشلٌ **لا يترك** قيداً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)

    const { org, ledger, audit } = freshStores(MAIN)
    const uow = unitOfWorkFor(driver, { org, ledger, audit }, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()

    expect(() =>
      org.transaction(() =>
        ledger.transaction(() => {
          const posted = postJournal(ledger, CTX, donation("d-2"))
          expect(posted.ok).toBe(true)
          // القيدُ تمّ، ثم يسقط سجلُّ تسليمه ⟵ يجب أن يسقط القيدُ معه.
          throw new Error("عطبٌ في كتابة سجلّ التسليم")
        }),
      ),
    ).toThrow("عطبٌ في كتابة سجلّ التسليم")

    await uow.flush()
    expect(await rowsOf(driver, "journal_entries")).toHaveLength(0)
    expect(await rowsOf(driver, "journal_lines")).toHaveLength(0)
    expect(await rowsOf(driver, "audit_log")).toHaveLength(0)
    driver.close()
  })

  it("الذرّية: النجاحُ يكتب الطرفين معاً — فالفشلُ وحده ليس هو المقيس", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org, ledger }) => {
      org.transaction(() =>
        ledger.transaction(() => {
          const posted = postJournal(ledger, CTX, donation("d-1"))
          if (!posted.ok) throw new Error("لم يُرحَّل")
          appendHandoverRecord(org, posted.value.id)
        }),
      )
    })
    expect(await rowsOf(driver, "journal_entries")).toHaveLength(1)
    expect(await rowsOf(driver, "journal_lines")).toHaveLength(2)
    expect((await rowsOf(driver, "audit_log")).length).toBeGreaterThanOrEqual(1)
    driver.close()
  })
})

describe("الذرّية عند القذف — الدفعةُ الواحدة معاملةٌ ضمنية", () => {
  it("الذرّية: فشلُ عبارةٍ في الدفعة لا يترك أثراً جزئياً من سابقاتها", async () => {
    const driver = await freshDb()
    await expect(
      driver.batch([
        {
          sql: "INSERT INTO org_units (tenant_id, unit_path, id, type, label_ar, parent_id, section, archived) VALUES (?,?,?,?,?,?,?,?)",
          params: [MAIN, "/men/", "men", "section", "قسم الرجال", null, "men", 0],
        },
        // مفتاحٌ أوليٌّ مكرَّر ⟵ رميةٌ في منتصف الدفعة.
        {
          sql: "INSERT INTO org_units (tenant_id, unit_path, id, type, label_ar, parent_id, section, archived) VALUES (?,?,?,?,?,?,?,?)",
          params: [MAIN, "/men/", "men", "section", "تكرارٌ", null, "men", 0],
        },
      ]),
    ).rejects.toThrow()
    expect(await rowsOf(driver, "org_units")).toHaveLength(0)
    driver.close()
  })

  it("الذرّية: مفتاحُ الترحيل النشط فريدٌ **في القاعدة** — فالسباقُ لا يفلت (ق-٥٠)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      const posted = postJournal(ledger, CTX, donation("d-1"))
      expect(posted.ok).toBe(true)
    })
    await expect(
      driver.batch([
        {
          sql: "INSERT INTO active_posting_keys (tenant_id, unit_path, posting_key, entry_id) VALUES (?,?,?,?)",
          params: [MAIN, "/men/r1/m1/", "donation:d-1", "je-مزوَّر"],
        },
      ]),
    ).rejects.toThrow()
    driver.close()
  })
})

describe("الذرّية: لا إخفاقَ صامت", () => {
  it("الذرّية: وحدةُ عملٍ فيها مستودعٌ بلا مخطط تُرمى ولا تُقذف نصفَ أثر", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentLedger(new LedgerStore(MAIN)))
    // **سِنتينل لا وحدةٌ لم تُنقل** (فخّ ٢): كان `box_handovers`، وانقضى موضوعُه يومَ نُقل
    // الصندوق. والثابتُ «مستودعٌ بلا مخطط يُرمى» لا يخصّ وحدةً بعينها — فاسمٌ لا يُنقل أصدق.
    const noSuchTable = "__جدولٌ_لا_مخططَ_له__"
    uow.enlist({
      name: "box",
      rowBudget: 1_000,
      tables: [noSuchTable],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(noSuchTable)
    driver.close()
  })

  it("الذرّية: محوُ صفٍّ من جدولٍ ملحقٍ فقط يُرمى ولا يُترجم إلى `DELETE` (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
    })

    const ledger = new LedgerStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    const source = persistentLedger(ledger)
    uow.enlist(source)
    await uow.hydrate()
    // لقطةٌ تُسقط القيد من الإسقاط — محاكاةُ محوٍ لا يجوز أن يُترجم إلى حذف.
    const projected = source.project()
    const entries = projected.get("journal_entries")!
    const forged = new Map(projected)
    forged.set("journal_entries", new Map([...entries].slice(1)))
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/journal_entries/)
    driver.close()
  })
})
