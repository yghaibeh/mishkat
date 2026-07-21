/**
 * مِسبارُ §١ — أرقامُ **السياج القائم** تُقاس من `v2/src` لا تُقدَّر:
 * عددُ المكوّنات · حجمُ شجرة العرض المُصيَّرة للشاشة البرهانية · حجمُ الخط المُضمَّن.
 */

import { COMPONENT_IDS, walkNodes } from "../../src/ui/components/kernel.js"
import { TEXT_KEYS } from "../../src/ui/text/dictionary.js"
import { EMBEDDED_FONT } from "../../src/ui/tokens/font.js"
import { SURFACES } from "../../src/ui/shell/surfaces.js"
import { registeredScreens } from "../../src/screens.js"
import { ROLE_IDS } from "../../src/authorization/generated/roles.generated.js"
import { proofScreenTree } from "./tree.js"
import { renderNodeHtml } from "./html.js"

/**
 * كلفةُ الأوفلاين للمرشّح (ب): الخادمُ يصيّر، فالأوفلاين يوجب **تخزين HTML لكل شاشةٍ لكل دور**.
 * هذا الرقمُ هو ثمنُ ذلك اليوم — يُقاس ولا يُفترض (§٣ من المهمة).
 */
export function offlinePrecacheFacts(): Record<string, number> {
  let screensPerRole = 0
  let totalHtmlBytes = 0
  for (const screen of registeredScreens()) {
    for (const role of ROLE_IDS) {
      const tree = screen.buildForRole(role)
      if (tree === null) continue
      screensPerRole += 1
      totalHtmlBytes += Buffer.byteLength(renderNodeHtml(tree), "utf8")
    }
  }
  return {
    registeredScreens: registeredScreens().length,
    surfaces: SURFACES.length,
    roles: ROLE_IDS.length,
    screenRolePairs: screensPerRole,
    allScreenRoleHtmlBytes: totalHtmlBytes,
  }
}

export function fenceFacts(): Record<string, number | string> {
  const tree = proofScreenTree()
  const nodes = walkNodes(tree)
  const json = JSON.stringify(tree)
  const html = renderNodeHtml(tree)
  const base64 = EMBEDDED_FONT.dataUri.slice(EMBEDDED_FONT.dataUri.indexOf(",") + 1)
  return {
    componentsInLibrary: COMPONENT_IDS.length,
    textKeys: TEXT_KEYS.length,
    proofScreenNodes: nodes.length,
    proofScreenInteractiveNodes: nodes.filter((n) => n.interactive).length,
    proofScreenJsonBytes: Buffer.byteLength(json, "utf8"),
    proofScreenHtmlBytes: Buffer.byteLength(html, "utf8"),
    fontFamily: EMBEDDED_FONT.family,
    fontBase64Bytes: base64.length,
    fontDecodedBytes: Buffer.from(base64, "base64").length,
  }
}
