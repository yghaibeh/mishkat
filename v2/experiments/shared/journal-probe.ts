/**
 * أرقامُ الشجرة والطابور — تُقاس من الشجرة نفسها لا تُقدَّر (نظيرُ `tree-probe.ts`).
 */

import { walkNodes } from "../../src/ui/components/kernel.js"
import { journalTree, JOURNAL_CTX, JOURNAL_DRAFT } from "./journal-fixture.js"
import { journalScreenTree } from "./journal-tree.js"
import { seededLines } from "./journal-tree.js"
import { JOURNAL_CAPS } from "./journal-fixture.js"
import { outboxPayload, validateDraft, balanceByCurrency } from "./journal-model.js"

function bytes(s: string): number {
  return new TextEncoder().encode(s).length
}

export function journalFacts(): Readonly<Record<string, unknown>> {
  const tree = journalTree()
  const nodes = walkNodes(tree)
  const at50 = journalScreenTree(
    JOURNAL_CAPS,
    { ...JOURNAL_DRAFT, lines: seededLines(50) },
    JOURNAL_CTX,
  )
  return {
    linesInMeasuredDraft: JOURNAL_DRAFT.lines.length,
    nodes: nodes.length,
    interactiveNodes: nodes.filter((n) => n.interactive).length,
    fields: nodes.filter((n) => n.component === "Field").length,
    currencies: balanceByCurrency(JOURNAL_DRAFT.lines).size,
    validationIssuesOnMeasuredDraft: validateDraft(JOURNAL_DRAFT, JOURNAL_CTX).length,
    uiNodeJsonBytes: bytes(JSON.stringify(tree)),
    outboxPayloadBytes: bytes(outboxPayload(JOURNAL_DRAFT)),
    nodesAt50Lines: walkNodes(at50).length,
    outboxPayloadBytesAt50: bytes(
      outboxPayload({ ...JOURNAL_DRAFT, lines: seededLines(50) }),
    ),
  }
}
