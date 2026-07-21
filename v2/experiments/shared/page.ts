/**
 * هيكلُ المستند — واحدٌ للمرشّحَين كي لا يتسرّب فرقٌ من خارج الإطار.
 * ما يختلف بينهما **وسومُ السكربت وحدها**، وهو بالضبط ما نقيسه.
 */

export type PageInput = {
  readonly bodyHtml: string
  /** وسومُ السكربت التي يحتاجها المرشّح لتشغيل الصفحة. */
  readonly scripts: string
  readonly cssHref: string
  readonly titleAr: string
}

export function documentHtml(input: PageInput): string {
  return [
    "<!doctype html>",
    '<html lang="ar" dir="rtl">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${input.titleAr}</title>`,
    `<link rel="stylesheet" href="${input.cssHref}">`,
    '<link rel="manifest" href="manifest.webmanifest">',
    "</head>",
    "<body>",
    `<div id="app">${input.bodyHtml}</div>`,
    input.scripts,
    "</body>",
    "</html>",
  ].join("")
}
