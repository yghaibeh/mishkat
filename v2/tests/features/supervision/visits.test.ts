/**
 * ق-١٠٠/ق-١٦ — **النموذجُ مطبوعٌ بحقول النوع، والمرساةُ وحدةُ الزائر لا وحدةُ المَزور**
 * (عقدُ الوحدة §٢/§٣).
 *
 * الخطأُ الذي تقتله المطابقةُ تامّةُ الطرفين: نموذجٌ يُخزَّن بحقولٍ من نوعٍ آخر فيُقرأ فارغاً
 * في التقرير — «أدخلتُ ولم يظهر» (ع-١٢/ج-٥). وهنا **الخادمُ قاطع**: حقلٌ غريبٌ أو ناقصٌ يردّ
 * الزيارة كلَّها، فلا نصفَ نموذجٍ في المستودع.
 */
import { describe, it, expect } from "vitest"
import { recordVisit } from "../../../src/features/supervision/services/visits.js"
import {
  BASEERA_DETAILS,
  C1,
  C1_PATH,
  C2,
  CORE,
  C_RETIRED,
  NOW,
  SQ2_PATH,
  HOMS_PATH,
  TAHFEEZ_DETAILS,
  seedSupervisionStore,
  supervisionContext,
} from "./_seed.js"

describe("ق-١٠٠ — حقولُ النوع: تحفيظٌ بحقوله وعلى بصيرةٍ بحقولها", () => {
  it("زيارةُ تحفيظٍ بحقول التحفيظ تُقبل وتُخزَّن بنواتها وتفاصيلها", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.curriculum).toBe("tahfeez")
    expect(result.value.core.attendees).toBe(CORE.attendees)
    expect(result.value.details).toEqual(TAHFEEZ_DETAILS)
    expect(store.visits()).toHaveLength(1)
  })

  it("**زيارةُ تحفيظٍ بحقول «على بصيرة» ⇒ مرفوضة** — ولا تُخزَّن (الاختبار الرابع الإلزاميّ)", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: BASEERA_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("WRONG_FORM_FIELDS")
    expect(store.visits()).toHaveLength(0)
  })

  it("وزيارةُ «على بصيرة» بحقول التحفيظ مرفوضةٌ كذلك — القاعدةُ في الاتجاهين", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C2,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("WRONG_FORM_FIELDS")
  })

  it("**حقلٌ ناقصٌ يردّ النموذج** — لا نصفَ نموذجٍ يُخزَّن ثم يُقرأ فارغاً", () => {
    const store = seedSupervisionStore()
    const missingOne: Record<string, number> = { ...TAHFEEZ_DETAILS }
    delete missingOne["tajweed"]
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: missingOne,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("WRONG_FORM_FIELDS")
  })

  it("**وحقلٌ غريبٌ زائدٌ يردّه** — النموذجُ عقدٌ مغلقٌ لا سلّةُ حقول", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: { ...TAHFEEZ_DETAILS, secretScore: 5 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("WRONG_FORM_FIELDS")
  })
})

describe("ق-١٦ — المرساةُ: وحدةُ الزائر لا وحدةُ المَزور (منها تصعد السلسلة)", () => {
  it("**زيارةُ المربع مرساتُها مسارُ المربع** — لا مسارُ الحلقة ولا مسارُ المسجد", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.supervisorPath).toBe(SQ2_PATH)
    expect(result.value.targetPath).toBe(C1_PATH)
  })

  it("**وزيارةُ المنطقة مرساتُها المنطقة** — أعمقُ إسنادٍ للزائر يحتوي الهدف يغلب", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-rabita"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.supervisorPath).toBe(HOMS_PATH)
  })

  it("**زائرٌ بلا إسنادٍ يحتوي الهدف ⇒ مرفوض** — لا مرساةَ تُخترع", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square", { scopePaths: [] }), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("NO_SUPERVISION_SCOPE")
  })

  it("**ومشرفُ مربعٍ يزور خارج مربعه ⇒ مرفوض** (عزلُ النطاق — الاختبار الخامس)", () => {
    const store = seedSupervisionStore()
    // الهدفُ `c2` تحت المربع السابع، والزائرُ مكلَّفٌ على الثاني وحده.
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C2,
      visitedAt: NOW,
      core: CORE,
      details: BASEERA_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("OUT_OF_SUPERVISION_SCOPE")
  })
})

describe("نزاهةُ الزيارة — حرّاسُ المدخل قيمٌ معلنةٌ مصنَّفة", () => {
  it("هدفٌ مجهولٌ في هذه الشبكة ⇒ مرفوض", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: "ghost",
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("UNKNOWN_TARGET")
  })

  it("وهدفٌ موقوفٌ لا يُزار — الإيقافُ حالةٌ في البيانات لا حذف", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C_RETIRED,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("TARGET_INACTIVE")
  })

  it("**ولا تأريخَ مستقبلياً**: زيارةٌ لم تقع بعد مردودة", () => {
    const store = seedSupervisionStore()
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: tomorrow,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("FUTURE_DATED")
  })

  it("وتقييمٌ خارج المدى المئويّ مردود", () => {
    const store = seedSupervisionStore()
    for (const ratingPct of [-1, 101]) {
      const result = recordVisit(store, supervisionContext("u-square"), {
        targetId: C1,
        visitedAt: NOW,
        core: { ...CORE, ratingPct },
        details: TAHFEEZ_DETAILS,
      })
      expect(result.ok, String(ratingPct)).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("INVALID_RATING")
    }
  })

  it("وحضورٌ غيرُ موجبٍ مردود — زيارةٌ بلا حاضرٍ ليست زيارة", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: { ...CORE, attendees: 0 },
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("NON_POSITIVE_ATTENDEES")
  })

  it("والفاعلُ من الجلسة لا من المدخل — الزيارةُ تحمل مَن زار", () => {
    const store = seedSupervisionStore()
    const result = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.byPersonId).toBe("u-square")
  })
})
