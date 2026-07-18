// وصلُ الاعتراض بدوالّ الخادم الحقيقيّة: المسؤولُ الماليُّ يُقيَّد في الطابور، والمديرُ ينفّذ مباشرةً،
// والقرارُ عبر decideFinanceActionData يحترم قدرةَ finance.supervise. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as ledger from "@/server/ledger.server";
import * as mosqueFin from "@/server/mosqueFinance.server";
import { trialBalance, toCents } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const officer: FakeUser = { userId: "u-off", personId: "p-off", fullName: "المسؤول الماليّ", assignments: [{ role: "finance_officer", orgUnitId: "root", orgPath: "/", portfolio: null }] };
const adminU: FakeUser = { userId: "u-adm", personId: "p-adm", fullName: "المدير", assignments: [{ role: "admin", orgUnitId: "root", orgPath: "/", portfolio: null }] };

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "الفاروق", status: "active", createdAt: 0 } as never).run();
});

describe("وصلُ الاعتماد الثنائيّ بدوالّ الخادم (TDD)", () => {
  it("إشعارُ الاقتراح يصل الإدارةَ عبر الطابور الموحّد (queued لتيليغرام+Push+الجرس) بحمولةٍ مُهيكَلة", async () => {
    // مديرٌ له شخصٌ (ليصله الإشعار)
    await db.insert(schema.persons).values({ id: "p-adm", fullName: "المدير", gender: "male", createdAt: 0 } as never).run();
    await db.insert(schema.roleAssignments).values({ id: "ra-adm", personId: "p-adm", role: "admin", orgUnitId: "root", orgPath: "/", approvalStatus: "approved", termNumber: 1, startDate: 0, createdAt: 0 } as never).run();
    setUser(officer);
    await ledger.openPettyBoxData({ name: "نثرية", floatAmount: 100 });
    const notifs = await db.select().from(schema.notifications).all();
    const n = notifs.find((x) => x.personId === "p-adm" && x.kind === "finance_proposal")!;
    expect(n).toBeTruthy();
    expect(n.status).toBe("queued"); // ليُرسله cron لتيليغرام+Push — لا «sent» يقفزها
    const pl = JSON.parse(n.payload!) as { summary: string; amountUsd: number };
    expect(pl.summary).toContain("نثرية");
    expect(pl.amountUsd).toBe(100);
  });

  it("المسؤولُ الماليُّ عبر server-fn ⇒ queued حتمًا ولا أثرَ في الدفتر (محاولةُ الالتفاف مستحيلة)", async () => {
    setUser(officer);
    const r1 = await ledger.setRateData({ currency: "SYP", rateToBase: 0.0001 }) as { queued?: boolean };
    expect(r1.queued).toBe(true);
    const r2 = await ledger.openPettyBoxData({ name: "نثرية المكتب", floatAmount: 200 }) as { queued?: boolean };
    expect(r2.queued).toBe(true);
    const r3 = await ledger.capitalizeAssetData({ name: "حاسوب", cost: 900, usefulLifeMonths: 9, startPeriod: "1447-01" }) as { queued?: boolean };
    expect(r3.queued).toBe(true);
    expect((await trialBalance(db as never)).length).toBe(0);
    expect((await db.select().from(schema.fxRates).all()).length).toBe(0);
    expect((await db.select().from(schema.financeActions).all()).length).toBe(3);
  });

  it("المديرُ ينفّذ مباشرةً (لا سياسةَ عليه) — لا شيءَ في الطابور", async () => {
    setUser(adminU);
    const r = await ledger.setRateData({ currency: "SYP", rateToBase: 0.0002 }) as { ok?: boolean; queued?: boolean };
    expect(r.ok).toBe(true);
    expect(r.queued).toBeUndefined();
    expect((await db.select().from(schema.fxRates).all()).length).toBe(1);
    expect((await db.select().from(schema.financeActions).all()).length).toBe(0);
  });

  it("الدورةُ الكاملة: المسؤول يقترح نثريّةً ⇒ المدير يعتمد من الصندوق ⇒ تُنفَّذ ويصل الدفترَ رقمُها", async () => {
    // نقدٌ ابتدائيّ (من المدير مباشرة)
    setUser(adminU);
    await ledger.openingBalanceData({ accountId: "1110", fundId: "general", amount: 1000 });
    // اقتراحُ المسؤول
    setUser(officer);
    const q = await ledger.openPettyBoxData({ name: "نثرية", floatAmount: 150 }) as { queued: boolean; actionId: string };
    expect(q.queued).toBe(true);
    // المعاينةُ متاحةٌ قبل القرار
    const pv = await ledger.previewFinanceActionData(q.actionId);
    expect(pv.lines.find((l) => l.accountId === "1130")?.debit).toBe(150);
    // مسؤولٌ لا يقرّر (بلا finance.supervise)
    await expect(ledger.decideFinanceActionData({ actionId: q.actionId, approve: true })).rejects.toThrow(/للمدير/);
    // المديرُ يعتمد ⇒ تنفيذ
    setUser(adminU);
    const d = await ledger.decideFinanceActionData({ actionId: q.actionId, approve: true }) as { status?: string };
    expect(d.status).toBe("executed");
    const tb = await trialBalance(db as never);
    expect(tb.find((x) => x.accountId === "1130")?.debit).toBe(toCents(150));
    // «مقترحاتي» للمسؤول تعرض المنفَّذ
    setUser(officer);
    const mine = await ledger.financeActionsData({ mine: true });
    expect(mine.items[0].status).toBe("executed");
  });

  it("تبرّعُ الأمير مباشرٌ (قرار ٢)، وتبرّعُ مسؤولٍ ماليٍّ مُكلَّفٍ أميرًا يُعترَض بالسياسة", async () => {
    // أميرٌ عاديّ ⇒ مباشر
    setUser({ userId: "u-amir", personId: "p-amir", fullName: "أمير", assignments: [{ role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", portfolio: null }] });
    const r = await mosqueFin.addDonationData({ mosqueId: "m1", amount: 50, donorName: "محسن" }) as { ok?: boolean; receiptNo?: string };
    expect(r.ok).toBe(true);
    expect(r.receiptNo).toBeTruthy();
    // مستخدمٌ يجمع أميرًا + مسؤولًا ماليًّا ⇒ السياسةُ بالدور تُغلّب الاعتراض (لا التفافَ عبر واجهة المسجد)
    setUser({ userId: "u-both", personId: "p-both", fullName: "جامع", assignments: [
      { role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", portfolio: null },
      { role: "finance_officer", orgUnitId: "root", orgPath: "/", portfolio: null },
    ] });
    const r2 = await mosqueFin.addDonationData({ mosqueId: "m1", amount: 70, donorName: "آخر" }) as { queued?: boolean };
    expect(r2.queued).toBe(true);
  });

  it("رفضُ المدير بسببٍ يظهر في «مقترحاتي» ولا يُنفَّذ شيء", async () => {
    setUser(officer);
    const q = await ledger.grantAdvanceData({ personId: "p-x", principal: 100, monthlyDeduction: 25 }) as { queued: boolean; actionId: string };
    setUser(adminU);
    const d = await ledger.decideFinanceActionData({ actionId: q.actionId, approve: false, reason: "لا سياسةَ سُلَفٍ لهذا الشخص" }) as { status?: string };
    expect(d.status).toBe("rejected");
    setUser(officer);
    const mine = await ledger.financeActionsData({ mine: true });
    expect(mine.items[0].rejectReason).toContain("لا سياسةَ");
    expect((await db.select().from(schema.staffAdvances).all()).length).toBe(0);
  });
});
