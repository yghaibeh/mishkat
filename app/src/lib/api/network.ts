import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// أغلفة RPC لمتصفّح الشبكة وتقرير المسجد (المنطق في src/server/data.server.ts)

export const getNetwork = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().optional(), section: z.enum(["men", "women"]).optional() }))
  .handler(async ({ data }) => {
    const { networkData } = await import("@/server/data.server");
    return networkData(data.unitId, data.section);
  });

// صندوق «بانتظار اعتمادك» — التقارير المُقدَّمة ضمن نطاق المستخدم
export const getPendingApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const { pendingApprovalsData } = await import("@/server/data.server");
  return pendingApprovalsData();
});

// ق1-د: صندوقُ «كسر الزجاج» للإدارة — وحداتٌ بلا طبقةٍ إشرافيّةٍ مُكلَّفة (اعتمادٌ استثنائيّ).
export const getBreakGlassApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const { pendingBreakGlassData } = await import("@/server/data.server");
  return pendingBreakGlassData();
});

// تقرير الطبقة (ح٢): حالة تقرير الوحدة الإشرافيّة للمالك + تقديمه للاعتماد
export const getLayerReportStatus = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { layerReportStatusData } = await import("@/server/data.server");
    return layerReportStatusData(data.unitId);
  });

export const submitLayerReport = createServerFn({ method: "POST" })
  .validator(z.object({ unitId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { submitLayerReportData } = await import("@/server/data.server");
    return submitLayerReportData(data.unitId);
  });

export const getMosqueOverview = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { mosqueOverviewData } = await import("@/server/data.server");
    return mosqueOverviewData(data.mosqueId);
  });

export const getMosqueReport = createServerFn({ method: "GET" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { mosqueReportData } = await import("@/server/data.server");
    return mosqueReportData(data.mosqueId);
  });

export const approveMosqueMonth = createServerFn({ method: "POST" })
  .validator(z.object({ mosqueId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { approveMonthForMosque } = await import("@/server/data.server");
    return approveMonthForMosque(data.mosqueId);
  });

// «لا يُعتمد — بالتعليل» من صندوق الاعتماد: يرفض كلّ المُقدَّم للوحدة (مسجد/طبقة) بسببٍ يعود لمقدِّمه
export const rejectUnitPending = createServerFn({ method: "POST" })
  .validator(z.object({ unitId: z.string().min(1), reason: z.string().min(2, "التعليل إلزاميّ").max(300) }))
  .handler(async ({ data }) => {
    const { rejectUnitPendingData } = await import("@/server/data.server");
    return rejectUnitPendingData(data.unitId, data.reason);
  });

export const rejectMosqueWeek = createServerFn({ method: "POST" })
  .validator(z.object({ weeklyRecordId: z.string().min(1), reason: z.string().min(1, "سبب الرفض مطلوب") }))
  .handler(async ({ data }) => {
    const { rejectWeekForMosque } = await import("@/server/data.server");
    return rejectWeekForMosque(data.weeklyRecordId, data.reason);
  });

// ر.١ — تصدير التقرير القياديّ (PDF عبر HTML/طباعة، أو CSV) — يُعاد نصًّا ويُنزَّل في المتصفّح
export const exportNetworkRollup = createServerFn({ method: "GET" })
  .validator(z.object({ section: z.enum(["men", "women"]).optional(), month: z.string().optional(), unitId: z.string().optional(), format: z.enum(["html", "csv"]) }))
  .handler(async ({ data }) => {
    const { networkRollupData, networkRollupCsv } = await import("@/server/data.server");
    const r = await networkRollupData({ section: data.section, month: data.month, unitId: data.unitId });
    if (data.format === "csv") return { format: "csv" as const, content: networkRollupCsv(r), scopeName: r.scopeName };
    const { networkRollupHtml } = await import("@/server/services/reportHtml");
    return { format: "html" as const, content: networkRollupHtml(r), scopeName: r.scopeName };
  });

// ر.٢ — سجلّ التدقيق (معزولٌ بالنطاق)
export const getAuditLog = createServerFn({ method: "GET" })
  .validator(z.object({ action: z.string().optional(), entity: z.string().optional(), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => {
    const { auditLogData } = await import("@/server/data.server");
    return auditLogData(data);
  });
