/**
 * مستودعُ الشجرة على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `OrgStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (README الحسم ١، الطبقة ٢).
 * ولذلك يصمد أمام `store.assignments[i] = x` — وهي كتابةٌ مباشرةٌ في حقلٍ عامّ بلا نداءِ
 * دالّة، كانت ستتسرّب من أيّ اعتراضٍ للنداءات (`services/assignments.ts`).
 */

import type { RoleId, UnitTypeId } from "../../authorization/generated/roles.generated.js"
import { OrgStore } from "../../features/org/data/store.js"
import type {
  AccountStatus,
  AssignmentApproval,
  RegistrationRequest,
  Section,
} from "../../features/org/types.js"
import {
  encodeBoolean,
  encodeDate,
  encodeNullable,
  readBoolean,
  readDate,
  readDateOrNull,
  readInt,
  readText,
  readTextOrNull,
} from "../encode.js"
import { TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { tableSpec } from "../schema.js"
import { auditRow, readAuditInto, sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "org"
const SEQUENCE = "org.seq"

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

export function persistentOrg(store: OrgStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مسارُ الطلب مشتقٌّ من وحدته المخزَّنة — ولا يُخترع (§٥.٢). */
  const requestPath = (request: RegistrationRequest): string => {
    const unit = store.getUnit(request.requestedUnitId)
    if (unit === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: طلبُ التسجيل ${request.id} يشير إلى وحدةٍ مجهولة ${request.requestedUnitId}`,
      )
    }
    return unit.path
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    const consider = (id: string): void => {
      max = Math.max(max, suffixOf(id))
    }
    for (const assignment of store.assignments) consider(assignment.id)
    for (const account of store.accounts.values()) consider(account.personId)
    for (const request of store.requests.values()) {
      consider(request.id)
      consider(request.personId)
    }
    return max
  }

  return {
    name: SOURCE,
    tables: [
      "org_units",
      "org_accounts",
      "org_assignments",
      "org_requests",
      { table: "audit_log", owns: (r) => r["source"] === SOURCE },
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(
          [...store.units.values()].map((unit) => ({
            tenant_id: tenantId,
            unit_path: unit.path,
            id: unit.id,
            type: unit.type,
            label_ar: unit.labelAr,
            parent_id: unit.parentId,
            section: unit.section,
            archived: encodeBoolean(unit.archived),
          })),
          "org_units",
        ),
        collect(
          [...store.accounts.values()].map((account) => ({
            tenant_id: tenantId,
            // الحسابُ نطاقُه الشبكة: الشخصُ قد يخدم في قسمين (README الحسم ٢).
            unit_path: TENANT_ROOT_PATH,
            person_id: account.personId,
            username: account.username,
            status: account.status,
            session_epoch: account.sessionEpoch,
          })),
          "org_accounts",
        ),
        collect(
          store.assignments.map((assignment) => ({
            tenant_id: tenantId,
            unit_path: assignment.scopePath,
            id: assignment.id,
            person_id: assignment.personId,
            role_id: assignment.roleId,
            unit_id: assignment.unitId,
            start_date: encodeDate(assignment.startDate),
            end_date: encodeNullable(assignment.endDate, encodeDate),
            approval_status: assignment.approvalStatus,
          })),
          "org_assignments",
        ),
        collect(
          [...store.requests.values()].map((request) => ({
            tenant_id: tenantId,
            unit_path: requestPath(request),
            id: request.id,
            person_id: request.personId,
            username: request.username,
            requested_role_id: request.requestedRoleId,
            requested_unit_id: request.requestedUnitId,
            status: request.status,
            origin: request.origin,
          })),
          "org_requests",
        ),
        collect(
          store.audit.map((record, index) =>
            auditRow({
              tenantId,
              source: SOURCE,
              seq: index + 1,
              unitPath: record.scopePath,
              scopeExact: true,
              at: record.at,
              actorPersonId: record.actorPersonId,
              action: record.action,
              capability: record.capability,
              targetType: record.targetType,
              targetId: record.targetId,
              reason: record.reason,
            }),
          ),
          "audit_log",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "org_units").values()) {
        store.saveUnit({
          tenantId,
          id: readText(row, "id"),
          type: readText(row, "type") as UnitTypeId,
          labelAr: readText(row, "label_ar"),
          parentId: readTextOrNull(row, "parent_id"),
          path: readText(row, "unit_path"),
          section: readTextOrNull(row, "section") as Section | null,
          archived: readBoolean(row, "archived"),
        })
      }
      for (const row of table(rows, "org_accounts").values()) {
        store.saveAccount({
          tenantId,
          personId: readText(row, "person_id"),
          username: readText(row, "username"),
          status: readText(row, "status") as AccountStatus,
          sessionEpoch: readInt(row, "session_epoch"),
        })
      }
      for (const row of table(rows, "org_assignments").values()) {
        store.addAssignment({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          roleId: readText(row, "role_id") as RoleId,
          unitId: readText(row, "unit_id"),
          scopePath: readText(row, "unit_path"),
          startDate: readDate(row, "start_date"),
          endDate: readDateOrNull(row, "end_date"),
          approvalStatus: readText(row, "approval_status") as AssignmentApproval,
        })
      }
      for (const row of table(rows, "org_requests").values()) {
        store.saveRequest({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          username: readText(row, "username"),
          requestedRoleId: readText(row, "requested_role_id") as RoleId,
          requestedUnitId: readText(row, "requested_unit_id"),
          status: readText(row, "status") as RegistrationRequest["status"],
          origin: readText(row, "origin") as RegistrationRequest["origin"],
        })
      }
      readAuditInto(table(rows, "audit_log"), (record) =>
        store.appendAudit({
          at: record.at,
          actorPersonId: record.actorPersonId,
          action: record.action,
          capability: record.capability ?? "",
          scopePath: record.unitPath,
          targetType: record.targetType ?? "",
          targetId: record.targetId,
          reason: record.reason,
        }),
      )

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
