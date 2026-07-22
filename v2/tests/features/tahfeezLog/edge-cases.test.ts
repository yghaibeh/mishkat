/**
 * حوافُّ الوحدة — **الفروعُ الدفاعية تُختبر لا تُفترض** (TESTING_POLICY §٣: التغطيةُ شرطٌ
 * لازمٌ غير كافٍ، والمراجعةُ تفحص **جودةَ التوكيدات**).
 *
 * وكلُّ حالةٍ هنا **سؤالٌ حقيقيّ**: ماذا يفعل النظامُ حين يفسد المدخلُ أو يختفي المرجع؟
 * فالجوابُ المعلَن خيرٌ من الانهيار الصامت (المادة ٣/٤).
 */
import { describe, it, expect } from "vitest"
import { TahfeezLogStore } from "../../../src/features/tahfeezLog/data/store.js"
import {
  settingBoolean,
  settingNumber,
  settingText,
} from "../../../src/features/tahfeezLog/services/context.js"
import { recitationRefAr, validateRecitation } from "../../../src/features/tahfeezLog/services/mushaf.js"
import { notesForTeacher } from "../../../src/features/tahfeezLog/services/notes.js"
import {
  issueLink,
  linksOfCircle,
  renewLink,
  revokeLink,
} from "../../../src/features/tahfeezLog/services/guardian.js"
import { studentRecordView } from "../../../src/features/tahfeezLog/services/derive.js"
import { recordSession } from "../../../src/features/tahfeezLog/services/sessions.js"
import { logContext, NOW, SEEDED_SURAHS, seedLogStore, seedWorld } from "./_seed.js"

describe("طبقةُ البيانات — **الإلحاقُ لا الاستبدال**، والكتالوجُ يُقرأ كاملاً", () => {
  it("كتالوجُ السور يُعاد كاملاً من المستودع — **بياناتٌ لا قائمةٌ في الكود** (ق-٨٩)", () => {
    const store = seedLogStore()
    expect(store.surahs().map((s) => s.id)).toEqual(SEEDED_SURAHS.map((s) => s.id))
  })

  it("**وملاحظةٌ بمعرّفٍ مكرَّرٍ رميةٌ برمجية** — السجلُّ إلحاقٌ لا كتابةٌ فوق سابقه (ق-٨٧)", () => {
    const store = new TahfeezLogStore("t-main")
    const note = {
      tenantId: "t-main",
      id: "note-1",
      circleId: "circle-1",
      bodyAr: "ملاحظة",
      authorPersonId: "u-square",
      writtenAt: NOW,
    }
    store.appendNote(note)
    expect(() => store.appendNote(note)).toThrow(/مكرَّرة/)
  })
})

describe("قراءةُ الإعدادات — **النوعُ الخاطئ حالةٌ برمجيةٌ تُلقى** لا خطأُ عملٍ صامت", () => {
  const ctx = (value: unknown) =>
    ({
      now: NOW,
      actorPersonId: "u-amir",
      settings: () => value as never,
      circles: {} as never,
      newToken: () => "t",
    }) as never

  it("إعدادٌ رقميٌّ يعود نصاً ⇒ رمية", () => {
    expect(() => settingNumber(ctx("نص"), "edu.grade.max", "/")).toThrow(TypeError)
  })
  it("ومفتاحٌ يعود رقماً ⇒ رمية", () => {
    expect(() => settingBoolean(ctx(1), "edu.guardian_token.renewable", "/")).toThrow(TypeError)
  })
  it("ونصٌّ يعود مفتاحاً ⇒ رمية", () => {
    expect(() => settingText(ctx(true), "time.zone", "/")).toThrow(TypeError)
  })
})

describe("ق-٨٩ — حوافُّ المدى: **الكسريُّ ليس آية**، والمرجعُ المجهولُ لا يُلفَّق له اسم", () => {
  it("آيةٌ كسريّةٌ ⇒ مرفوضة (الترقيمُ أعدادٌ صحيحة)", () => {
    const store = seedLogStore()
    const done = validateRecitation(store, {
      mode: "surah",
      surahId: "001",
      fromAyah: 1.5,
      toAyah: 3,
    })
    expect(!done.ok && done.error.code).toBe("AYAH_OUT_OF_RANGE")
  })

  it("وصفحةٌ كسريّةٌ ⇒ مرفوضة كذلك — **حدٌّ واحدٌ للوجهين**", () => {
    const store = seedLogStore()
    const done = validateRecitation(store, {
      mode: "pages",
      mushafId: "hafs",
      fromPage: 1,
      toPage: 2.5,
    })
    expect(!done.ok && done.error.code).toBe("PAGE_OUT_OF_RANGE")
  })

  it("**واسمُ مرجعٍ مجهولٍ يبقى فارغاً ولا يُلفَّق** (ق-١١٢: لا اسمَ مصنوعٌ في الكود)", () => {
    const store = seedLogStore()
    expect(recitationRefAr(store, null)).toBe("")
    expect(recitationRefAr(store, { mode: "surah", surahId: "لا-سورة", fromAyah: 1, toAyah: 2 })).toBe("")
    expect(recitationRefAr(store, { mode: "pages", mushafId: "لا-مصحف", fromPage: 1, toPage: 2 })).toBe("")
  })
})

describe("حوافُّ المراجع الغائبة — **الغيابُ يُقفل ولا يُفتح**", () => {
  it("ملاحظاتُ حلقةٍ مجهولةٍ للمعلّم ⇒ قائمةٌ فارغةٌ لا رمية", () => {
    const world = seedWorld()
    expect(notesForTeacher(world.log, logContext(world, "u-teacher-mosque"), "لا-حلقة")).toEqual([])
  })

  it("**ورابطٌ لحلقةٍ اختفت من النموذج ⇒ تجديدُه مرفوضٌ بسببٍ مصنَّف** (لا انهيارَ صامت)", () => {
    const world = seedWorld()
    world.log.saveLink({
      tenantId: "t-main",
      id: "glink-يتيم",
      token: "tok-يتيم",
      enrollmentId: world.studentA,
      circleId: "حلقةٌ اختفت",
      issuedAt: NOW,
      expiresAt: new Date("2027-07-22T09:00:00.000Z"),
      revokedAt: null,
    })
    const ctx = logContext(world, "u-amir")
    const done = renewLink(world.log, ctx, { linkId: "glink-يتيم" })
    expect(!done.ok && done.error.code).toBe("UNKNOWN_CIRCLE")
    // …والإلغاءُ يبقى ممكناً: وسمُ إنهاءٍ لا يحتاج مرجعَ الحلقة (المادة ٧/٤).
    expect(revokeLink(world.log, ctx, { linkId: "glink-يتيم" }).ok).toBe(true)
    expect(linksOfCircle(world.log, ctx, "حلقةٌ اختفت")[0]?.revoked).toBe(true)
  })

  it("**وقائمةُ الروابط مرتّبةٌ حتمياً** بمعرّفها — لا يختلف الترتيبُ بين تشغيلين", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    for (const enrollmentId of [world.studentB, world.studentA]) {
      const done = issueLink(world.log, ctx, { circleId: world.circleId, enrollmentId })
      expect(done.ok).toBe(true)
    }
    const rows = linksOfCircle(world.log, ctx, world.circleId)
    expect(rows.map((r) => r.id)).toEqual([...rows.map((r) => r.id)].sort())
    expect(rows).toHaveLength(2)
  })

  it("**وجلسةٌ لا تذكر الطالبَ لا تُحسب في سجلّه** — سجلُّ كلٍّ سجلُّه (ق-٩٣)", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentB, attendance: "present" }],
    })
    const a = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(a.ok && a.value.sessions).toBe(0)
    const b = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentB,
    })
    expect(b.ok && b.value.sessions).toBe(1)
  })
})
