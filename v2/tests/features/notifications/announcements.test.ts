/**
 * ح-٥ — **قائمةُ الإعلانات مفلترةٌ بالنطاق** (عقدُ الوحدة §٥).
 *
 * ثغرةُ v1 كانت **انفصامَ الكتابة عن القراءة**: الإنشاءُ منطاقٌ والقراءةُ مفتوحة — كلُّ
 * مسجَّلٍ يرى آخرَ الإعلانات أياً كان نطاقُها. فالحارسُ هنا يقيس **الطبقتين**: لا يظهر
 * في القائمة، **ولا يُقرأ باستدعاءٍ مباشر** — فالترشيحُ ليس إخفاءَ صفّ (المادة ٤/٦).
 */
import { describe, it, expect } from "vitest"
import {
  myAnnouncements,
  openAnnouncement,
  publishAnnouncement,
} from "../../../src/features/notifications/services/announcements.js"
import { notificationContext, seedNotificationStore } from "./_seed.js"

function announcementInput(over: Record<string, unknown> = {}) {
  return {
    unitId: "sq2",
    titleAr: "اجتماعُ أمراء المربع الثاني",
    bodyAr: "الاجتماعُ يوم الخميس بعد العشاء في مسجد خالد",
    audience: "subtree" as const,
    ...over,
  }
}

function seedWithAnnouncements() {
  const store = seedNotificationStore()
  const square = notificationContext("u-square")
  const otherSquare = notificationContext("u-admin")

  const mine = publishAnnouncement(store, square, announcementInput())
  if (!mine.ok) throw new Error(mine.error.code)
  // إعلانُ نطاقٍ آخر تماماً — مربعٌ لا يمسّه سكانُ المربع الثاني.
  const foreign = publishAnnouncement(
    store,
    otherSquare,
    announcementInput({ unitId: "sq7", titleAr: "شأنُ المربع السابع" }),
  )
  if (!foreign.ok) throw new Error(foreign.error.code)
  return { store, mineId: mine.value.id, foreignId: foreign.value.id }
}

describe("ح-٥ — الإعلانُ يُقرأ بالنطاق: لا يظهر ولا يُقرأ", () => {
  it("**مَن في نطاق الإعلان يراه، ومَن خارجه لا يراه** — والقائمةُ مفلترةٌ عند المصدر", () => {
    const { store, mineId } = seedWithAnnouncements()

    for (const personId of ["u-square", "u-amir", "u-teacher"]) {
      const seen = myAnnouncements(store, notificationContext(personId)).map((a) => a.id)
      expect(seen, personId).toContain(mineId)
    }
    for (const personId of ["u-amir-omar", "u-media"]) {
      const seen = myAnnouncements(store, notificationContext(personId)).map((a) => a.id)
      expect(seen, personId).not.toContain(mineId)
    }
  })

  it("**وإعلانُ نطاقٍ آخر لا يُقرأ باستدعاءٍ مباشر** — الترشيحُ ليس إخفاءَ صفّ", () => {
    const { store, foreignId } = seedWithAnnouncements()
    const outsider = notificationContext("u-amir")

    expect(myAnnouncements(store, outsider).map((a) => a.id)).not.toContain(foreignId)
    const direct = openAnnouncement(store, outsider, { announcementId: foreignId })
    expect(direct.ok).toBe(false)
    if (!direct.ok) expect(direct.error.code).toBe("OUT_OF_ANNOUNCEMENT_AUDIENCE")
  })

  it("ومن هو في الجمهور يفتحُه فعلاً — فالحارسُ يمنع الغريبَ ولا يقفل البابَ على أهله", () => {
    const { store, mineId } = seedWithAnnouncements()
    const inside = openAnnouncement(store, notificationContext("u-amir"), { announcementId: mineId })
    expect(inside.ok).toBe(true)
    if (inside.ok) expect(inside.value.id).toBe(mineId)
  })

  it("**والنزولُ لا الصعود** (ق-١٧): إعلانُ المربع لا يظهر لمن فوقه — نطاقُه هو جمهورُه", () => {
    const { store, mineId } = seedWithAnnouncements()
    for (const personId of ["u-rabita", "u-section-head"]) {
      expect(
        myAnnouncements(store, notificationContext(personId)).map((a) => a.id),
        personId,
      ).not.toContain(mineId)
    }
  })

  it("وإعلانٌ مجهولٌ ⇒ `ANNOUNCEMENT_NOT_FOUND` — سببٌ يفرّقه عن «خارج الجمهور»", () => {
    const { store } = seedWithAnnouncements()
    const r = openAnnouncement(store, notificationContext("u-amir"), { announcementId: "لا-إعلان" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("ANNOUNCEMENT_NOT_FOUND")
  })
})

describe("الجمهورُ شكلُ نطاقٍ لا قائمةُ أدوار", () => {
  it("جمهورُ «الوحدةِ بعينها» يصل المكلَّفَ عندها ولا ينزل إلى ما تحتها", () => {
    const store = seedNotificationStore()
    const published = publishAnnouncement(
      store,
      notificationContext("u-square"),
      announcementInput({ audience: "unit", titleAr: "تنبيهٌ لمسؤولي المربع وحدهم" }),
    )
    if (!published.ok) throw new Error(published.error.code)

    expect(myAnnouncements(store, notificationContext("u-square")).map((a) => a.id)).toContain(
      published.value.id,
    )
    expect(myAnnouncements(store, notificationContext("u-amir")).map((a) => a.id)).not.toContain(
      published.value.id,
    )
    expect(
      openAnnouncement(store, notificationContext("u-amir"), { announcementId: published.value.id }).ok,
    ).toBe(false)
  })
})

describe("النشرُ: نطاقٌ من الوحدة المخزَّنة، وناشرٌ من الجلسة", () => {
  it("النطاقُ **مشتقٌّ من الوحدة المخزَّنة** لا من مدخل العميل، والناشرُ من الجلسة", () => {
    const store = seedNotificationStore()
    const r = publishAnnouncement(store, notificationContext("u-square"), {
      ...announcementInput(),
      // دعوى ناشرٍ في المدخل: **لا تُصدَّق** — الفاعلُ من الجلسة وحده.
      publisherPersonId: "u-admin",
      scopePath: "/",
    } as never)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.publisherPersonId).toBe("u-square")
    expect(r.value.scopePath).toBe("/men/homs/sq2/")
  })

  it("ووحدةٌ مجهولةٌ ⇒ `UNKNOWN_ANNOUNCEMENT_UNIT` — دفاعٌ في العمق خلف نطاق الخادم", () => {
    const store = seedNotificationStore()
    const r = publishAnnouncement(
      store,
      notificationContext("u-square"),
      announcementInput({ unitId: "لا-وحدة" }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_ANNOUNCEMENT_UNIT")
  })

  it("وإعلانٌ بلا عنوانٍ أو بلا نصٍّ ⇒ `EMPTY_ANNOUNCEMENT` — لا إعلانَ بلا معنى", () => {
    const store = seedNotificationStore()
    for (const over of [{ titleAr: "  " }, { bodyAr: "" }]) {
      const r = publishAnnouncement(store, notificationContext("u-square"), announcementInput(over))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("EMPTY_ANNOUNCEMENT")
    }
  })

  it("والترتيبُ حتميّ: الأحدثُ أولاً وفاصلُ التعادل بالمعرّف (TESTING_POLICY §٥)", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-square")
    for (const titleAr of ["أوّل", "ثانٍ", "ثالث"]) {
      const r = publishAnnouncement(store, ctx, announcementInput({ titleAr }))
      if (!r.ok) throw new Error(r.error.code)
    }
    const listed = myAnnouncements(store, ctx)
    expect(listed.map((a) => a.titleAr)).toEqual(["ثالث", "ثانٍ", "أوّل"])
  })
})
