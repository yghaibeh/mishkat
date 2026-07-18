import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لوحدة المسابقة (المنطق في src/server/competition.server.ts)

export const getCompetition = createServerFn({ method: "GET" }).handler(async () => {
  const { competitionData } = await import("@/server/competition.server");
  return competitionData();
});

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator(z.object({ competitionId: z.string().min(1), q: z.string().optional(), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { leaderboardPage } = await import("@/server/competition.server");
    return leaderboardPage(data.competitionId, data.q, data.offset ?? 0);
  });

export const registerParticipant = createServerFn({ method: "POST" })
  .validator(z.object({ competitionId: z.string().min(1), personId: z.string().min(1), mosqueId: z.string().min(1), age: z.number().int().min(1) }))
  .handler(async ({ data }) => {
    const { registerParticipantData } = await import("@/server/competition.server");
    return registerParticipantData(data);
  });

export const createCompetition = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(2), startMonth: z.string().optional(), endMonth: z.string().optional(), prizePool: z.number().min(0).optional() }))
  .handler(async ({ data }) => {
    const { createCompetitionData } = await import("@/server/competition.server");
    return createCompetitionData(data);
  });

export const setCompetitionStatus = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), status: z.enum(["active", "qualifying", "closed"]) }))
  .handler(async ({ data }) => {
    const { setCompetitionStatusData } = await import("@/server/competition.server");
    return setCompetitionStatusData(data);
  });

// ===== إدارةُ المسابقة: البرامج والاختبارات والرصد والتأهيل (ج٤) =====
export const getCompetitionManage = createServerFn({ method: "GET" })
  .validator(z.object({ competitionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { competitionManageData } = await import("@/server/competition.server");
    return competitionManageData(data.competitionId);
  });

export const addProgram = createServerFn({ method: "POST" })
  .validator(z.object({ competitionId: z.string().min(1), monthHijri: z.string().min(4).max(10), track: z.string().min(1).max(40), title: z.string().min(2).max(120), maxPoints: z.number().int().min(0).max(100000).optional() }))
  .handler(async ({ data }) => {
    const { addProgramData } = await import("@/server/competition.server");
    return addProgramData(data);
  });

export const addCentralExam = createServerFn({ method: "POST" })
  .validator(z.object({ competitionId: z.string().min(1), title: z.string().min(2).max(120), dateHijri: z.string().max(10).optional(), maxScore: z.number().int().min(1).max(100000).optional() }))
  .handler(async ({ data }) => {
    const { addExamData } = await import("@/server/competition.server");
    return addExamData(data);
  });

export const recordScore = createServerFn({ method: "POST" })
  .validator(z.object({ participantId: z.string().min(1), programId: z.string().min(1), points: z.number().int().min(0).max(100000), excuseStatus: z.enum(["none", "excused"]).optional() }))
  .handler(async ({ data }) => {
    const { recordScoreData } = await import("@/server/competition.server");
    return recordScoreData(data);
  });

export const recordExamResult = createServerFn({ method: "POST" })
  .validator(z.object({ examId: z.string().min(1), participantId: z.string().min(1), score: z.number().int().min(0).max(100000) }))
  .handler(async ({ data }) => {
    const { recordExamResultData } = await import("@/server/competition.server");
    return recordExamResultData(data);
  });

export const qualifyTop = createServerFn({ method: "POST" })
  .validator(z.object({ competitionId: z.string().min(1), topN: z.number().int().min(1).max(1000) }))
  .handler(async ({ data }) => {
    const { qualifyTopData } = await import("@/server/competition.server");
    return qualifyTopData(data);
  });

export const selectWinner = createServerFn({ method: "POST" })
  .validator(z.object({ competitionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { selectWinnerData } = await import("@/server/competition.server");
    return selectWinnerData(data);
  });
