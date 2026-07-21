/* global process, console, URL */
/**
 * خادمُ ملفاتٍ ثابتٌ للقياس في متصفحٍ حقيقيّ — يخدم مواقعَ `site-*` التي يبنيها `measure.mjs`.
 * غرضُه واحد: عزلُ **زمن التحليل والتنفيذ والترطيب** عن زمن الشبكة (الشبكةُ هنا صفر).
 *
 * التشغيل: `node serve.mjs [port]` بعد `node measure.mjs`.
 */

import { createServer } from "node:http"
import { readFileSync, existsSync, statSync } from "node:fs"
import { join, extname } from "node:path"
import { tmpdir } from "node:os"

const ROOT = process.env.MISHKAT_EXP_OUT ?? join(tmpdir(), "mishkat-adr002r")
const PORT = Number.parseInt(process.argv[2] ?? "4173", 10)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  let path = join(ROOT, decodeURIComponent(url.pathname))
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html")
  // ورقةُ الرموز والجزيرة تُطلبان بمسارٍ جذريّ من داخل كل موقع.
  if (!existsSync(path)) {
    const site = url.pathname.split("/")[1] ?? ""
    path = join(ROOT, site, decodeURIComponent(url.pathname.split("/").pop() ?? ""))
  }
  if (!existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404)
    res.end("not found")
    return
  }
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" })
  res.end(readFileSync(path))
}).listen(PORT, "127.0.0.1", () => {
  console.log(`قياس: http://127.0.0.1:${PORT}/site-a1/  ·  /site-a2/  ·  /site-b/`)
})
