/**
 * معجمُ عقود الشاشات — وريثُ `ui-registry` في v1 (ق-١١٣، IA §الحوكمة).
 *
 * **ما لا عقدَ له لا يُسجَّل، وما لا يُسجَّل لا يُبنى**: التسجيلُ نفسه هو الفرض (نظيرُ
 * `defineServerFn` على الخادم). و«معاينةُ» الشاشة بقدراتٍ مفروضة (`preview`) هي ما تُحاكِمه
 * G20 لكل دورٍ حيّ: تُبنى الشاشةُ بحزمة قدراته فيُفحص ما يظهر وما يغيب — بلا متصفحٍ ولا بيانات.
 */

import type { UiNode } from "../components/kernel.js"
import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import { ROLE_CAPABILITIES, type RoleId } from "../../authorization/generated/roles.generated.js"
import { validateContract, type ScreenContract } from "./contract.js"

export type ScreenPreview = (caps: ReadonlySet<CapId>) => UiNode

export type RegisteredScreen = {
  readonly contract: ScreenContract
  readonly preview: ScreenPreview
  /** يبني الشاشة بحزمة قدرات الدور — `null` للشاشات الموقوفة (§٢.١٢/٢). */
  readonly buildForRole: (role: RoleId) => UiNode | null
}

const REGISTRY = new Map<string, RegisteredScreen>()

export function registerScreen(input: {
  readonly contract: ScreenContract
  readonly preview: ScreenPreview
}): RegisteredScreen {
  const violations = validateContract(input.contract)
  if (violations.length > 0) {
    // الشاشةُ بلا عقدٍ صالح **لا تُسجَّل أصلاً** — فلا تُبنى (ق-١١٣).
    throw new Error(
      `شاشةٌ بعقدٍ غير صالح (${input.contract.route}): ${violations.join(" · ")}`,
    )
  }
  if (REGISTRY.has(input.contract.route)) {
    throw new Error(`مسارٌ مسجَّلٌ مرتين: ${input.contract.route} — المسارُ واحدٌ في العقد`)
  }
  const registered: RegisteredScreen = {
    contract: input.contract,
    preview: input.preview,
    buildForRole: (role) =>
      input.contract.state === "suspended" ? null : input.preview(ROLE_CAPABILITIES[role]),
  }
  REGISTRY.set(input.contract.route, registered)
  return registered
}

export function registeredScreens(): readonly RegisteredScreen[] {
  return [...REGISTRY.values()]
}

export function clearScreenRegistryForTests(): void {
  REGISTRY.clear()
}
