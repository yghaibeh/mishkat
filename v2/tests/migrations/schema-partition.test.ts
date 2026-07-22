/**
 * **تقسيمُ نقطة التسجيل** — T26-ب-٢أ (قب-٣٦ · `PARALLEL_WORK` §١/§٣-أ).
 *
 * ### لماذا وُجد هذا الملفّ
 * `TABLES` كانت **مصفوفةً واحدة** يُلحق بها كلُّ ناقلِ وحدة. وستُّ وحداتٍ تُنقل على التوازي
 * ⟵ **ستُّ كتلٍ في مصفوفةٍ واحدة** ⟵ ستةُ تعارضاتِ دمج. **وسجلُّنا صريح**: الدمجُ الآليّ
 * «أبقِ الاثنين» أخفق **ثلاث مرّات** (قب-٣٦) — كرّر ثابتاً، وبَتَر جسمَ كتلة، وضاعف استيراداً.
 * فصارت مساهمةُ الوحدة **ملفَّها + سطرين في المُجمِّع**، وهذا الملفُّ **يقيس السطرين**.
 *
 * ### وثلاثةُ حرّاسٍ لا واحد
 *  ١. **لقطةُ ما قبل التقسيم** — لا جدولَ سقط ولا عمودٌ تبدّل بفعل نقلِ نصٍّ بين ملفّات.
 *  ٢. **لا اسمَ مكرّر** — وهو **العطبُ الذي يُنشئه التقسيمُ نفسُه**: `BY_NAME` خريطةٌ،
 *     والمكرَّرُ فيها **يبتلع سابقَه صامتاً** بلا رمية ولا تحذير.
 *  ٣. **التسجيلُ سطران، والقائمةُ مشتقّةٌ من المجلد** لا مسرودةٌ هنا (CR-011/قب-٣٦).
 */

import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { TABLES } from "../../src/db/schema.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const AGGREGATOR = join(HERE, "../../src/db/schema.ts")
const MODULES_DIR = join(HERE, "../../src/db/schema")
const SNAPSHOT = join(HERE, "fixtures/schema-before-partition.json")

type SchemaSnapshot = readonly {
  readonly name: string
  readonly columns: readonly string[]
  readonly primaryKey: readonly string[]
  readonly appendOnly: boolean
  readonly infrastructure: boolean
}[]

/** بصمةُ جدولٍ اليوم بنفس صياغة اللقطة — فالمقارنةُ نصٌّ بنصّ لا كائنٌ بكائن. */
function fingerprint(name: string): SchemaSnapshot[number] | null {
  const spec = TABLES.find((t) => t.name === name)
  if (spec === undefined) return null
  return {
    name: spec.name,
    columns: spec.columns.map((c) => `${c.name}:${c.type}:${c.nullable ? "null" : "notnull"}`),
    primaryKey: [...spec.primaryKey],
    appendOnly: spec.appendOnly,
    infrastructure: spec.infrastructure,
  }
}

/**
 * وحداتُ المخطط **مشتقّةٌ من المجلد**: كلُّ ملفٍّ يُصدّر مصفوفةَ جداولَ فهو وحدةٌ مسجَّلة،
 * والذي لا يُصدّرها (ملفُّ البدائيّات) يُستبعد **بالاشتقاق لا بقائمةٍ تُسرد**.
 */
function schemaModules(): readonly { readonly file: string; readonly symbol: string }[] {
  const out: { file: string; symbol: string }[] = []
  for (const file of readdirSync(MODULES_DIR).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(MODULES_DIR, file), "utf8")
    const exported = /export const (\w+): readonly TableSpec\[\]/.exec(source)
    if (exported !== null) out.push({ file: file.replace(/\.ts$/, ""), symbol: exported[1]! })
  }
  return out
}

describe("لقطةُ ما قبل التقسيم — **لا جدولَ سقط ولا عمودٌ تبدّل**", () => {
  const before = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as SchemaSnapshot

  it("كلُّ جدولٍ كان قبل التقسيم باقٍ اليوم **بأعمدته بترتيبها** ومفتاحه ووسمَيه", () => {
    expect(before.length).toBeGreaterThan(0)
    for (const was of before) {
      // بصمةٌ كاملةٌ في توكيدٍ واحد ⟵ أوّلُ اختلافٍ يُطبع كاملاً لا حقلاً حقلاً.
      expect(`${was.name}: ${JSON.stringify(fingerprint(was.name))}`).toBe(
        `${was.name}: ${JSON.stringify(was)}`,
      )
    }
  })

  it("وعددُ الجداول والأعمدة لم ينقص — فلا جدولَ ذاب في النقل بين الملفّات", () => {
    const columnsBefore = before.reduce((n, t) => n + t.columns.length, 0)
    const columnsNow = TABLES.reduce((n, t) => n + t.columns.length, 0)
    expect(`جداول:${TABLES.length >= before.length} أعمدة:${columnsNow >= columnsBefore}`).toBe(
      "جداول:true أعمدة:true",
    )
  })

  /**
   * **احتواءٌ لا تساوٍ — وهذا قرارٌ لا تهاون**: اللقطةُ **أرضيةٌ** تُثبت أن هذه المهمة لم
   * تُسقط شيئاً، وليست **مصفوفةً موازية** تُحدَّث مع كل وحدةٍ تُنقل. ولو جعلتُها تساوياً
   * لوجب على **كلٍّ من الستّ** تحريرَ هذا الملفّ — وهو عينُ التعارض السداسيّ الذي جاءت هذه
   * المهمةُ لتمنعه. *والزيادةُ محروسةٌ في موضعها*: «كلُّ جدولٍ يملكه مستودعٌ معلن»
   * في `schema.test.ts`، ومطابقةُ المطبَّق بالـ`PRAGMA` في الاتجاهين.
   */
  it("واللقطةُ **أرضيةٌ لا سقف**: جدولٌ يُضاف بعدها لا يُفشلها — وإلا حرّرها كلُّ وحدة", () => {
    const known = new Set(before.map((t) => t.name))
    const added = TABLES.filter((t) => !known.has(t.name))
    // اليومَ صفرٌ (هذه المهمةُ لا تنقل وحدة)، وغداً ليس صفراً — والتوكيدُ يصمد في الحالين.
    expect(added.every((t) => typeof t.name === "string" && t.columns.length > 0)).toBe(true)
  })
})

describe("لا اسمَ جدولٍ مكرّر — **العطبُ الذي يُنشئه التقسيمُ نفسُه**", () => {
  it("`BY_NAME` خريطةٌ تبتلع المكرَّر صامتاً — فالتكرارُ يُمسك هنا أو لا يُمسك أبداً", () => {
    const names = TABLES.map((t) => t.name)
    const duplicated = names.filter((n, i) => names.indexOf(n) !== i)
    expect(duplicated).toEqual([])
    expect(new Set(names).size).toBe(TABLES.length)
  })
})

describe("التسجيلُ **سطران**، والقائمةُ مشتقّةٌ من المجلد (CR-011/قب-٣٦)", () => {
  const source = readFileSync(AGGREGATOR, "utf8")
  const modules = schemaModules()

  it("مجلدُ المخطط فيه وحداتٌ تُصدّر جداولها — وإلا فالتقسيمُ لم يقع أصلاً", () => {
    expect(modules.length).toBeGreaterThan(0)
  })

  it("**سطرُ استيرادٍ واحدٌ ومدخلُ نشرٍ واحد** لكلِّ وحدة — لا أكثر ولا أقلّ", () => {
    for (const { file, symbol } of modules) {
      const imports = source.match(
        new RegExp(`^import \\{ ${symbol} \\} from "\\./schema/${file}\\.js"$`, "gm"),
      )
      const spreads = source.match(new RegExp(`^\\s*\\.\\.\\.${symbol},$`, "gm"))
      expect(`${file}: استيراد=${imports?.length ?? 0} نشر=${spreads?.length ?? 0}`).toBe(
        `${file}: استيراد=1 نشر=1`,
      )
    }
  })

  it("ولا استيرادَ من مجلد المخطط **خارج** الوحدات المشتقّة — فلا مساهمةٌ لا تُرى", () => {
    const imported = [...source.matchAll(/^import \{ (\w+) \} from "\.\/schema\/(\w+)\.js"$/gm)]
    // ملفُّ البدائيّات يُستورَد بأنواعه ودوالِّه، فيُستثنى بأنه **لا يُصدّر جداول** لا بسرد اسمه.
    const tableImports = imported.filter((m) => /_TABLES$/.test(m[1]!))
    expect(tableImports.map((m) => m[2]!).sort()).toEqual(modules.map((m) => m.file).sort())
  })

  it("**والمُجمِّعُ لا يُعرّف جدولاً بنفسه** — وإلا عاد الملفُّ المشترك موضعَ تعارض", () => {
    const body = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(body.includes('name: "')).toBe(false)
  })

  it("وكلُّ جدولٍ في ملفّات الوحدات يبلغ `TABLES` — لا جدولٌ يُعرَّف ولا يُسجَّل", () => {
    let declared = 0
    for (const { file } of modules) {
      const body = readFileSync(join(MODULES_DIR, `${file}.ts`), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
      declared += (body.match(/^\s*name: "/gm) ?? []).length
    }
    expect(`مُعرَّف:${declared} مُسجَّل:${TABLES.length}`).toBe(
      `مُعرَّف:${TABLES.length} مُسجَّل:${TABLES.length}`,
    )
  })
})
