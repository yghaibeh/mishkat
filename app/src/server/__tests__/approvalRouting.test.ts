// ك١ (الوثيقة ٢٩، ق1-د): نواةُ NESSA — أقربُ سلَفٍ إشرافيٍّ نشط، تخطّي الشاغر، كسرُ الزجاج، التدخّل الفوقيّ.
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "./helpers";
import * as schema from "../database/schema";
import { approverLayerFor, isNearestApprover, canOverrideApprove, isBreakGlass, canApproveUnit } from "../services/approvalRouting";
import type { AuthUser } from "../utils/context";

let db: TestDb;
// شجرةٌ كاملة: قسم(men) → منطقة(r1) → مربع(sq1) → مسجد(m1)
const M_PATH = "/men/r1/sq1/m1/";
const SQ_PATH = "/men/r1/sq1/";
const R_PATH = "/men/r1/";
const SEC_PATH = "/men/";

async function unit(id: string, parentId: string | null, path: string, type: string) {
  await db.insert(schema.orgUnits).values({ id, parentId, path, type, section: "men", genderTrack: "male", name: id, status: "active", createdAt: 0 } as never).run();
}
async function assign(personId: string, role: string, orgUnitId: string, orgPath: string, ended = false) {
  await db.insert(schema.roleAssignments).values({ id: `ra-${personId}-${role}`, personId, role, orgUnitId, orgPath, portfolio: null, startDate: 0, endDate: ended ? 100 : null, termNumber: 1, approvalStatus: "approved", approvedBy: "u-adm", createdAt: 0 } as never).run();
}
const user = (role: string, orgUnitId: string, orgPath: string, personId = `p-${role}`): AuthUser => ({
  userId: `u-${role}`, personId, fullName: role, assignments: [{ role, orgUnitId, orgPath, portfolio: null }],
} as never);
const admin: AuthUser = { userId: "u-adm", personId: "p-adm", fullName: "المدير", assignments: [{ role: "admin", orgUnitId: "men", orgPath: "/", portfolio: null }] } as never;

beforeEach(async () => {
  db = (await createTestDb()).db;
  await unit("men", null, SEC_PATH, "section");
  await unit("r1", "men", R_PATH, "rabita");
  await unit("sq1", "r1", SQ_PATH, "square");
  await unit("m1", "sq1", M_PATH, "mosque");
});

describe("NESSA — أقربُ سلَفٍ إشرافيٍّ نشط", () => {
  it("مع مربعٍ ومنطقةٍ ورأس قسمٍ مُكلَّفين: المعتمِدُ = المربع (الأقرب) وحده", async () => {
    await assign("p-sq", "square", "sq1", SQ_PATH);
    await assign("p-r", "rabita", "r1", R_PATH);
    await assign("p-sec", "section_head", "men", SEC_PATH);
    const layer = await approverLayerFor(db as never, M_PATH);
    expect(layer.kind).toBe("layer");
    if (layer.kind === "layer") { expect(layer.unitId).toBe("sq1"); expect(layer.role).toBe("square"); expect(layer.approverPersonIds).toEqual(["p-sq"]); }
    // المربعُ هو الأقرب؛ المنطقةُ ورأسُ القسم والإدارةُ ليسوا الأقربَ
    expect(await isNearestApprover(db as never, user("square", "sq1", SQ_PATH), M_PATH)).toBe(true);
    expect(await isNearestApprover(db as never, user("rabita", "r1", R_PATH), M_PATH)).toBe(false);
    expect(await isNearestApprover(db as never, user("section_head", "men", SEC_PATH), M_PATH)).toBe(false);
    expect(await isNearestApprover(db as never, admin, M_PATH)).toBe(false);
  });

  it("تخطّي الشاغر: فُرِّغ تكليفُ المربع ⇒ المعتمِدُ يصير المنطقة تلقائيًّا", async () => {
    await assign("p-sq", "square", "sq1", SQ_PATH, /*ended*/ true);
    await assign("p-r", "rabita", "r1", R_PATH);
    const layer = await approverLayerFor(db as never, M_PATH);
    expect(layer.kind === "layer" && layer.unitId).toBe("r1");
    expect(await isNearestApprover(db as never, user("rabita", "r1", R_PATH), M_PATH)).toBe(true);
    expect(await isNearestApprover(db as never, user("square", "sq1", SQ_PATH), M_PATH)).toBe(false);
  });

  it("حالةُ المالك حرفيًّا: لا مربعَ ولا منطقةٍ مُكلَّفَين ⇒ المعتمِدُ = رأسُ القسم مباشرةً", async () => {
    await assign("p-sec", "section_head", "men", SEC_PATH);
    const layer = await approverLayerFor(db as never, M_PATH);
    expect(layer.kind === "layer" && layer.unitId).toBe("men");
    expect(await isNearestApprover(db as never, user("section_head", "men", SEC_PATH), M_PATH)).toBe(true);
  });

  it("كسرُ الزجاج: لا أيَّ سلَفٍ مُكلَّفٍ ⇒ vacant؛ الإدارةُ فقط تعتمد استثناءً", async () => {
    const layer = await approverLayerFor(db as never, M_PATH);
    expect(layer.kind).toBe("vacant");
    expect(await isBreakGlass(db as never, admin, M_PATH)).toBe(true);
    // مشرفٌ عاديٌّ لا يكسر الزجاج
    expect(await isBreakGlass(db as never, user("rabita", "r1", R_PATH), M_PATH)).toBe(false);
    // ومع وجود طبقةٍ، الإدارةُ لا تكسر الزجاج (ليست شاغرة)
    await assign("p-sq", "square", "sq1", SQ_PATH);
    expect(await isBreakGlass(db as never, admin, M_PATH)).toBe(false);
  });

  it("التدخّلُ الفوقيّ: المنطقةُ بقدرة override تعتمد فوق المربع؛ الإدارةُ لا override لها", async () => {
    await assign("p-sq", "square", "sq1", SQ_PATH);
    await assign("p-r", "rabita", "r1", R_PATH);
    const rabita = user("rabita", "r1", R_PATH);
    // بلا القدرة: لا تدخّل
    expect(await canOverrideApprove(db as never, rabita, ["report.approve"], M_PATH)).toBe(false);
    // بالقدرة: تتدخّل (أعلى من NESSA=المربع)
    expect(await canOverrideApprove(db as never, rabita, ["report.approve", "report.approve.override"], M_PATH)).toBe(true);
    // الإدارةُ لا تملك تدخّلًا فوقيًّا (لها كسرُ الزجاج فقط)
    expect(await canOverrideApprove(db as never, admin, ["*"], M_PATH)).toBe(false);
    // المربعُ نفسُه (NESSA) ليس «فوقيًّا» — هو الأقرب لا override
    expect(await canOverrideApprove(db as never, user("square", "sq1", SQ_PATH), ["*"], M_PATH)).toBe(false);
  });

  it("canApproveUnit يوحّد المسارات: nearest / override / breakglass / none", async () => {
    // شاغر ⇒ الإدارةُ breakglass، المشرفُ none
    expect((await canApproveUnit(db as never, admin, ["*"], M_PATH)).via).toBe("breakglass");
    expect((await canApproveUnit(db as never, user("rabita", "r1", R_PATH), ["report.approve"], M_PATH)).ok).toBe(false);
    // مع مربعٍ ⇒ المربعُ nearest، الإدارةُ none (لا صندوقَ روتينيّ)
    await assign("p-sq", "square", "sq1", SQ_PATH);
    expect((await canApproveUnit(db as never, user("square", "sq1", SQ_PATH), ["report.approve"], M_PATH)).via).toBe("nearest");
    expect((await canApproveUnit(db as never, admin, ["*"], M_PATH)).ok).toBe(false);
  });
});
