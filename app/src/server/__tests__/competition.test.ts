// المسابقة (ج٤) — وصْلُ منطق الرصد/الترتيب/التأهّل/الفائز الذي كان معرَّفًا بلا واجهة.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  state.user = admin;
  await db.insert(schema.orgUnits).values([
    { id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد ١", status: "active", createdAt: 0 },
    { id: "m-arch", parentId: null, path: "/men/m-arch/", type: "mosque", section: "men", genderTrack: "male", name: "مؤرشف", status: "archived", createdAt: 0 },
  ]).run();
  await db.insert(schema.persons).values([
    { id: "p-a", fullName: "أحمد", gender: "male", status: "active", createdAt: 0 },
    { id: "p-b", fullName: "بلال", gender: "male", status: "active", createdAt: 0 },
  ]).run();
});

describe("المسابقة: من الرصد إلى الفائز", () => {
  it("تسجيلٌ ثم برنامجٌ واختبارٌ ورصدٌ ⇒ ترتيبٌ صحيح ثم تأهيلٌ فاختيارُ فائز", async () => {
    const { createCompetitionData, registerParticipantData, addProgramData, addExamData, recordScoreData, recordExamResultData, competitionManageData, leaderboardPage, qualifyTopData, selectWinnerData } = await import("@/server/competition.server");
    const c = await createCompetitionData({ name: "مسابقة الاختبار" });
    const compId = (c as { id: string }).id;
    await registerParticipantData({ competitionId: compId, personId: "p-a", mosqueId: "m1", age: 20 });
    await registerParticipantData({ competitionId: compId, personId: "p-b", mosqueId: "m1", age: 22 });
    const prog = await addProgramData({ competitionId: compId, monthHijri: "1447-07", track: "عام", title: "حفظ", maxPoints: 100 });
    const exam = await addExamData({ competitionId: compId, title: "اختبار", maxScore: 100 });
    const mg = await competitionManageData(compId);
    expect(mg.participants.length).toBe(2);
    const pa = mg.participants.find((p) => p.personId === "p-a")!;
    const pb = mg.participants.find((p) => p.personId === "p-b")!;
    // أحمد أعلى (٩٠+٨٠) من بلال (٥٠+٤٠)
    await recordScoreData({ participantId: pa.id, programId: (prog as { id: string }).id, points: 90 });
    await recordExamResultData({ examId: (exam as { id: string }).id, participantId: pa.id, score: 80 });
    await recordScoreData({ participantId: pb.id, programId: (prog as { id: string }).id, points: 50 });
    await recordExamResultData({ examId: (exam as { id: string }).id, participantId: pb.id, score: 40 });

    const board = await leaderboardPage(compId);
    expect(board.items[0].name).toBe("أحمد");
    expect(board.items[0].total).toBe(170);
    expect(board.items[1].total).toBe(90);

    // حدود الدرجة: أكبر من العظمى يُرفض
    const bad = await recordExamResultData({ examId: (exam as { id: string }).id, participantId: pb.id, score: 999 });
    expect("error" in bad && bad.error).toBeTruthy();

    // تأهيلُ الأعلى ثم الفائز
    const q = await qualifyTopData({ competitionId: compId, topN: 1 });
    expect((q as { qualified: number }).qualified).toBe(1);
    const w = await selectWinnerData({ competitionId: compId });
    expect((w as { personId: string }).personId).toBe("p-a");
    const winner = (await db.select().from(schema.participants).where(eq(schema.participants.personId, "p-a")).all())[0];
    expect(winner.status).toBe("winner");
    const comp = (await db.select().from(schema.competitions).where(eq(schema.competitions.id, compId)).all())[0];
    expect(comp.status).toBe("closed");
  });

  it("لا تسجيلَ في مسجدٍ مؤرشف، ولا إرجاعَ حالة المسابقة", async () => {
    const { createCompetitionData, registerParticipantData, setCompetitionStatusData } = await import("@/server/competition.server");
    const c = await createCompetitionData({ name: "م" });
    const compId = (c as { id: string }).id;
    const bad = await registerParticipantData({ competitionId: compId, personId: "p-a", mosqueId: "m-arch", age: 20 });
    expect("error" in bad && bad.error).toBeTruthy();
    // active → closed مسموح، لكن closed → active ممنوع (لا إعادة فتح)
    await setCompetitionStatusData({ id: compId, status: "closed" });
    const reopen = await setCompetitionStatusData({ id: compId, status: "active" });
    expect("error" in reopen && reopen.error).toBeTruthy();
  });
});
