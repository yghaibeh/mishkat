/**
 * بذرة العالم القانوني في المستودع — مُشتقّة من `tests/fixtures/canonical-world.ts`
 * (المصدر الواحد، TESTING_POLICY §٥) فلا عالمَ ثانٍ يتباعد. تُضيف عليه ما تحتاجه هذه
 * الوحدة (حسابات، معرّفات وحدات) دون تغيير الفيكستشر الحاكم.
 */

import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { OrgStore, childPath } from "../../../src/features/org/data/store.js"
import type { Account, OrgUnit, Section, StoredAssignment } from "../../../src/features/org/types.js"
import type { Actor } from "../../../src/authorization/can.js"
import type { UnitTypeId } from "../../../src/authorization/generated/roles.generated.js"

export const NOW = new Date("2026-07-20T00:00:00.000Z")
const START = new Date("2026-01-01T00:00:00.000Z")

function sectionOfPath(path: string): Section | null {
  if (path.startsWith("/men/")) return "men"
  if (path.startsWith("/women/")) return "women"
  return null
}

export type SeededWorld = {
  readonly store: OrgStore
  /** الفاعل القانوني لكل شخص، جاهزٌ للمحرك. */
  actor(personId: string): Actor
}

export function seedWorld(): SeededWorld {
  const world = buildCanonicalWorld()
  const store = new OrgStore()

  for (const u of world.units) {
    const unit: OrgUnit = {
      tenantId: store.tenantId,
      id: u.id,
      type: u.type as UnitTypeId,
      labelAr: u.ar,
      parentId: u.parentId,
      path: u.path,
      section: sectionOfPath(u.path),
      archived: false,
    }
    store.saveUnit(unit)
  }

  const unitIdByPath = new Map<string, string>()
  for (const u of world.units) unitIdByPath.set(u.path, u.id)

  let seq = 0
  for (const p of world.people) {
    const account: Account = {
      tenantId: store.tenantId,
      personId: p.personId,
      username: p.personId,
      status: p.accountStatus,
      sessionEpoch: p.currentSessionEpoch,
    }
    store.saveAccount(account)
    for (const a of p.assignments) {
      seq += 1
      const assignment: StoredAssignment = {
        tenantId: store.tenantId,
        id: `a-${seq}`,
        personId: p.personId,
        roleId: a.roleId,
        unitId: unitIdByPath.get(a.scopePath) ?? a.scopePath,
        scopePath: a.scopePath,
        startDate: a.startDate,
        endDate: a.endDate,
        approvalStatus: a.approvalStatus,
      }
      store.addAssignment(assignment)
    }
  }

  const byId = new Map(world.people.map((p) => [p.personId, p]))
  return {
    store,
    actor(personId: string): Actor {
      const p = byId.get(personId)
      if (p === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
      return p
    },
  }
}

/** الشبكةُ الثانية الصغيرة (t-aleppo) لاختبار العزل (TESTING_POLICY §٥ + §١.٠ من العقد). */
export const SECOND_TENANT_ID = "t-aleppo"

/**
 * شبكةٌ ثانيةٌ مصغّرة في مستودعٍ مستقلّ — **بنفس المسارات النسبيّة** للشبكة الأولى عمداً
 * (`/men/homs/…`)، فيثبت اختبارُ العزل أنّ التطابق النسبيّ لا يسرّب عبر الشبكات. فيها
 * مسؤولُ منطقةٍ «b-rabita» على `/men/homs/` ومسجدُها هي «b-salah» — ولا وجودَ فيها لـ«bilal».
 */
export function seedSecondTenant(): SeededWorld {
  const store = new OrgStore(SECOND_TENANT_ID)

  const rootPath = "/"
  const menPath = childPath(rootPath, "men")
  const homsPath = childPath(menPath, "homs")
  const sq2Path = childPath(homsPath, "sq2")
  const salahPath = childPath(sq2Path, "b-salah")

  const units: OrgUnit[] = [
    { tenantId: store.tenantId, id: "root", type: "root", labelAr: "شبكة حلب", parentId: null, path: rootPath, section: null, archived: false },
    { tenantId: store.tenantId, id: "men", type: "section", labelAr: "قسم الشباب", parentId: "root", path: menPath, section: "men", archived: false },
    { tenantId: store.tenantId, id: "homs", type: "region", labelAr: "منطقة حلب المركز", parentId: "men", path: homsPath, section: "men", archived: false },
    { tenantId: store.tenantId, id: "sq2", type: "square", labelAr: "المربع الأوّل", parentId: "homs", path: sq2Path, section: "men", archived: false },
    { tenantId: store.tenantId, id: "b-salah", type: "mosque", labelAr: "مسجد صلاح الدين", parentId: "sq2", path: salahPath, section: "men", archived: false },
  ]
  for (const u of units) store.saveUnit(u)

  store.saveAccount({ tenantId: store.tenantId, personId: "b-rabita", username: "b-rabita", status: "active", sessionEpoch: 1 })
  store.addAssignment({
    tenantId: store.tenantId,
    id: "a-1",
    personId: "b-rabita",
    roleId: "rabita",
    unitId: "homs",
    scopePath: homsPath,
    startDate: START,
    endDate: null,
    approvalStatus: "approved",
  })

  return {
    store,
    actor(personId: string): Actor {
      const account = store.getAccount(personId)
      if (account === null) throw new Error(`لا شخص بهذا المعرّف في الشبكة الثانية: ${personId}`)
      const assignments = store.assignmentsForPerson(personId).map((a) => ({
        roleId: a.roleId,
        scopePath: a.scopePath,
        startDate: a.startDate,
        endDate: a.endDate,
        approvalStatus: a.approvalStatus,
        unitArchived: false,
      }))
      return {
        personId,
        accountStatus: account.status,
        sessionEpoch: account.sessionEpoch,
        currentSessionEpoch: account.sessionEpoch,
        assignments,
        overrides: [],
      }
    },
  }
}

export { START }
