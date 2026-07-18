import { useState } from "react";
import { Save, Loader2, FolderInput, Archive } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, TextField, SegmentedControl } from "@/components/ui/field";
import { MTreeSelect } from "@/components/ui/m-tree-picker";
import { MSelect } from "@/components/ui/m-select";
import { MDrawer } from "@/components/ui/m-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateOrgUnit, moveOrgUnit, archiveOrgUnit } from "@/lib/api/admin";
import { getOrgTree } from "@/lib/api/search";
import { GOV_OPTIONS, districtsOf, districtLabel } from "@/lib/syria-regions";

type Unit = { id: string; name: string; type: string; genderTrack: string; governorate?: string | null; district?: string | null };
const TYPE_LABEL: Record<string, string> = { section: "قسم", rabita: "منطقة", square: "مربع", mosque: "مسجد", halaqa: "حلقة نسائية" };
const btn = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-emerald-50 shadow-soft ring-1 ring-emerald-900/30 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none disabled:ring-line";

export function OrgUnitEditor({ unit, onClose, onChanged }: { unit: Unit; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState(unit.name);
  const [gender, setGender] = useState(unit.genderTrack);
  const [gov, setGov] = useState(unit.governorate ?? "");
  // المنطقة/البلدة: نصّ حرّ (مع اقتراحات) — يُعرض اسم القضاء المعروف أو أيّ قرية تُكتب يدوياً
  const [district, setDistrict] = useState(unit.district ? districtLabel(unit.governorate, unit.district) : "");
  const [parentId, setParentId] = useState(""); const [parentLbl, setParentLbl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const run = async (key: string, fn: () => Promise<{ error?: string } | { ok: true }>, ok: string, close?: boolean, after?: () => void) => {
    setBusy(key);
    try { const r = await fn(); if (r && "error" in r && r.error) toast.error(r.error); else { toast.success(ok); after?.(); onChanged(); if (close) onClose(); } }
    catch { toast.error("تعذّرت العملية"); } finally { setBusy(null); }
  };

  return (
    <>
      <MDrawer open onOpenChange={(v) => !v && onClose()} title={unit.name} description={TYPE_LABEL[unit.type] ?? unit.type}>
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">المعلومات</h4>
            <Field label="الاسم"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="المسار"><SegmentedControl value={gender} onValueChange={setGender} options={[{ value: "male", label: "رجال" }, { value: "female", label: "نساء" }]} /></Field>
            {unit.type === "mosque" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="المحافظة">
                  <MSelect value={gov} onValueChange={(v) => { setGov(v); setDistrict(""); }} options={GOV_OPTIONS} placeholder="اختر المحافظة…" />
                </Field>
                <Field label="المنطقة/البلدة">
                  <TextField value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!gov}
                    list={`districts-${gov}`} placeholder={gov ? "اكتب أو اختر البلدة/القرية…" : "اختر المحافظة أولاً"} />
                  <datalist id={`districts-${gov}`}>
                    {districtsOf(gov).map((d) => <option key={d.code} value={d.name} />)}
                  </datalist>
                </Field>
              </div>
            )}
            <button disabled={busy === "info" || name.length < 2}
              onClick={() => run("info", () => updateOrgUnit({ data: { id: unit.id, name, genderTrack: gender as "male" | "female", ...(unit.type === "mosque" ? { governorate: gov || null, district: district || null } : {}) } }), "حُفظت المعلومات")} className={btn}>
              {busy === "info" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ
            </button>
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">النقل (تغيير الأب)</h4>
            <Field label="الوحدة الأب الجديدة" hint="يُحدَّث مسار الوحدة وكل فروعها تلقائيًا.">
              <MTreeSelect value={parentId} valueLabel={parentLbl} onChange={(v, l) => { setParentId(v); setParentLbl(l); }} loadTree={() => getOrgTree()} placeholder="اختر الأب الجديد…" title="اختر الوحدة الأب من الهيكلية" />
            </Field>
            <button disabled={busy === "move" || !parentId}
              onClick={() => run("move", () => moveOrgUnit({ data: { id: unit.id, newParentId: parentId } }), "نُقلت الوحدة", true)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-50">
              {busy === "move" ? <Loader2 className="size-4 animate-spin" /> : <FolderInput className="size-4" />} نقل الوحدة
            </button>
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">منطقة الخطر</h4>
            <button onClick={() => setConfirmArchive(true)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-danger-bg px-4 text-sm font-semibold text-danger ring-1 ring-danger/20 transition hover:opacity-90">
              <Archive className="size-4" /> أرشفة الوحدة
            </button>
            <p className="text-[11px] text-ink-faint">الأرشفة تُخفي الوحدة من الشبكة وصفحة الإدارة (حذف ناعم). يلزم نقل/أرشفة التابعين أولًا.</p>
          </div>
        </div>
      </MDrawer>

      <ConfirmDialog open={confirmArchive} onOpenChange={setConfirmArchive} title="أرشفة الوحدة؟"
        description={`ستُخفى «${unit.name}» من النظام (حذف ناعم قابل للاسترجاع لاحقًا).`} confirmLabel="أرشفة" tone="danger" busy={busy === "archive"}
        onConfirm={() => run("archive", () => archiveOrgUnit({ data: { id: unit.id } }), "أُرشفت الوحدة", true, () => setConfirmArchive(false))} />
    </>
  );
}
