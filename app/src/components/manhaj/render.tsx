import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// عرض محتوى منهاج «على بصيرة» بمكوّنات React وبتصميم «مشكاة» (لا HTML خام).

export type InlineNode = { t: string; s: string; narrator?: string; source?: string; role?: string };
export type Block =
  | { type: "heading"; role?: string; text: string }
  | { type: "paragraph"; md?: string; inline?: InlineNode[]; item_role?: string }
  | { type: "table"; rows?: string[][]; html?: string }
  | { type: "image"; src: string; caption?: string };

export const toAr = (n: number | string) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

// علامة نهاية الآية U+06DD + رقمها — تُرسَم دائرةً مخصّصة (لا تعتمد على دعم الخطّ للرمز)
const AYAH_END_RE = /۝[٠-٩]*/g;
function quranContent(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  AYAH_END_RE.lastIndex = 0;
  while ((m = AYAH_END_RE.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const digits = m[0].slice(1);
    out.push(<span key={`a${k++}`} className="ayah-end" aria-label={digits ? `الآية ${digits}` : "نهاية الآية"}>{digits}</span>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const SAW = "صلى الله عليه وسلم";
const HON = [
  "عليه الصلاة والسلام", "عليهما السلام", "عليهم السلام", "عليها السلام", "عليه السلام",
  "رضي الله عنهما", "رضي الله عنهم", "رضي الله عنهن", "رضي الله عنها", "رضي الله عنه",
  "رحمهما الله", "رحمهم الله", "رحمه الله",
  "سبحانه وتعالى", "تبارك وتعالى", "جل جلاله", "جل وعلا", "عز وجل",
];
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RICH_RE = new RegExp(`(﴿[^﴾]*﴾)|(${[SAW, ...HON].sort((a, b) => b.length - a.length).map(escRe).join("|")})`, "g");

// نصّ غنيّ: يميّز القرآن ﴿﴾ وعبارات التعظيم (ﷺ والبقية) داخل أيّ نصّ خام
function richText(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  RICH_RE.lastIndex = 0;
  while ((m = RICH_RE.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("﴿")) out.push(<span key={k++} className="font-quran text-[1.08em] leading-[2.3] text-emerald-800">{quranContent(tok)}</span>);
    else if (tok === SAW) out.push(<span key={k++} title={SAW} className="font-honorific text-[1.3em] text-emerald-800 align-middle">ﷺ</span>);
    else out.push(<span key={k++} className="whitespace-nowrap font-honorific text-[1.06em] text-gold-700">{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === "ayah") return <span key={i} className="font-quran text-[1.08em] leading-[2.3] text-emerald-800">﴿{quranContent(n.s)}﴾</span>;
        if (n.t === "hadith") {
          const meta = [n.narrator && `الراوي: ${n.narrator}`, n.source && `المصدر: ${n.source}`].filter(Boolean).join(" · ");
          return <span key={i} title={meta || "حديث"} className="cursor-help rounded bg-gold-50 px-1 font-medium text-gold-700 ring-1 ring-gold-100">«{n.s}»</span>;
        }
        if (n.t === "honorific") return <span key={i}>{richText(n.s)}</span>;
        if (n.t === "quote") return <span key={i}>«{n.s}»</span>;
        if (n.t === "citation") return <span key={i} className="text-[.85em] text-ink-faint">{n.s}</span>;
        if (n.t === "emphasis") return <b key={i} className={cn("font-semibold", n.role === "lemma" && "text-emerald-800")}>{n.s}</b>;
        return <span key={i}>{richText(n.s || "")}</span>;
      })}
    </>
  );
}

function Table({ rows }: { rows: string[][] }) {
  if (!rows?.length) return null;
  const [head, ...body] = rows;
  return (
    <div className="my-5 overflow-x-auto rounded-xl ring-1 ring-line">
      <table className="w-full border-collapse text-right text-[15px]">
        <thead>
          <tr className="bg-emerald-50 text-emerald-900">
            {head.map((c, i) => <th key={i} className="border border-line px-3 py-2 text-start font-semibold">{richText(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="odd:bg-surface even:bg-surface-2/40">
              {r.map((c, ci) => <td key={ci} className="border border-line px-3 py-2 align-top">{richText(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "heading") return <h3 key={i} className="mt-7 mb-2 font-display text-xl font-semibold text-gold-700">{richText(b.text)}</h3>;
        if (b.type === "paragraph") {
          const item = b.item_role;
          const cls = item === "question" ? "border-s-[3px] border-gold-500 bg-gold-50/40 ps-3"
            : item === "activity_step" ? "border-s-[3px] border-emerald-700 bg-emerald-50/40 ps-3" : "";
          return <p key={i} className={cn("my-2.5 leading-[2] text-ink", cls)}>{b.inline ? <Inline nodes={b.inline} /> : richText(b.md || "")}</p>;
        }
        if (b.type === "table") return <Table key={i} rows={b.rows ?? []} />;
        if (b.type === "image") return (
          <figure key={i} className="my-6 text-center">
            <img src={`/baseera/${b.src}`} alt={b.caption || ""} loading="lazy" className="mx-auto max-w-full rounded-xl ring-1 ring-line shadow-soft" />
            {b.caption && <figcaption className="mt-2 text-sm text-ink-faint">{b.caption}</figcaption>}
          </figure>
        );
        return null;
      })}
    </>
  );
}
