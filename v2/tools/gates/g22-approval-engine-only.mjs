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

/**
 * قدراتُ سلسلة الاعتماد — **تُشتقّ ولا تُسرد** (CR-011/قب-٣٦، المادة ١/٢).
 *
 * كانت قائمةً بيدِ إنسان، فوُلد كلُّ نوعِ اعتمادٍ جديدٍ **خارج حراستها** حتى يتذكّر أحدٌ
 * تحديثَها (`visit.approve` مثالاً حياً — رفعه وكيلُ T11). والعلاجُ هو العلاجُ نفسُه في كل
 * مرّة: مصدرُ الحقيقة واحد، والباقي مشتقٌّ منه آلياً.
 *
 * **والمصدرُ هو المحرّكُ نفسُه، من رافدين لا ثالثَ لهما:**
 *  أ) **أنواعُ الاعتماد المسجَّلة**: `approveCapability` و`overrideCapability`
 *     و`retractCapability` من كل `defineApprovalType({…})` في الشجرة — أي **قدراتُ البتّ**.
 *  ب) **قدرتا المخرجين المحكومين** المعلنتان ثابتَين في `services/routing.ts`
 *     (`approve.breakGlass` — ق-٣ · `records.editLocked` — ق-٨): لا نوعَ يعلنهما لأنهما
 *     عابرتان للأنواع كلِّها، وموطنُ إعلانهما المحرّك فيُقرآن منه لا من سردٍ ثانٍ.
 *
 * **ولا تُؤخذ `submitCapability`**: التقديمُ فعلُ صاحب العمل في عمل **نفسِه** لا بتٌّ في عمل
 * غيره (ق-٩)، وقدرتُه قدرةُ وحدته أصلاً (`visit.conduct` تُنفّذ الزيارة · `report.submit`
 * يقدّم تقرير الوحدة) — فحظرُها على وحدتها يمنعُها من عملها لا من الاعتماد. وهذا **يصحّح
 * انحرافاً في القائمة اليدوية** نفسِها: كانت تحرس `box.closing.submit` ولا تحرس `report.submit`
 * وكلتاهما قدرةُ تقديم.
 *
 * **وتُستبعد القدرةُ الشخصية**: الاعتمادُ **عملُ مَن تحت** (ق-١)، والقدرةُ الشخصية فعلٌ على
 * كيان النفس (`committee.own` بابُ تقديم لجنته وسحبِه) — فلا تكون قدرةَ بتٍّ بحال، وحظرُها
 * على وحدتها يقفل «لجنتي» كلَّها.
 *
 * **ولا تخضرّ عند الغموض**: تعذُّرُ قراءة السجل أو المصفوفة، أو حقلُ قدرةٍ لا يُقرأ نصّاً،
 * أو اشتقاقٌ خاوٍ ⇒ **تفشل البوابة** — فالبوابةُ التي تعتمد على ما تحرسه تُثبت أولاً أنها قرأته.
 */
function deriveApprovalCaps() {
  const problems = []

  // أ) أنواعُ الاعتماد المسجَّلة — تُقرأ من **نداءات التسجيل** حيثما كانت في الشجرة.
  const registrations = []
  for (const file of walk(join(ROOT, "src"))) {
    const source = stripCommentsOnly(read(file))
    for (const m of source.matchAll(/defineApprovalType\(\{([\s\S]*?)\n\}\)/g)) {
      registrations.push({ file: rel(file), body: m[1] })
    }
  }
  if (registrations.length === 0) {
    problems.push("لم يُقرأ نوعُ اعتمادٍ واحدٌ من السجل — الاشتقاقُ أعمى فلا تخضرّ البوابة")
  }

  /** قدراتُ البتّ وحدَها (لا التقديم) — والحقلُ الغائبُ عن الإعلان خطأٌ يُعلن لا يُبتلع. */
  const DECISION_FIELDS = ["approveCapability", "overrideCapability", "retractCapability"]
  const derived = new Set()
  for (const reg of registrations) {
    const id = /\bid:\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))/.exec(reg.body)
    const name = id ? (id[1] ?? id[2]) : reg.file
    for (const field of DECISION_FIELDS) {
      const m = new RegExp(`\\b${field}:\\s*(?:"([^"]+)"|(null))`).exec(reg.body)
      if (m === null) {
        problems.push(`${reg.file}: النوع «${name}» لا يُقرأ منه \`${field}\` نصّاً`)
        continue
      }
      if (m[1] !== undefined) derived.add(m[1])
    }
  }

  // ب) قدرتا المخرجين المحكومين — من إعلان المحرّك نفسِه لا من سردٍ هنا.
  const routing = join(ROOT, "src/features/approval/services/routing.ts")
  const exits = existsSync(routing)
    ? [...stripCommentsOnly(read(routing)).matchAll(/:\s*CapId\s*=\s*"([^"]+)"/g)].map((m) => m[1])
    : []
  if (exits.length === 0) {
    problems.push("لم تُقرأ قدرةُ مخرجٍ محكومٍ واحدة من `services/routing.ts` — لا تخضرّ عند الغموض")
  }
  for (const cap of exits) derived.add(cap)

  // ج) التصفيةُ بالكتالوج: كلُّ قدرةٍ مشتقّةٍ موجودةٌ فيه، والشخصيةُ ليست قدرةَ بتّ.
  let matrix
  try {
    matrix = JSON.parse(read(join(ROOT, "src/authorization/matrix/authorization.matrix.json")))
  } catch (e) {
    problems.push(`تعذّرت قراءةُ الملف الذهبي فتعذّر التحقّق من الاشتقاق: ${String(e.message)}`)
  }
  const types = new Map((matrix?.capabilities ?? []).map((c) => [c.id, c.type]))
  const caps = []
  const personal = []
  for (const cap of [...derived].sort()) {
    const type = types.get(cap)
    if (type === undefined) {
      problems.push(`قدرةٌ مشتقّةٌ خارج الكتالوج: «${cap}» — عيبٌ في السجل أو في المصفوفة`)
      continue
    }
    if (type === "personal") personal.push(cap)
    else caps.push(cap)
  }
  if (caps.length === 0) problems.push("الاشتقاقُ خاوٍ — بوابةٌ بلا قائمةٍ تحرس ليست بوابة")

  return { caps, personal, typeCount: registrations.length, problems }
}

const { caps: APPROVAL_CAPS, personal: PERSONAL_SKIPPED, typeCount, problems } =
  deriveApprovalCaps()

// عطبُ الاشتقاق نفسُه مخالفةٌ تُعلن أولاً: **لا تخضرّ البوابةُ عند الغموض** (CR-011 §٣).
const violations = [...problems]
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
// القائمةُ تُطبع لتُقرأ: حراسةٌ لا يُرى مداها لا تُراجَع.
const skipped = PERSONAL_SKIPPED.length ? ` · شخصيةٌ مستبعدة: ${PERSONAL_SKIPPED.join("، ")}` : ""
pass(
  "G22",
  "لا منطق اعتماد خارج المحرك",
  `${scanned} ملفاً مفحوصاً · ${typeCount} نوعاً مسجَّلاً ⇐ ${APPROVAL_CAPS.length} قدرةَ بتٍّ مشتقّة: ${APPROVAL_CAPS.join("، ")}${skipped}`,
)
