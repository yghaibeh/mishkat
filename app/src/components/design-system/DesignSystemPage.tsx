import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, Landmark, Grid3x3, Building2, User, Users } from "lucide-react";
import { Field, TextField, TextArea, SegmentedControl } from "@/components/ui/field";
import { MSelect } from "@/components/ui/m-select";
import { MCombobox } from "@/components/ui/m-combobox";

const COLORS: { name: string; token: string; cls: string; hex: string; on?: string }[] = [
  { name: "Emerald 900", token: "emerald-900", cls: "bg-emerald-900", hex: "#1F3D2E", on: "text-emerald-50" },
  { name: "Emerald 800", token: "emerald-800", cls: "bg-emerald-800", hex: "#27513E", on: "text-emerald-50" },
  { name: "Emerald 700", token: "emerald-700", cls: "bg-emerald-700", hex: "#32664E", on: "text-emerald-50" },
  { name: "Emerald 500", token: "emerald-500", cls: "bg-emerald-500", hex: "#4F9A78", on: "text-emerald-50" },
  { name: "Emerald 100", token: "emerald-100", cls: "bg-emerald-100", hex: "#DCEFE3" },
  { name: "Gold 700", token: "gold-700", cls: "bg-gold-700", hex: "#8A5A1E", on: "text-gold-50" },
  { name: "Gold 500", token: "gold-500", cls: "bg-gold-500", hex: "#C99A45", on: "text-gold-50" },
  { name: "Gold 50", token: "gold-50", cls: "bg-gold-50", hex: "#F9EFD6" },
  { name: "Surface", token: "surface", cls: "bg-surface ring-1 ring-line", hex: "#FFFFFF" },
  { name: "Surface 2", token: "surface-2", cls: "bg-surface-2 ring-1 ring-line", hex: "#F4F6F2" },
  { name: "Ink", token: "ink", cls: "bg-ink", hex: "#1B2620", on: "text-emerald-50" },
  { name: "Success", token: "success", cls: "bg-success", hex: "#3D8A66", on: "text-emerald-50" },
  { name: "Warn", token: "warn", cls: "bg-warn", hex: "#9C6B22", on: "text-gold-50" },
  { name: "Danger", token: "danger", cls: "bg-danger", hex: "#B84A36", on: "text-emerald-50" },
];

const RADII = [
  { name: "sm", cls: "rounded-sm", px: "0.75rem" },
  { name: "md", cls: "rounded-md", px: "0.81rem" },
  { name: "lg", cls: "rounded-lg", px: "0.875rem" },
  { name: "xl", cls: "rounded-xl", px: "1rem" },
  { name: "2xl", cls: "rounded-2xl", px: "1.25rem" },
];

const SPACES = [
  { name: "1", px: 4 },
  { name: "2", px: 8 },
  { name: "3", px: 12 },
  { name: "4", px: 16 },
  { name: "5", px: 20 },
  { name: "6", px: 24 },
  { name: "8", px: 32 },
  { name: "10", px: 40 },
];

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-10 md:px-6 md:py-14">
      <header className="border-r-2 border-emerald-800 pr-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Mishkat Design System · v1.0
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          النظام التصميمي الموحّد
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          توكنز ومكوّنات قابلة لإعادة الاستخدام تخدم آلاف المساجد وعشرات الآلاف من المستخدمين
          في نظام مشكاة. مصدر حقيقة واحد للون والخط والمسافة والمكوّن.
        </p>
      </header>

      {/* Colors */}
      <Section title="الألوان" subtitle="توكنز معرّفة في styles.css بصيغة OKLCH.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map((c) => (
            <div key={c.token} className="overflow-hidden rounded-xl ring-1 ring-line">
              <div className={`flex h-20 items-end p-3 ${c.cls}`}>
                <span className={`font-mono-nums text-[11px] ${c.on ?? "text-ink"}`}>
                  {c.hex}
                </span>
              </div>
              <div className="bg-surface px-3 py-2">
                <p className="text-xs font-semibold text-ink">{c.name}</p>
                <p className="font-mono-nums text-[10px] text-ink-faint">--{c.token}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section
        title="الطباعة"
        subtitle="Reem Kufi للعناوين · IBM Plex Sans Arabic للنصوص · JetBrains Mono للأرقام."
      >
        <div className="space-y-5 rounded-2xl bg-surface p-6 ring-1 ring-line">
          <Type label="Display / 36" cls="font-display text-4xl font-semibold tracking-tight">
            مسجد النور الكبير
          </Type>
          <Type label="Display / 28" cls="font-display text-2xl font-semibold">
            التقرير الشهري لأمير المسجد
          </Type>
          <Type label="Body / 16" cls="text-base text-ink">
            هذا النص نموذجي يوضّح الخط العربي المستخدم في المتن والقوائم.
          </Type>
          <Type label="Body / 14 — soft" cls="text-sm text-ink-soft">
            وصف ثانوي بحجم أصغر يُستخدم في التسميات والمساعدات.
          </Type>
          <Type label="Mono / Numbers" cls="font-mono-nums text-2xl text-ink">
            243 / 280 · 87% · $43.40
          </Type>
        </div>
      </Section>

      {/* Components */}
      <Section title="المكوّنات" subtitle="أزرار، شارات، بطاقات، تنبيهات، حقول.">
        <div className="space-y-6">
          {/* Buttons */}
          <Card label="الأزرار">
            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex h-10 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-emerald-50 shadow-soft hover:bg-emerald-900">
                زر أساسي
              </button>
              <button className="inline-flex h-10 items-center rounded-xl bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line hover:bg-surface-2">
                زر ثانوي
              </button>
              <button className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-emerald-800 hover:bg-emerald-50">
                زر شفّاف
              </button>
              <button
                disabled
                className="inline-flex h-10 cursor-not-allowed items-center rounded-xl bg-surface-2 px-5 text-sm font-semibold text-ink-faint ring-1 ring-line"
              >
                معطّل
              </button>
            </div>
          </Card>

          {/* Badges */}
          <Card label="الشارات">
            <div className="flex flex-wrap items-center gap-2">
              <Badge cls="bg-success-bg text-success ring-success/20" dot="bg-success">
                مكتمل
              </Badge>
              <Badge cls="bg-warn-bg text-warn ring-warn/20" dot="bg-warn">
                دون الهدف
              </Badge>
              <Badge cls="bg-danger-bg text-danger ring-danger/20" dot="bg-danger">
                متأخّر
              </Badge>
              <Badge cls="bg-gold-50 text-gold-700 ring-gold-100" dot="bg-gold-600">
                بانتظار الاعتماد
              </Badge>
            </div>
          </Card>

          {/* Alerts */}
          <Card label="التنبيهات">
            <div className="grid gap-3 sm:grid-cols-2">
              <Alert
                icon={<CheckCircle2 className="size-4" />}
                title="تم الحفظ"
                tone="bg-success-bg text-success ring-success/20"
              >
                حُفظت آخر التغييرات بنجاح.
              </Alert>
              <Alert
                icon={<AlertTriangle className="size-4" />}
                title="انتباه"
                tone="bg-warn-bg text-warn ring-warn/20"
              >
                لم تُكمل تقرير الأسبوع الثالث.
              </Alert>
              <Alert
                icon={<XCircle className="size-4" />}
                title="فشل التحميل"
                tone="bg-danger-bg text-danger ring-danger/20"
              >
                تعذّر الوصول إلى الخادم.
              </Alert>
              <Alert
                icon={<Info className="size-4" />}
                title="معلومة"
                tone="bg-emerald-50 text-emerald-800 ring-emerald-100"
              >
                التقارير تُصفّر شهرياً وفق التقويم الهجري.
              </Alert>
            </div>
          </Card>

          {/* Inputs */}
          <Card label="الحقول">
            <div className="grid max-w-md gap-3">
              <input
                placeholder="اسم المسجد"
                className="h-11 rounded-xl bg-surface px-4 text-sm text-ink ring-1 ring-line outline-none transition focus:ring-2 focus:ring-emerald-600"
              />
              <input
                placeholder="معطّل"
                disabled
                className="h-11 cursor-not-allowed rounded-xl bg-surface-2 px-4 text-sm text-ink-faint ring-1 ring-line"
              />
            </div>
          </Card>
        </div>
      </Section>

      {/* Form components */}
      <Section title="حقول الإدخال العالمية" subtitle="مبنية على Radix/cmdk — وصول كامل، لوحة مفاتيح، RTL. تُستخدم في كل النماذج.">
        <FormShowcase />
      </Section>

      {/* Radius & Spacing */}
      <Section title="الزوايا والمسافات" subtitle="سُلّم 4pt للمسافات، وزوايا منضبطة للحاويات.">
        <div className="grid gap-6 md:grid-cols-2">
          <Card label="الزوايا (Radius)">
            <div className="flex flex-wrap items-end gap-3">
              {RADII.map((r) => (
                <div key={r.name} className="space-y-2 text-center">
                  <div className={`size-16 bg-emerald-800 ${r.cls}`} />
                  <p className="text-xs font-semibold text-ink">{r.name}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card label="المسافات (Spacing)">
            <div className="space-y-2">
              {SPACES.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-mono-nums text-ink-faint">{s.name}</span>
                  <div className="h-3 rounded bg-emerald-700" style={{ width: s.px }} />
                  <span className="text-xs font-mono-nums text-ink-soft">{s.px}px</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* Shadows & States */}
      <Section title="الظلال والحالات">
        <div className="grid gap-6 md:grid-cols-2">
          <Card label="الارتفاع (Elevation)">
            <div className="grid grid-cols-3 gap-3">
              <div className="grid h-20 place-items-center rounded-xl bg-surface ring-1 ring-line text-[11px] text-ink-soft">
                ring
              </div>
              <div className="grid h-20 place-items-center rounded-xl bg-surface shadow-soft text-[11px] text-ink-soft">
                soft
              </div>
              <div className="grid h-20 place-items-center rounded-xl bg-emerald-900 text-[11px] text-emerald-50 shadow-soft">
                brand
              </div>
            </div>
          </Card>
          <Card label="حالات التفاعل">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-100">
                hover
              </div>
              <div className="rounded-lg bg-emerald-100 p-3 text-emerald-900 ring-1 ring-emerald-200">
                active
              </div>
              <div className="rounded-lg bg-surface p-3 text-ink ring-2 ring-emerald-600">
                focus
              </div>
              <div className="rounded-lg bg-surface-2 p-3 text-ink-faint ring-1 ring-line">
                disabled
              </div>
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}

function Type({ label, cls, children }: { label: string; cls: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-4 last:border-b-0 last:pb-0 md:flex-row md:items-baseline md:gap-6">
      <span className="w-32 shrink-0 text-[10px] uppercase tracking-widest text-ink-faint font-mono-nums">
        {label}
      </span>
      <div className={cls}>{children}</div>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
        {label}
      </p>
      {children}
    </div>
  );
}

function Badge({ cls, dot, children }: { cls: string; dot: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

function Alert({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${tone}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] opacity-80">{children}</p>
      </div>
    </div>
  );
}

function FormShowcase() {
  const [type, setType] = useState("mosque");
  const [unit, setUnit] = useState("");
  const [track, setTrack] = useState("male");
  const [name, setName] = useState("");

  const TYPE_OPTS = [
    { value: "rabita", label: "منطقة (محافظة أو أكثر)", icon: Landmark },
    { value: "square", label: "مربع", icon: Grid3x3 },
    { value: "mosque", label: "مسجد", icon: Building2 },
  ];
  const UNIT_OPTS = [
    { value: "sahel", label: "منطقة الساحل", hint: "منطقة (محافظة أو أكثر)", icon: Landmark, depth: 0 },
    { value: "sq-1", label: "مربع 1", hint: "مربع", icon: Grid3x3, depth: 1 },
    { value: "m-farouq", label: "مسجد الفاروق", hint: "مسجد", icon: Building2, depth: 2 },
    { value: "m-nour", label: "مسجد النور", hint: "مسجد", icon: Building2, depth: 2 },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card label="Select — قائمة منسدلة (بأيقونات + علامة اختيار)">
        <Field label="النوع">
          <MSelect value={type} onValueChange={setType} options={TYPE_OPTS} />
        </Field>
        <Field label="الدور" className="mt-4">
          <MSelect value={undefined} onValueChange={() => {}} placeholder="اختر دوراً…"
            options={[{ value: "amir", label: "أمير مسجد", icon: User }, { value: "square", label: "مسؤول مربع", icon: Users }]} />
        </Field>
      </Card>

      <Card label="Combobox — منتقٍ قابل للبحث (يتوسّع لآلاف الوحدات)">
        <Field label="الوحدة" hint="ابحث بالاسم — مع تدرّج هرمي.">
          <MCombobox value={unit} onValueChange={setUnit} options={UNIT_OPTS}
            placeholder="— اختر الوحدة —" searchPlaceholder="ابحث عن وحدة…" />
        </Field>
      </Card>

      <Card label="SegmentedControl — مفتاح مقسّم">
        <Field label="المسار">
          <SegmentedControl value={track} onValueChange={setTrack}
            options={[{ value: "male", label: "رجال" }, { value: "female", label: "نساء" }]} />
        </Field>
      </Card>

      <Card label="Field + TextField + TextArea">
        <Field label="الاسم" required hint="حقل نصّي موحّد بحالات تركيز واضحة.">
          <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مسجد الإمام" />
        </Field>
        <Field label="ملاحظات" className="mt-4">
          <TextArea placeholder="نص متعدد الأسطر…" />
        </Field>
      </Card>
    </div>
  );
}
