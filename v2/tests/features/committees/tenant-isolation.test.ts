/**
 * قب-١٨ — **عزلُ الشبكة على كل مسارات اللجان** (الاختبارُ الإلزاميّ السادس في T12).
 *
 * العزلُ **بنيويٌّ في طبقة البيانات**: مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ أصلاً. والشبكةُ
 * الثانية تحمل **نفسَ المسارات النسبيّة عمداً** — فيثبت أنّ التطابق لا يسرّب.
 *
 * ومعه **الثابتُ الذي لا يُخترق بنيوياً**: هذه الوحدة **لا تُنشئ حساباً ولا تربط شخصاً بعضو**
 * (ق-٣١) — يُقاس على **الشجرة** لا يُوعَد به في تعليق.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { CommitteeStore } from "../../../src/features/committees/data/store.js"
import { CommitteeTenantRegistry } from "../../../src/features/committees/data/tenant.js"
import { makeCommitteeEndpoints } from "../../../src/features/committees/server/endpoints.js"
import { formCommittee, committeesWithin } from "../../../src/features/committees/services/committees.js"
import { recordMeeting, meetingsWithin } from "../../../src/features/committees/services/meetings.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  KHALID,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  READ,
  RELIEF,
  SECOND_TENANT_ID,
  WRITE,
  canonicalActor,
  committeeContext,
  seedCommitteeStore,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])

beforeEach(() => clearRegistryForTests())

describe("المستودعُ يختم شبكتَه — و`tenantId` لا يأتي من مدخل العميل", () => {
  it("لجنةٌ وافدةٌ بشبكةٍ ملفَّقة ⇒ تُطمس بشبكة المستودع", () => {
    const store = new CommitteeStore(MAIN_TENANT_ID)
    store.saveCommittee({
      tenantId: SECOND_TENANT_ID,
      id: "cm-forged",
      mosqueUnitId: KHALID,
      mosquePath: KHALID_PATH,
      path: `${KHALID_PATH}cm-forged/`,
      labelAr: "لجنةٌ ملفَّقة",
      headPersonId: null,
      headNameAr: "فلان",
      active: true,
    })
    expect(store.getCommittee("cm-forged")?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("والمحضرُ والعضوُ والنشاطُ كلُّها تحمل شبكةَ مستودعها", () => {
    const store = seedCommitteeStore()
    const meeting = recordMeeting(store, committeeContext("u-amir"), {
      mosqueUnitId: KHALID,
      heldAt: NOW,
      minutesAr: "محضر",
      decisionsAr: ["قرار"],
    })
    if (!meeting.ok) throw new Error(meeting.error.code)
    expect(meeting.value.tenantId).toBe(MAIN_TENANT_ID)
  })
})

describe("سجلُّ الشبكات يوجّه إلى **مستودع شبكته** ولا يخلطهما", () => {
  it("شبكتان ⇒ مستودعان مستقلّان، وطلبُ الشبكة نفسِها يعيد المستودعَ نفسَه", () => {
    const registry = new CommitteeTenantRegistry()
    const main = registry.storeFor(MAIN_TENANT_ID)
    const second = registry.storeFor(SECOND_TENANT_ID)
    expect(main).not.toBe(second)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(main)
    expect(registry.has(SECOND_TENANT_ID)).toBe(true)
    expect(registry.has("t-ghost")).toBe(false)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("**ولجنةُ شبكةٍ لا تظهر في نطاق الأخرى ولو تطابقت المسارات حرفاً بحرف**", () => {
    const first = seedCommitteeStore(MAIN_TENANT_ID)
    const second = seedCommitteeStore(SECOND_TENANT_ID)
    formCommittee(second, committeeContext("u-amir"), {
      id: RELIEF.id,
      mosqueUnitId: KHALID,
      labelAr: "لجنةُ شبكةٍ أخرى",
      headPersonId: null,
      headNameAr: "فلان",
    })
    expect(committeesWithin(second, KHALID_PATH)).toHaveLength(1)
    expect(committeesWithin(first, KHALID_PATH)).toHaveLength(0)
  })

  it("**والمحاضرُ كذلك لا تعبر**", () => {
    const first = seedCommitteeStore(MAIN_TENANT_ID)
    const second = seedCommitteeStore(SECOND_TENANT_ID)
    recordMeeting(second, committeeContext("u-amir"), {
      mosqueUnitId: KHALID,
      heldAt: NOW,
      minutesAr: "محضرُ شبكةٍ أخرى",
      decisionsAr: ["قرار"],
    })
    expect(meetingsWithin(second, KHALID_PATH)).toHaveLength(1)
    expect(meetingsWithin(first, KHALID_PATH)).toHaveLength(0)
  })
})

describe("والحدُّ **قبل المحرّك**: فاعلٌ في شبكةٍ لا يبلغ لجانَ أخرى", () => {
  it("مستودعُ شبكةٍ لم تُبذَر فيها الشجرةُ لا يُنتج نطاقاً ⇒ `NO_SCOPE` ⇒ رفضٌ لكل السطوح", async () => {
    const barren = new CommitteeStore(SECOND_TENANT_ID)
    const ep = makeCommitteeEndpoints(barren, SETTINGS)

    const listed = await ep.list.invoke({ unitId: KHALID }, canonicalActor("u-admin"), READ)
    const formed = await ep.form.invoke(
      {
        unitId: KHALID,
        committeeId: "cm-cross",
        labelAr: "لجنةٌ عابرة",
        headPersonId: null,
        headNameAr: "فلان",
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    const meetings = await ep.meetings.invoke({ unitId: KHALID }, canonicalActor("u-admin"), READ)
    const recorded = await ep.recordMeeting.invoke(
      { unitId: KHALID, heldAt: NOW, minutesAr: "محضر", decisionsAr: ["قرار"] },
      canonicalActor("u-amir"),
      WRITE,
    )
    const mine = await ep.myCommittee.invoke(
      { committeeId: RELIEF.id },
      canonicalActor(RELIEF.headPersonId),
      READ,
    )

    expect(listed.ok).toBe(false)
    expect(formed.ok).toBe(false)
    expect(meetings.ok).toBe(false)
    expect(recorded.ok).toBe(false)
    expect(mine.ok).toBe(false)
  })
})

describe("**ق-٣١ بنيويّاً**: الوحدةُ لا تُنشئ حساباً ولا تعرف دليلَ الأشخاص", () => {
  const MODULE_DIR = new URL("../../../src/features/committees/", import.meta.url).pathname

  function sourceFiles(dir: string): readonly string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
      else if (full.endsWith(".ts")) out.push(full)
    }
    return out
  }

  function codeOf(file: string): string {
    return readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
  }

  it("لا استيرادَ لوحدة `org` ولا لأيّ مسارِ توفيرِ حسابات — التوفيرُ يُستعمَل ولا يُعاد (ع-١٧)", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(MODULE_DIR)) {
      codeOf(file)
        .split("\n")
        .forEach((line, i) => {
          if (/from\s+"[^"]*features\/org\//.test(line)) offenders.push(`${file}:${i + 1}`)
          if (/\bprovision\w*\s*\(/.test(line)) offenders.push(`${file}:${i + 1} — توفيرُ حساب`)
          if (/\bsaveAccount\b|\bhasUsername\b/.test(line)) offenders.push(`${file}:${i + 1} — حساب`)
        })
    }
    expect(offenders, offenders.join(" · ")).toEqual([])
  })

  it("**ولا حقلَ `personId` في عضوٍ ولا في نشاط** — الأسماءُ حرّةٌ بحكم النوع (ق-٣١)", () => {
    const types = readFileSync(join(MODULE_DIR, "types.ts"), "utf8")
    const memberBlock = types.slice(
      types.indexOf("export type CommitteeMember"),
      types.indexOf("export type CommitteeActivity"),
    )
    const activityBlock = types.slice(
      types.indexOf("export type CommitteeActivity"),
      types.indexOf("export type Meeting"),
    )
    expect(memberBlock.length).toBeGreaterThan(0)
    expect(activityBlock.length).toBeGreaterThan(0)
    expect(memberBlock).not.toMatch(/personId/)
    expect(activityBlock).not.toMatch(/personId/)
  })

  it("والمسحُ له موضوعٌ فعليّ — الوحدةُ فيها ملفّاتٌ تُمسح", () => {
    expect(sourceFiles(MODULE_DIR).length).toBeGreaterThan(5)
  })
})
