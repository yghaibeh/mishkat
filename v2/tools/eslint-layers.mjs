/**
 * قاعدة حدود الطبقات — المادة ٣/١: `routes ← server ← services ← db` باتجاه واحد.
 * ممنوع القفز (route يستورد من db) وممنوع الارتداد (service يستورد من route).
 * كُتبت محلياً بلا تبعية خارجية: قاعدةٌ نملكها خيرٌ من إضافةِ سلسلةِ توريدٍ لحراسة سطرين.
 */
const ORDER = ["routes", "server", "services", "db"]
const RANK = Object.fromEntries(ORDER.map((l, i) => [l, i]))

function layerOf(path) {
  const m = /(?:^|\/)src\/(routes|server|services|db)\//.exec(path.replace(/\\/g, "/"))
  return m ? m[1] : null
}
function importedLayer(spec) {
  const m = /(?:^|\/)(routes|server|services|db)\//.exec(spec.replace(/\\/g, "/"))
  return m ? m[1] : null
}

export const layersPlugin = {
  rules: {
    boundaries: {
      meta: { type: "problem", schema: [], messages: { jump: "{{msg}}" } },
      create(context) {
        const self = layerOf(context.filename ?? context.getFilename())
        if (!self) return {}
        return {
          ImportDeclaration(node) {
            const target = importedLayer(node.source.value)
            if (!target || target === self) return
            const from = RANK[self]
            const to = RANK[target]
            if (to < from) {
              context.report({
                node,
                messageId: "jump",
                data: { msg: `ارتداد طبقات ممنوع: «${self}» يستورد من «${target}» (المادة ٣/١)` },
              })
            } else if (to > from + 1) {
              context.report({
                node,
                messageId: "jump",
                data: { msg: `قفز طبقات ممنوع: «${self}» يستورد من «${target}» مباشرة (المادة ٣/١)` },
              })
            }
          },
        }
      },
    },
  },
}
