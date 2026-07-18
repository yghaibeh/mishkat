import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC للاختبارات والواجبات (المنطق في src/server/exams.server.ts)

export const getMyExams = createServerFn({ method: "GET" }).handler(async () => {
  const { myExamsData } = await import("@/server/exams.server");
  return myExamsData();
});

export const getExamQuestions = createServerFn({ method: "GET" })
  .validator(z.object({ examId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { examQuestionsData } = await import("@/server/exams.server");
    return examQuestionsData(data.examId);
  });

export const submitExam = createServerFn({ method: "POST" })
  .validator(z.object({ examId: z.string().min(1), answers: z.record(z.string()) }))
  .handler(async ({ data }) => {
    const { submitExamData } = await import("@/server/exams.server");
    return submitExamData(data);
  });

export const createExam = createServerFn({ method: "POST" })
  .validator(z.object({
    scopeKind: z.enum(["circle", "mosque"]),
    scopeId: z.string().min(1),
    kind: z.enum(["exam", "homework"]),
    title: z.string().min(2).max(140),
    description: z.string().max(500).optional(),
    dueAt: z.number().int().positive().optional(),
    questions: z.array(z.object({
      kind: z.enum(["mcq", "tf"]),
      text: z.string().min(1).max(500),
      options: z.array(z.string().min(1).max(200)).max(6).optional(),
      correct: z.string().min(1),
      points: z.number().int().min(1).max(20).optional(),
    })).min(1).max(50),
  }))
  .handler(async ({ data }) => {
    const { createExamData } = await import("@/server/exams.server");
    return createExamData(data);
  });

export const publishExam = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { publishExamData } = await import("@/server/exams.server");
    return publishExamData(data.id);
  });

export const getMyCreatedExams = createServerFn({ method: "GET" }).handler(async () => {
  const { myCreatedExamsData } = await import("@/server/exams.server");
  return myCreatedExamsData();
});

export const closeExam = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { closeExamData } = await import("@/server/exams.server");
    return closeExamData(data.id);
  });
