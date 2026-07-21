/**
 * قب-١٨ — **عزلُ الشبكة** في الإعلام (عقدُ الوحدة §١٠).
 *
 * الاختبارُ الإلزاميُّ السابع في T13. الشبكتان تحملان **نفسَ المسارات النسبيّة عمداً**،
 * فيثبت أن التطابقَ لا يسرّب: مستودعُ الشبكة هو الذي يحلّ الوحدة، فالكيانُ الغريب لا
 * يُحلّ أصلاً ⇒ `NO_SCOPE` ⇒ رفض. **صفر قدرةٍ جديدة وصفر فرعِ شبكةٍ في المحرّك.**
 */
import { describe, it, expect } from "vitest"
import { MediaTenantRegistry } from "../../../src/features/media/data/tenant.js"
import { makeMediaEndpoints } from "../../../src/features/media/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { addPhoto, createCoverage } from "../../../src/features/media/services/coverages.js"
import { mediaHubView } from "../../../src/features/media/services/gallery.js"
import {
  canonicalActor,
  coverageInput,
  mediaContext,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  DECISION,
  KHALID_PATH,
  MAIN_TENANT_ID,
  SECOND_TENANT_ID,
  UPLOAD_LIMIT,
  WRITE,
} from "./_seed.js"
import { MediaStore } from "../../../src/features/media/data/store.js"

function publish(store: MediaStore, titleAr: string): string {
  const made = createCoverage(store, mediaContext("u-media"), coverageInput({ titleAr }))
  if (!made.ok) throw new Error(made.error.code)
  const photo = addPhoto(store, mediaContext("u-media"), {
    coverageId: made.value.id,
    contentType: "image/jpeg",
    sizeBytes: 1_000,
  })
  if (!photo.ok) throw new Error(photo.error.code)
  return made.value.id
}

describe("قب-١٨ — الشبكةُ من المستودع لا من مدخل العميل", () => {
  it("المستودعُ يختم شبكتَه على كل كيانٍ يحفظه — ولا يقبلها من المدخل", () => {
    const store = seedMediaStore(SECOND_TENANT_ID)
    const id = publish(store, "تغطيةُ حلب")

    expect(store.getCoverage(id)?.tenantId).toBe(SECOND_TENANT_ID)
    expect(store.getUnit("khalid")?.tenantId).toBe(SECOND_TENANT_ID)
  })

  it("**ومعرضُ شبكةٍ لا يرى تغطياتِ أخرى ولو تطابق المسارُ النسبيّ حرفاً بحرف**", () => {
    const main = seedMediaStore(MAIN_TENANT_ID)
    const second = seedMediaStore(SECOND_TENANT_ID)
    publish(main, "تغطيةُ حمص")
    publish(second, "تغطيةُ حلب")

    const mainView = mediaHubView(main, mediaContext("u-media"), KHALID_PATH)
    const secondView = mediaHubView(second, mediaContext("u-media"), KHALID_PATH)

    expect(mainView.items).toHaveLength(1)
    expect(secondView.items).toHaveLength(1)
    expect(mainView.items[0]?.titleAr).toBe("تغطيةُ حمص")
    expect(secondView.items[0]?.titleAr).toBe("تغطيةُ حلب")
  })

  it("والسجلُّ يوزّع مستودعاً واحداً لكل شبكة — نفسُه في كل طلب", () => {
    const registry = new MediaTenantRegistry()
    const a = registry.storeFor(MAIN_TENANT_ID)
    const b = registry.storeFor(MAIN_TENANT_ID)
    const c = registry.storeFor(SECOND_TENANT_ID)

    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(registry.has(SECOND_TENANT_ID)).toBe(true)
    expect(registry.tenantIds()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID])
  })
})

describe("قب-١٨ — والفاعلُ في شبكةٍ لا يبلغ كيانَ أخرى", () => {
  it("تغطيةُ الشبكة الأخرى **لا تُحلّ** في مستودع هذه ⇒ استدعاءُ حذفها مرفوض", async () => {
    const main = seedMediaStore(MAIN_TENANT_ID)
    const second = seedMediaStore(SECOND_TENANT_ID)
    const foreignId = publish(second, "تغطيةُ حلب")

    clearRegistryForTests()
    const ep = makeMediaEndpoints(
      main,
      createSettingsResolver([UPLOAD_LIMIT]),
      mediaDirectory,
      mediaPorts(),
    )

    const r = await ep.deleteCoverage.invoke(
      { coverageId: foreignId },
      canonicalActor("u-media"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
    expect(second.getCoverage(foreignId)?.deletedAt).toBeNull()
  })

  it("ووحدةُ الشبكة الأخرى لا تُحلّ نطاقاً ⇒ معرضُها لا يُفتح من هنا", async () => {
    // مستودعٌ فارغٌ لهذه الشبكة: الوحدةُ قائمةٌ في الشبكة الأخرى وحدها.
    const main = new MediaStore(MAIN_TENANT_ID)
    clearRegistryForTests()
    const ep = makeMediaEndpoints(
      main,
      createSettingsResolver([UPLOAD_LIMIT]),
      mediaDirectory,
      mediaPorts(),
    )

    const r = await ep.hubView.invoke({ unitId: "khalid" }, canonicalActor("u-admin"), DECISION)
    expect(r.ok).toBe(false)
  })
})
