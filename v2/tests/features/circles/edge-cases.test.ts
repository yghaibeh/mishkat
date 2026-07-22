/**
 * حالاتُ الحواف وثوابتُ طبقة البيانات — عقدُ الوحدة §١/§٤/§٥/§٦.
 *
 * ثلاثةُ ثوابتٍ تُفحص هنا **بالكسر لا بالوعد**:
 *  ١. **السجلُّ إلحاقٌ لا استبدال**: معرّفٌ مكرَّرٌ **رميةٌ برمجية** لا كتابةٌ صامتة فوق سابقه
 *     (فلا يضيع التحاقُ طالبٍ تحت آخر — وهو نمطُ عطب v1 نفسُه: يُدخَل ولا يظهر).
 *  ٢. **بلوغُ النطاق يُقاس بمسار التكليف لا بمسمّاه** (G6) — بكل حالات التكليف غير الفعّال.
 *  ٣. **لا يُلفَّق اسمُ نوعٍ غائب**: النوعُ غيرُ الموجود في الكتالوج يبقى بمعرّفه للتشخيص (ق-١١٢).
 */
import { describe, it, expect } from "vitest"
import { CirclesStore } from "../../../src/features/circles/data/store.js"
import { makeScopeReach } from "../../../src/features/circles/services/directory.js"
import { circleView } from "../../../src/features/circles/services/derive.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  BILAL_PATH,
  canonicalDirectory,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  OMAR_PATH,
  seedCirclesStore,
} from "./_seed.js"

describe("§٥ — **السجلُّ إلحاقٌ لا استبدال**: لا يُكتب فوق التحاقٍ قائم", () => {
  it("التحاقٌ بمعرّفٍ مكرَّرٍ ⇒ رميةٌ برمجية — لا كتابةٌ صامتةٌ تبتلع طالباً", () => {
    const store = seedCirclesStore()
    const enrollment = {
      tenantId: MAIN_TENANT_ID,
      id: "enrollment-1",
      circleId: "circle-1",
      nameAr: "الأول",
      joinedAt: NOW,
      leftAt: null,
    }
    store.appendEnrollment(enrollment)
    expect(() => store.appendEnrollment({ ...enrollment, nameAr: "الثاني" })).toThrow()
    // والأولُ باقٍ كما هو — لم يُدهَس.
    expect(store.getEnrollment("enrollment-1")?.nameAr).toBe("الأول")
  })

  it("ووسمُ خروجٍ لالتحاقٍ غير موجودٍ ⇒ رميةٌ برمجية (الحارسُ الدلاليّ في الخدمة)", () => {
    const store = seedCirclesStore()
    expect(() => store.stampLeft("لا-وجود-له", NOW)).toThrow()
  })

  it("والالتحاقُ المجهولُ في المستودع ⇒ `null` لا استثناء", () => {
    expect(seedCirclesStore().getEnrollment("لا-وجود-له")).toBeNull()
    expect(seedCirclesStore().getCircle("لا-وجود-لها")).toBeNull()
    expect(seedCirclesStore().getUnit("لا-وجود-لها")).toBeNull()
  })
})

describe("§٤ — **بلوغُ النطاق بمسار التكليف لا بمسمّاه** (G6)", () => {
  const reaches = makeScopeReach(canonicalDirectory, NOW)

  it("حاملُ تكليفٍ داخل الوحدة يبلغها — والمعلّمُ والأميرُ ومسؤولُ اللجنة سواءٌ في المقياس", () => {
    expect(reaches("u-teacher", KHALID_PATH)).toBe(true)
    expect(reaches("u-amir", KHALID_PATH)).toBe(true)
    expect(reaches("u-committee-head", KHALID_PATH)).toBe(true)
    expect(reaches("u-amir-bilal", KHALID_PATH)).toBe(false)
    expect(reaches("u-amir-bilal", BILAL_PATH)).toBe(true)
  })

  it("**وشخصٌ مجهولٌ لا يبلغ شيئاً** — الغيابُ رفضٌ لا صمت", () => {
    expect(reaches("u-لا-أحد", KHALID_PATH)).toBe(false)
  })

  it("والتكليفُ غيرُ الفعّال لا يُبلِّغ: منتهٍ · معلَّقٌ · مؤرشفةٌ وحدتُه · لم يبدأ بعد", () => {
    expect(reaches("u-ended", BILAL_PATH)).toBe(false)
    expect(reaches("u-pending", OMAR_PATH)).toBe(false)

    const base = canonicalDirectory("u-teacher")!
    const archived: Actor = {
      ...base,
      assignments: base.assignments.map((a) => ({ ...a, unitArchived: true })),
    }
    const future: Actor = {
      ...base,
      assignments: base.assignments.map((a) => ({
        ...a,
        startDate: new Date(NOW.getTime() + 1),
      })),
    }
    const reachArchived = makeScopeReach((id) => (id === "x" ? archived : null), NOW)
    const reachFuture = makeScopeReach((id) => (id === "x" ? future : null), NOW)
    expect(reachArchived("x", KHALID_PATH)).toBe(false)
    expect(reachFuture("x", KHALID_PATH)).toBe(false)
  })
})

describe("§٦ — **لا يُلفَّق ما ليس في الكتالوج**", () => {
  it("حلقةٌ بنوعٍ غائبٍ عن الكتالوج: يبقى المعرّفُ ولا يُخترع اسمٌ عربيّ (ق-١١٢)", () => {
    const store = new CirclesStore(MAIN_TENANT_ID)
    store.saveCircle({
      tenantId: MAIN_TENANT_ID,
      id: "circle-1",
      unitPath: KHALID_PATH,
      typeId: "نوعٌ-غاب-عن-الكتالوج",
      nameAr: "حلقة",
      capacity: 10,
      teacherPersonId: null,
      archivedAt: null,
      createdAt: NOW,
    })
    const view = circleView(store, "circle-1")
    expect(view?.typeId).toBe("نوعٌ-غاب-عن-الكتالوج")
    expect(view?.typeAr).toBe("")
  })
})
