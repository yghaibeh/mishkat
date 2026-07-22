/**
 * **الاختبارُ الإلزاميُّ الأول** (T21) — «المستهدَفون من المحرّك»: فحصٌ **بنيويٌّ يُقاس
 * بالمحتوى** يثبت **صفر قائمة أدوار** و**صفر استعلامٍ موازٍ** (G6، عقدُ الوحدة §٢ و§١١).
 *
 * **الدرسُ المطبَّق** (قب-٤٠): *دعوى بنيوية تُقاس بالمحتوى؛ وقياسُها بالسلوك يُنتج حارساً
 * يمرّ على البذرة ويفوته الواقع.* فلا يكفي أن تنجح اختباراتُ ق-١١/ق-٢٥ سلوكياً: لو أضاف
 * أحدٌ غداً فلترَ أدوارٍ **بجانب** المحرّك لبقيت تلك خضراء — وهذا الملفُّ هو ما يحمرّ.
 *
 * ويحرس معه ثلاثةَ نفيٍ أخرى أعلنها العقد: **لا مُجدوِل** (بند المهمة ٧) · **لا منطقَ
 * اعتماد** (G22) · **لا قائمةَ قنواتٍ مسرودةٍ** بجانب سجل الإعدادات (CR-011/قب-٣٦).
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { ROLE_IDS } from "../../../src/authorization/generated/roles.generated.js"
import { SETTINGS_BY_ID } from "../../../src/settings/registry.js"
import { CHANNEL_IDS } from "../../../src/features/notifications/services/channels.js"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/notifications", import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

function within(path: string): string {
  return relative(UNIT_DIR, path).split(sep).join("/")
}

/** يُجرَّد التعليقُ كي لا يُدان التوثيقُ بما يشرحه (نفسُ منهج البوابات). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

const FILES = sourceFiles(UNIT_DIR)

/**
 * **الاستثناءُ الوحيد المُعلَن**: `screens/screens.ts` يحمل `lenses` — وهو **إعلانُ عقدٍ**
 * يفرضه `ScreenContract` وتحاكمه G20 إلى المصفوفة الذهبية، لا **فحصُ دورٍ في منطق**. وحدُّ
 * الفرق مقيسٌ لا مزاجيّ: العدساتُ **بيانٌ في عقدٍ يُقرأ من الخارج**، والممنوعُ أن يُبنى على
 * اسم دورٍ **قرارٌ** — ولذلك يشمل الفحصُ كلَّ ما عداه بلا استثناء.
 */
const LENS_DECLARATION = "screens/screens.ts"

describe("الاختبارُ الإلزاميُّ الأول — صفر قائمةِ أدوارٍ وصفر استعلامٍ موازٍ", () => {
  it("**لا معرّفَ دورٍ واحدٍ** من المصفوفة الذهبية في منطق الوحدة كلِّه (G6)", () => {
    const found: string[] = []
    for (const file of FILES.filter((f) => within(f) !== LENS_DECLARATION)) {
      const src = code(file)
      for (const role of ROLE_IDS) {
        // بحدٍّ: `media` لا يُرضيه `mediaHub` — وإلا لَغطّى اسمُ دورٍ اسمَ شيءٍ آخر فمرّ.
        if (new RegExp(`(?<![\\w.])${role}(?![\\w.])`).test(src)) {
          found.push(`${within(file)} — «${role}»`)
        }
      }
    }
    expect(found, `قائمةُ أدوارٍ تسلّلت: ${found.join(" · ")}`).toEqual([])
  })

  it("**والاستثناءُ محصورٌ في `lenses` نفسِها**: لا اسمَ دورٍ في سطرٍ آخر من ملف الشاشات", () => {
    // تُزال كتلُ `lenses: [...]` وحدَها، فيبقى ما عداها تحت الفحص نفسِه.
    const rest = code(join(UNIT_DIR, LENS_DECLARATION)).replace(/lenses:\s*\[[\s\S]*?\]/g, "")
    const leaked = ROLE_IDS.filter((role) => new RegExp(`(?<![\\w.])${role}(?![\\w.])`).test(rest))
    expect(leaked).toEqual([])
  })

  it("**ومصدرُ المستهدَفين واحدٌ**: `can()` لا يُستدعى إلا في `targeting.ts` وقشرةِ القدرات", () => {
    const callers = FILES.filter((f) => /(?<![\w.])can\s*\(/.test(code(f))).map(within)
    expect(callers.sort()).toEqual(["screens/caps.ts", "services/targeting.ts"])
  })

  /**
   * **الحارسُ قُوّي بعد أن مرّ على كسرٍ مزروع**: أوّلُ صياغةٍ حرست `personMap`/`persons` بحرفها،
   * فزرعتُ `personsIndex` **فمرّت خضراء** — وهو عينُ درس قب-٤٠ («دعوى بنيوية تُقاس بالمحتوى،
   * وقياسٌ ضيّقٌ يُنتج حارساً يمرّ على البذرة ويفوته الواقع»). فصار القياسُ على **أيّ مفردةِ
   * أشخاصٍ** عدا `personId` الذي هو **مالكُ الإشعار** لا استعلامٌ عن الناس.
   */
  it("**وصفر استعلامٍ موازٍ**: مستودعُ الوحدة بلا أشخاصٍ ولا إسناداتٍ ولا أدوار", () => {
    const store = code(join(UNIT_DIR, "data/store.ts"))
    const FORBIDDEN: readonly RegExp[] = [
      /\bperson(?!Id\b)\w*/i,
      /\bpeople\b/i,
      /\bactor\w*/i,
      /assignment/i,
      /\brole\b/i,
    ]
    for (const forbidden of FORBIDDEN) {
      expect(forbidden.test(store), `${forbidden} في مستودع الوحدة`).toBe(false)
    }
  })

  it("**والمرشَّحون يصلون بمنفذٍ معلنٍ محقون** لا باستيراد وحدةٍ أخرى (قب-٣١)", () => {
    const foreign: string[] = []
    for (const file of FILES) {
      for (const m of code(file).matchAll(/from\s+"([^"]+)"/g)) {
        const spec = m[1] ?? ""
        if (/features\//.test(spec) && !/features\/notifications/.test(spec)) {
          foreign.push(`${within(file)} ⟵ ${spec}`)
        }
      }
    }
    expect(foreign).toEqual([])

    const ports = code(join(UNIT_DIR, "services/ports.ts"))
    expect(ports).toMatch(/assignedAt/)
    expect(ports).toMatch(/assignmentScopesOf/)
  })
})

describe("لا مُجدوِلَ يُبنى (بند المهمة ٧) — الوحدةُ مستقبِلةٌ لا مولِّدة", () => {
  it("**صفر مؤقّتٍ وصفر دورةٍ زمنية وصفر ساعةٍ داخلية** — الساعةُ تُحقن (TESTING_POLICY §٥)", () => {
    const found: string[] = []
    const FORBIDDEN: readonly [RegExp, string][] = [
      [/\bsetTimeout\b/, "مؤقّت"],
      [/\bsetInterval\b/, "دورةٌ زمنية"],
      [/\bcron\b/i, "مُجدوِل"],
      [/\bschedule\w*\b/i, "جدولةٌ زمنية"],
      [/\bDate\s*\.\s*now\s*\(/, "ساعةٌ داخلية"],
      [/new\s+Date\s*\(\s*\)/, "ساعةٌ داخلية"],
    ]
    for (const file of FILES) {
      const src = code(file)
      for (const [re, what] of FORBIDDEN) {
        if (re.test(src)) found.push(`${within(file)} — ${what}`)
      }
    }
    expect(found).toEqual([])
  })

  it("**والبابُ الوحيدُ للدخول واجهةٌ معلنة**: `NotificationIntake` مُصدَّرةٌ من `intake.ts`", () => {
    const intake = code(join(UNIT_DIR, "services/intake.ts"))
    expect(intake).toMatch(/export type NotificationIntake\s*=/)
    expect(intake).toMatch(/export function makeIntake\s*\(/)
  })
})

describe("لا منطقَ اعتماد (G22) ولا قدرةَ عرضٍ مخترعة (ك-٣٥)", () => {
  it("**لا اسمَ قدرةِ بتٍّ ولا مفردةَ توجيهٍ** في مصدر الوحدة — الأقربيّةُ تصل بياناً", () => {
    const found: string[] = []
    const FORBIDDEN: readonly RegExp[] = [
      /\bapprov\w*Layer\w*/i,
      /\bnearest\w*/i,
      /\bnessa\b/i,
      /"[\w.]*\.approve(?:\.\w+)?"/,
      /"[\w.]*\.retract"/,
    ]
    for (const file of FILES) {
      const src = code(file)
      for (const re of FORBIDDEN) if (re.test(src)) found.push(`${within(file)} — ${re}`)
    }
    expect(found).toEqual([])
  })

  it("**والقدراتُ المستهلَكةُ اثنتان لا ثالثة** (عقدُ الوحدة §٧)", () => {
    const consumed = new Set<string>()
    for (const file of FILES) {
      for (const m of code(file).matchAll(/"((?:account|announcement|notification)\.[\w.]+)"/g)) {
        consumed.add(m[1] ?? "")
      }
    }
    expect([...consumed].sort()).toEqual(["account.self", "announcement.publish"])
  })
})

describe("القائمةُ تُشتقّ ولا تُسرد (CR-011/قب-٣٦)", () => {
  it("**اتحادُ القنوات في الكود مطابقٌ لِما في سجل الإعدادات** — فلا يتباعد مصدران", () => {
    const registered = SETTINGS_BY_ID.get("notify.channels.enabled")?.allowed
    expect(registered).toBeDefined()
    expect([...CHANNEL_IDS].sort()).toEqual([...(registered ?? [])].sort())
  })

  it("ولا قائمةَ قنواتٍ ثانيةً مسرودةٌ في خدمات الوحدة خارج موضع الاشتقاق", () => {
    const declarers = FILES.filter((f) => /CHANNEL_IDS\s*[:=]/.test(code(f))).map(within)
    expect(declarers).toEqual(["services/channels.ts"])
  })
})
