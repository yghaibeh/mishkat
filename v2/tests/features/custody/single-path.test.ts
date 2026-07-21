/**
 * ب-٢٩ — **مسارٌ واحدٌ للحيازة، يُقاس بالمحتوى لا بالوعد** (نظيرُ حارس «صفر رصيدٍ مخزَّن»
 * في الصندوق، ق-٦٠).
 *
 * العطبُ في v1: **بابان لا يعرف أحدهما الآخر** (ز-٣) — لوحةُ المالية تكتب حائزاً بلا حدث.
 * وفي v2 لا يكفي أن نَعِد؛ **يمسح هذا الحارسُ مصدرَ الوحدة كلَّه** فيفشل عند:
 *  ١. أيّ حقلِ حائزٍ أو حالةٍ **مخزَّنٍ** في كيانات الوحدة أو مستودعها.
 *  ٢. أيّ دالةٍ **ثانيةٍ** تكتب في السلسلة غير `recordCustodyMove`.
 *  ٣. أيّ دالةِ حذفٍ في المستودع (ق-٨٠: لا محوَ لبيانات العُهد — المادة ٧/٤).
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { EDITABLE_ASSET_FIELDS } from "../../../src/features/custody/services/assets.js"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/custody", import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

/** مسارٌ نسبيٌّ داخل الوحدة بفواصل موحّدة — فالتوكيدُ يُقرأ ولا يتعلّق بمكان النسخة. */
function within(path: string): string {
  return relative(UNIT_DIR, path).split(sep).join("/")
}

/** يُجرَّد التعليقُ كي لا يُدان التوثيقُ بما يشرحه (نفسُ منهج البوابات). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

describe("ب-٢٩ — صفرُ حقلِ حائزٍ أو حالةٍ **مخزَّن** في كيانات الوحدة", () => {
  it("`types.ts` و`data/` بلا حقلِ حائزٍ ولا حالةٍ — فلا يوجد ما يُحرَّر أصلاً", () => {
    const stored = sourceFiles(UNIT_DIR).filter(
      (f) => within(f) === "types.ts" || within(f).startsWith("data/"),
    )
    expect(stored.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of stored) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          // تعريفُ حقلٍ في كيانٍ مخزَّن: `readonly holder…` أو `readonly status…`.
          if (/readonly\s+(holder\w*|status\w*|currentHolder\w*)\s*[?:]/.test(line)) {
            offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `حقلُ حيازةٍ مخزَّن: ${offenders.join(" · ")}`).toEqual([])
  })

  it("والقائمةُ البيضاء للتحرير **وصفيّةٌ بحتة** — لا حائزَ ولا حالةَ فيها", () => {
    expect([...EDITABLE_ASSET_FIELDS]).toEqual(["labelAr", "serialAr", "noteAr"])
    for (const field of EDITABLE_ASSET_FIELDS) {
      expect(/holder|status/i.test(field), field).toBe(false)
    }
  })
})

describe("ب-٢٩ — **كاتبُ السلسلة واحدٌ**، ولا دالةَ حذفٍ في الوحدة كلِّها", () => {
  it("`store.appendMove` تُستدعى من `services/chain.ts` وحدها — لا بابَ ثانياً", () => {
    const callers = sourceFiles(UNIT_DIR).filter((f) => /\.appendMove\s*\(/.test(code(f)))
    expect(callers.map(within)).toEqual(["services/chain.ts"])
  })

  it("وختمُ الإقرار كاتبُه واحدٌ كذلك (`store.stampReceipt`)", () => {
    const callers = sourceFiles(UNIT_DIR).filter((f) => /\.stampReceipt\s*\(/.test(code(f)))
    expect(callers.map(within)).toEqual(["services/chain.ts"])
  })

  it("**ولا دالةَ حذفٍ في مصدر الوحدة كلِّه** (ق-٨٠، المادة ٧/٤)", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/\b(delete|remove|purge|drop)[A-Z]\w*\s*\(/.test(line) || /\bdelete\s+\w+\./.test(line)) {
            offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `دالةُ حذفٍ في وحدة العُهد: ${offenders.join(" · ")}`).toEqual([])
  })

  it("ولا سطرَ منطقِ اعتمادٍ في الوحدة (G22 نظيراً — الإقرارُ بصمةٌ لا سلسلةُ بتّ)", () => {
    // المفرداتُ **سلاسلُ نصٍّ لا حرفيّاتِ تعبيرٍ نمطيّ**: فG22 تجرّد السلاسل قبل مسحها،
    // ولو كُتبت حرفيّةً لأدانت هذا الحارسَ نفسَه بما يحرسه (وهو ما أمسكته البوابةُ فعلاً).
    const FORBIDDEN = ["approve", "approver", "breakglass", "nessa"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of FORBIDDEN) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) offenders.push(within(file))
      }
    }
    expect(offenders).toEqual([])
  })
})
