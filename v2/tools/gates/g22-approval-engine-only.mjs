/**
 * G22 — «لا منطقَ اعتمادٍ خارج المحرّك» (نظيرُ G6 على مجال الاعتماد).
 *
 * **الدرسُ الذي تحرسه**: في v1 كان منطقُ الاعتماد **مبعثراً** في كل ميزة (`records.ts`
 * و`registration.server.ts` و`supervision.server.ts` و`unitBox.ts`…) فاختلفت السلوكيات
 * وتناقضت، وكلَّف تصحيحُها إعادةَ كتابةِ ~١٢ موضعاً (ق-١، الوثيقة ٢٩). وفي v2 **محرّكٌ
 * واحدٌ عامّ تُسجَّل فيه أنواعُ الاعتماد**، فتفشل هذه البوابةُ على أوّل سطرٍ يخرج عنه.
 *
 * تفشل على ثلاثةٍ خارج مجلد المحرّك:
 *  ١. **فحصُ «من يعتمد؟»**: أي مفردةِ توجيهٍ (`approverLayer`/`breakGlass`/`nessa`…).
 *  ٢. **إدارةُ حالةِ اعتماد**: أنواعُ المحرّك وأفعالُه (`ApprovalRequest`, `approveRequest`…)
 *     أو حالاتُ v1 المنسوخة (`layer_approved`, `amir_approved`).
 *  ٣. **استهلاكُ قدرةِ اعتماد** (`report.approve`, `approve.breakGlass`, `box.closing.*`…)
 *     خارج المحرّك — إلا في **طبقة العرض**، فالواجهةُ تعرض ولا تقرر (المادة ٤/٦، G20).
 *
 * **القياسُ محتوائيٌّ بحت** (قب-٢٣): يقرأ المصدرَ ولا يسأل عن `mtime` ولا حالةِ جهاز —
 * فالنتيجةُ نفسُها على نسخةٍ جديدة في CI. وتُثبَت بالفشل: `npm run gates:prove G22`.
 *
 * **وما ليس مقصوداً بها**: الاعتمادُ الثنائيّ الماليّ (ق-٥٣) **آليةٌ أخرى معلنةٌ في §٤.٢**
 * (خانقٌ على الفعل لا سلسلةٌ على الشجرة)، واعتمادُ التكليف المعلَّق (`approvalStatus`) شأنُ
 * الإسناد لا سلسلةِ NESSA — فلا تُحسب مخالفةً.
 */
import { walk, read, rel, fail, pass, ROOT, stripCommentsAndStrings, stripCommentsOnly } from "./_lib.mjs"
import { join } from "node:path"
import { existsSync } from "node:fs"

/** مجلدُ المحرّك وحدَه يعرف عن الاعتماد — ومعه اختباراتُه وأدواتُه. */
const ENGINE = ["src/features/approval/", "tests/features/approval/", "tools/"]
/** طبقةُ العرض: إسقاطٌ للقدرات لا قرار (يحرسها G20) — ومعها المشتقُّ الذهبيّ. */
const PROJECTION = ["src/ui/", "src/authorization/", "tests/ui/", "tests/screens/", "tests/generated/"]

const ROUTING_PATTERNS = [
  [/\bapproverLayer\w*/i, "فحصُ «من يعتمد؟» خارج المحرّك (توجيهُ NESSA)"],
  [/\bapproverFor\b/i, "فحصُ «من يعتمد؟» خارج المحرّك"],
  [/\bnearestApprover\w*/i, "فحصُ «من يعتمد؟» خارج المحرّك"],
  [/\bbreakGlass\w*/i, "كسرُ الزجاج خارج المحرّك (ق-٣)"],
  [/\bnessa\b/i, "منطقُ NESSA خارج المحرّك"],
  [/\bsupervisor(?:y)?Layers?\b/i, "قائمةُ طبقاتٍ إشرافية (ث-٣: سقطت في v2)"],
]

const STATE_PATTERNS = [
  [/\bApprovalRequest\b|\bApprovalState\b|\bApprovalRoute\b|\bapprovalState\b/, "حالةُ اعتمادٍ تُدار خارج المحرّك"],
  [/\bsubmitForApproval\b|\bapproveRequest\b|\brejectRequest\b|\bretractSubmission\b|\boverrideApprove\b|\bamendLocked\b/, "فعلُ اعتمادٍ يُنفَّذ خارج المحرّك"],
  [/\blayer_approved\b|\bamir_approved\b/, "حالةُ اعتمادٍ من v1 تُبعث خارج المحرّك (ق-٥)"],
]

/** قدراتُ سلسلة الاعتماد — استهلاكُها قرارٌ، وموطنُ القرار المحرّك. */
const APPROVAL_CAPS = [
  "report.approve",
  "report.approve.override",
  "approve.breakGlass",
  "report.retract",
  "box.closing.submit",
  "box.closing.approve",
]

const violations = []
let scanned = 0

for (const file of [...walk(join(ROOT, "src")), ...walk(join(ROOT, "tests"))]) {
  const r = rel(file)
  if (ENGINE.some((p) => r.startsWith(p))) continue
  const inProjection = PROJECTION.some((p) => r.startsWith(p)) || /\/screens\//.test(r)
  scanned += 1
  const source = read(file)

  // ١ و٢ — المفردات: تُقاس على **الكود** بعد تجريد التعليقات والسلاسل، فالتوثيقُ لا يُدان.
  const code = stripCommentsAndStrings(source)
  code.split("\n").forEach((line, i) => {
    if (inProjection) return
    for (const [re, what] of [...ROUTING_PATTERNS, ...STATE_PATTERNS]) {
      if (re.test(line)) violations.push(`${r}:${i + 1} — ${what}`)
    }
  })

  // ٣ — القدرات: تعيش في سلاسل نصية، فتُقاس على المصدر بعد تجريد التعليقات وحدها.
  if (inProjection) continue
  const withStrings = stripCommentsOnly(source)
  withStrings.split("\n").forEach((line, i) => {
    for (const cap of APPROVAL_CAPS) {
      if (line.includes(`"${cap}"`)) {
        violations.push(`${r}:${i + 1} — استهلاكُ قدرةِ اعتمادٍ «${cap}» خارج المحرّك`)
      }
    }
  })
}

// وللبوابةِ موضوعٌ فعليّ: المحرّكُ موجودٌ وحالتُه تعيش فيه (وإلا فهي خضراءُ بلا حراسة).
const engineStore = join(ROOT, "src/features/approval/data/store.ts")
if (!existsSync(engineStore)) {
  violations.push("مجلدُ المحرّك غائب — لا معنى لبوابةٍ تحرس مكاناً لا وجود له")
}

if (violations.length) fail("G22", "لا منطق اعتماد خارج المحرك", violations)
pass("G22", "لا منطق اعتماد خارج المحرك", `${scanned} ملفاً مفحوصاً · المحرّك واحدٌ في موضعٍ واحد`)
