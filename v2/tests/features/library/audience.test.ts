/**
 * عقدُ الوحدة §٢ — **الجمهورُ قدرةٌ يُسأل عنها المحرّك، لا اسمُ دورٍ يُقارَن** (G6).
 *
 * في v1 كان الجمهورُ `SUPERVISOR_ROLES = ["square","rabita","section_head"]` مُصلَّبةً في
 * الكود؛ وهنا يُثبَت أنّ **النتيجةَ نفسُها** تُبلَغ بسؤال المحرّك عن قدرةٍ — فتبقى صحيحةً
 * يومَ يتغيّر الملفُّ الذهبيّ، ولا تتخلّف عنه كما تتخلّف قائمةٌ بيدِ إنسان.
 */
import { describe, it, expect } from "vitest"
import { makeAudienceMembership } from "../../../src/features/library/services/audience.js"
import { CAPS } from "../../../src/authorization/generated/capabilities.generated.js"
import { AUDIENCES, DECISION, canonicalActor, libraryDirectory } from "./_seed.js"

const inAudience = makeAudienceMembership(libraryDirectory, DECISION)

describe("§٢ — الجمهورُ قدرةٌ: الانتماءُ جوابُ المحرّك لا مقارنةُ دور", () => {
  it("«الجميع» يشمل كلَّ دورٍ حيّ — لأنّ `library.own` في حزمة كلٍّ منهم", () => {
    for (const personId of [
      "u-admin",
      "u-section-head",
      "u-rabita",
      "u-square",
      "u-amir",
      "u-teacher",
      "u-committee-head",
      "u-media",
      "u-finance",
      "u-student",
    ]) {
      expect(inAudience(personId, "library.own"), personId).toBe(true)
    }
  })

  it("«مسؤولو المساجد» أميرُ المسجد وحده — والمشرفُ فوقه ليس منهم (ق-٨٤)", () => {
    expect(inAudience("u-amir", "circle.manage")).toBe(true)
    expect(inAudience("u-square", "circle.manage")).toBe(false)
    expect(inAudience("u-rabita", "circle.manage")).toBe(false)
    expect(inAudience("u-admin", "circle.manage")).toBe(false)
  })

  it("«المعلّمون» حاملو `circle.teach` — وهي **شخصية**، فتُسأل بملكية الفاعل نفسِه (قب-٣٨)", () => {
    expect(CAPS["circle.teach"].type).toBe("personal")
    expect(inAudience("u-teacher", "circle.teach")).toBe(true)
    expect(inAudience("u-amir", "circle.teach")).toBe(false)
    expect(inAudience("u-student", "circle.teach")).toBe(false)
  })

  it("**«المشرفون» ثلاثتُهم بلا قائمةِ أدوارٍ واحدة** — مطابقةٌ تامّةٌ لـ`SUPERVISOR_ROLES` في v1", () => {
    for (const personId of ["u-section-head", "u-rabita", "u-square"]) {
      expect(inAudience(personId, "visit.conduct"), personId).toBe(true)
    }
    for (const personId of ["u-amir", "u-teacher", "u-student", "u-media", "u-admin"]) {
      expect(inAudience(personId, "visit.conduct"), personId).toBe(false)
    }
  })

  it("ومَن دورُه موقوفٌ أو تكليفُه منتهٍ أو معلَّقٌ **ليس في أيّ جمهور** (ق-٢٤/ق-٢٥ وقب-٧)", () => {
    for (const personId of ["u-suspended-role", "u-ended", "u-pending"]) {
      for (const audience of AUDIENCES) {
        expect(inAudience(personId, audience.capabilityId), `${personId}/${audience.id}`).toBe(false)
      }
    }
  })

  it("ومجهولُ الهوية ليس في جمهورٍ — الغيابُ رفضٌ لا سكوت", () => {
    for (const audience of AUDIENCES) {
      expect(inAudience("u-ghost", audience.capabilityId)).toBe(false)
    }
  })

  it("**وحاملُ دورين يدخل جمهورَي دورَيه** — اتحادُ القدرات بلا تسريبٍ بين نطاقيه", () => {
    // `u-dual`: أميرُ خالد **ومعلّمُ** حلقةٍ في مسجد عمر.
    expect(canonicalActor("u-dual").assignments.length).toBe(2)
    expect(inAudience("u-dual", "circle.manage")).toBe(true)
    expect(inAudience("u-dual", "circle.teach")).toBe(true)
    expect(inAudience("u-dual", "visit.conduct")).toBe(false)
  })
})
