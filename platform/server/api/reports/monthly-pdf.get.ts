import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { monthlyMosqueReport } from '../../services/reports'
import { monthlyReportHtml } from '../../services/reportHtml'

// التقرير الشهري كملف PDF عبر Cloudflare Browser Rendering (يتطلب ربط BROWSER — باقة مدفوعة).
// يصيّر نفس قالب HTML العربي RTL إلى PDF حقيقي جاهز للإرسال عبر تيليغرام.
const querySchema = z.object({ mosqueId: z.string().min(1), month: z.string().min(4) })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { mosqueId, month } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0]
  if (!mosque) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
  assertAccessPath(user, mosque.path)

  const env = (event.context as any).cloudflare?.env
  if (!env?.BROWSER) {
    // غير مُفعّل: استعمل صيغة HTML (/api/reports/monthly-html) واطبعها PDF من المتصفح
    throw createError({ statusCode: 501, statusMessage: 'Browser Rendering غير مُفعّل — استخدم monthly-html' })
  }

  const report = await monthlyMosqueReport(db, mosqueId, month)
  const html = monthlyReportHtml(report)

  // استيراد ديناميكي حتى لا يُحمَّل إلا عند توفّر الربط
  const puppeteer = (await import('@cloudflare/puppeteer')).default as any
  const browser = await puppeteer.launch(env.BROWSER)
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    setHeader(event, 'content-type', 'application/pdf')
    setHeader(event, 'content-disposition', `attachment; filename="report-${mosqueId}-${month}.pdf"`)
    return pdf
  } finally {
    await browser.close()
  }
})
