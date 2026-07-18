import { useState } from "react";
import { XCircle, Loader2 } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rejectMosqueWeek } from "@/lib/api/network";

type Status = "done" | "below" | "pending";

interface Row {
  weeklyRecordId?: string | null;
  week: string;
  dateRange?: string;
  points: number;
  target: number;
  status: Status;
  approvalStatus?: string;
  canLayerReject?: boolean;
  note?: string;
}

const STATUS: Record<Status, { label: string; cls: string; dot: string; bar: string }> = {
  done: {
    label: "مكتمل",
    cls: "bg-success-bg text-success ring-success/20",
    dot: "bg-success",
    bar: "bg-emerald-700",
  },
  below: {
    label: "دون الهدف",
    cls: "bg-warn-bg text-warn ring-warn/20",
    dot: "bg-warn",
    bar: "bg-warn",
  },
  pending: {
    label: "قيد التنفيذ",
    cls: "bg-surface-2 text-ink-soft ring-line",
    dot: "bg-ink-faint",
    bar: "bg-ink-faint",
  },
};

// «آخر تحديث» حقيقيٌّ من السجل (كان نصًّا جامدًا «منذ ساعتين» — تدقيق ٣٣ §٥)
function lastUpdatedLabel(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 60) return `آخر تحديث: قبل ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `آخر تحديث: قبل ${hours} ساعة`;
  return `آخر تحديث: قبل ${Math.round(hours / 24)} يوم`;
}

export function WeeklyTable({ rows, lastEntryAt }: { rows: Row[]; lastEntryAt?: number | null }) {
  const router = useRouter();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const someCanReject = rows.some((r) => r.canLayerReject && r.weeklyRecordId);

  const openReject = (id: string) => { setRejectingId(id); setReason(""); };
  const closeReject = () => { setRejectingId(null); setReason(""); };

  const onReject = async (weeklyRecordId: string) => {
    if (!reason.trim()) { toast.error("سبب الرفض مطلوب"); return; }
    setBusy(true);
    try {
      const res = await rejectMosqueWeek({ data: { weeklyRecordId, reason: reason.trim() } });
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("تم رفض الأسبوع", { description: `السبب: ${reason.trim()}` });
        closeReject();
        await router.invalidate();
      }
    } catch {
      toast.error("تعذّر تنفيذ الرفض");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold text-ink">سجل النقاط الأسبوعي</h3>
        {lastUpdatedLabel(lastEntryAt) && (
          <span className="text-[11px] text-ink-faint">{lastUpdatedLabel(lastEntryAt)}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">الأسبوع</th>
              <th className="px-5 py-3 font-medium">النقاط</th>
              <th className="px-5 py-3 font-medium">الحالة</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">ملاحظات</th>
              {someCanReject && <th className="px-5 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const s = STATUS[row.status];
              const isRejecting = rejectingId === row.weeklyRecordId && !!row.weeklyRecordId;
              const colSpan = someCanReject ? 5 : 4;

              if (isRejecting) {
                return (
                  <>
                    <tr key={`${row.week}-data`} className="bg-surface-2/40">
                      <td className="px-5 py-4 font-medium text-ink">
                        <div>{row.week}</div>
                        {row.dateRange && <div className="mt-0.5 text-[11px] font-normal text-ink-faint">{row.dateRange}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono-nums text-ink">
                          {row.points}<span className="text-ink-faint"> / {row.target}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", s.cls)}>
                          <span className={cn("size-1.5 rounded-full", s.dot)} />{s.label}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 text-xs text-ink-soft md:table-cell">{row.note ?? "—"}</td>
                      {someCanReject && <td />}
                    </tr>
                    <tr key={`${row.week}-form`}>
                      <td colSpan={colSpan} className="border-t border-red-100 bg-red-50/60 px-5 py-3">
                        <div className="flex items-start gap-3">
                          <textarea
                            autoFocus
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="اكتب سبب الرفض…"
                            rows={2}
                            className="flex-1 resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-red-400"
                          />
                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              onClick={() => onReject(row.weeklyRecordId!)}
                              disabled={busy || !reason.trim()}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-700 px-4 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                              تأكيد الرفض
                            </button>
                            <button
                              onClick={closeReject}
                              className="h-9 rounded-xl bg-surface px-4 text-xs text-ink ring-1 ring-line"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>
                );
              }

              return (
                <tr key={row.week} className="transition-colors hover:bg-surface-2/40">
                  <td className="px-5 py-4 font-medium text-ink">
                    <div>{row.week}</div>
                    {row.dateRange && <div className="mt-0.5 text-[11px] font-normal text-ink-faint">{row.dateRange}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-mono-nums text-ink">
                      {row.points}<span className="text-ink-faint"> / {row.target}</span>
                    </div>
                    <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn("h-full rounded-full", s.bar)}
                        style={{ width: `${Math.min(100, Math.round((row.points / row.target) * 100))}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", s.cls)}>
                      <span className={cn("size-1.5 rounded-full", s.dot)} />{s.label}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 text-xs text-ink-soft md:table-cell">{row.note ?? "—"}</td>
                  {someCanReject && (
                    <td className="px-5 py-4">
                      {row.canLayerReject && row.weeklyRecordId && (
                        <button
                          onClick={() => openReject(row.weeklyRecordId!)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-100"
                        >
                          <XCircle className="size-3" />
                          رفض
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
