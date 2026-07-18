import { Info } from "lucide-react";

export function FormulaNote() {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-100">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
        <Info className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 space-y-1">
        <h4 className="text-sm font-semibold text-gold-700">معادلة احتساب النقاط</h4>
        <p className="text-xs leading-relaxed text-gold-700/80">
          تُحتسب القيمة المالية الشهرية وفق المعادلة المعتمدة:{" "}
          <span className="font-mono-nums font-semibold">280 نقطة = 50$</span>. تُصفَّر النقاط
          تلقائياً في بداية كل شهر هجري.
        </p>
      </div>
    </div>
  );
}
