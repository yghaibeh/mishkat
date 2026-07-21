/**
 * إثباتُ ثوابت T14 **بالكسر لا بالادعاء** (TESTING_POLICY §٢، ونهجُ `gates:prove`).
 *
 * لكلٍّ من الثوابت الثمانية الإلزامية: يُكسر الثابتُ في المصدر، ويُشغَّل طقمُ الوحدة،
 * ويُتحقق أنّ اختباراتٍ **سقطت** — ثم يُرجَع المصدرُ ويُتحقق أنّ الطقم عاد أخضر.
 * ثابتٌ لا يسقط عند كسره ليس محروساً — بل موصوفاً في وثيقة.
 *
 * التشغيل: `node tools/prove-t14.mjs`
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SUITE = ["tests/features/custody", "tests/screens/custody-screen-matrix.test.ts"]

/** كسرٌ = (ملف، استبدالٌ نصّيّ) — والاستبدالُ يجب أن يُصيب موضعاً واحداً بالضبط. */
const BREAKS = [
  {
    id: "١",
    rule: "ق-٧٨/ب-٢٩ — لا تغييرَ حائزٍ بلا حدثِ سلسلة",
    how: "فتحُ البابِ الثاني: قبولُ أيّ حقلٍ في تحرير الأصل (فيُحرَّر الحائزُ مباشرةً)",
    file: "src/features/custody/services/assets.ts",
    from: '    if (isEditable(key)) patch[key] = value\n    else rejected.push(key)',
    to: '    if (isEditable(key)) patch[key] = value',
  },
  {
    id: "٢",
    rule: "ق-٧٩ — الإقرارُ للمستلِم وحده",
    how: "نزعُ حارس العمق: قبولُ إقرارِ أيّ أحدٍ عن المستلِم",
    file: "src/features/custody/services/chain.ts",
    from: '  if (move.toPersonId !== input.personId) return custodyErr("NOT_RECEIVING_HOLDER", input.personId)',
    to: '  void input.personId',
  },
  {
    id: "٣",
    rule: "ق-٨٠ — حالاتٌ صريحةٌ لا حذفٌ صامت",
    how: "زرعُ دالةِ حذفٍ في المستودع (المحوُ يعود)",
    file: "src/features/custody/data/store.ts",
    from: "  getMove(id: string): CustodyMove | null {",
    to: "  deleteMove(id: string): void {\n    this.moveList = this.moveList.filter((m) => m.id !== id)\n  }\n\n  getMove(id: string): CustodyMove | null {",
  },
  {
    id: "٣ب",
    rule: "ق-٨٠ — الحالةُ تحكم لا بقايا الحقول",
    how: "عرضُ الحائز مع الحالات غير الحائزة (تناقضُ «بعهدة فلان» و«في الوحدة»)",
    file: "src/features/custody/services/derive.ts",
    from: "    holderPersonId: last !== null && isHoldingStatus(status) ? last.toPersonId : null,",
    to: "    holderPersonId: last === null ? null : last.toPersonId,",
  },
  {
    id: "٤",
    rule: "ق-٨١ — عزلُ النطاق: ولا لشخصٍ خارج نطاقك",
    how: "إسقاطُ فحص بلوغ المستلِم للنطاق",
    file: "src/features/custody/services/chain.ts",
    from: "    if (!ctx.reaches(recipient, asset.unitPath)) {\n      return custodyErr(\"RECIPIENT_OUT_OF_SCOPE\", recipient)\n    }",
    to: "    void ctx.reaches",
  },
  {
    id: "٥",
    rule: "ق-٨٢ — لا تُطوى صفحةُ كادرٍ وبيده عهدة",
    how: "تبرئةُ الجميع: التحقّقُ يقول «مُبرَّأ» دائماً",
    file: "src/features/custody/services/handoff.ts",
    from: "  const open = openCustodyOf(store, personId)\n  return { clear: open.length === 0, open }",
    to: "  void store\n  void personId\n  return { clear: true, open: [] }",
  },
  {
    id: "٦",
    rule: "ق-٨٣ — التدقيقُ يلازم كلَّ حركةِ حيازة",
    how: "نزعُ قيد التدقيق عن حركة السلسلة",
    file: "src/features/custody/services/chain.ts",
    from: '      action: "custody.move.record",\n      scopePath: asset.unitPath,',
    to: '      action: "custody.move.SILENCED",\n      scopePath: asset.unitPath,',
  },
  {
    id: "٧",
    rule: "قب-١٨ — عزلُ الشبكة",
    how: "قبولُ شبكةِ المدخل بدل شبكة المستودع",
    file: "src/features/custody/data/store.ts",
    from: "  saveAsset(a: Asset): void {\n    this.assetMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))",
    to: "  saveAsset(a: Asset): void {\n    this.assetMap.set(a.id, Object.freeze({ ...a }))",
  },
  {
    id: "٨",
    rule: "G20/مصفوفةُ الشاشات — القدرةُ الشخصية تُسقَط بالملكية لا بالدور",
    how: "إسقاطُ «عُهدتي» بحزمة الدور (فيظهر البابُ الشخصيُّ لمن لا عهدةَ بيده)",
    file: "src/features/custody/screens/caps.ts",
    from: "      if (!ownsCustody) continue",
    to: "      void ownsCustody",
  },
]

function runSuite() {
  try {
    execFileSync("npx", ["vitest", "run", ...SUITE], { cwd: ROOT, stdio: "pipe" })
    return { green: true, failures: 0 }
  } catch (e) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "")
    const m = /Tests\s+(\d+) failed/.exec(out)
    return { green: false, failures: m ? Number(m[1]) : -1 }
  }
}

const before = runSuite()
if (!before.green) {
  console.error("✗ الطقم أحمرُ قبل الكسر — لا معنى لإثباتٍ فوق بناءٍ أحمر")
  process.exit(1)
}
console.log(`✓ الطقم أخضرُ قبل أيّ كسر\n`)

let bad = 0
for (const b of BREAKS) {
  const path = join(ROOT, b.file)
  const original = readFileSync(path, "utf8")
  const occurrences = original.split(b.from).length - 1
  if (occurrences !== 1) {
    console.error(`✗ [${b.id}] موضعُ الكسر غيرُ فريد في ${b.file} (وجدتُ ${occurrences}) — الإثباتُ باطل`)
    bad += 1
    continue
  }
  writeFileSync(path, original.replace(b.from, b.to))
  const broken = runSuite()
  writeFileSync(path, original)
  const restored = runSuite()

  const ok = !broken.green && restored.green
  if (!ok) bad += 1
  console.log(`${ok ? "✓" : "✗"} [${b.id}] ${b.rule}`)
  console.log(`    الكسر: ${b.how}`)
  console.log(
    `    سقط عند الكسر: ${broken.green ? "لا ← الثابتُ غيرُ محروس" : `نعم (${broken.failures} اختباراً)`} · عاد أخضرَ بعد الإرجاع: ${restored.green ? "نعم" : "لا"}\n`,
  )
}

if (bad > 0) {
  console.error(`✗ ثوابتُ لم تُثبَت: ${bad}`)
  process.exit(1)
}
console.log(`✓ الثوابتُ الـ${BREAKS.length} كلُّها أسقطت اختباراتٍ عند كسرها ثم عادت خضراء`)
