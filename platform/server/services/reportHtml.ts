// قالب HTML للتقرير الشهري — عربي RTL، جاهز للطباعة/التحويل إلى PDF (متوافق مع Workers).
// دالة نقية: تأخذ ناتج monthlyMosqueReport وتُعيد صفحة HTML كاملة.

type Report = {
  mosque: { id: string; name: string; genderTrack: string }
  month: string
  weeklyTarget: number
  weeksCount: number
  monthlyTarget: number
  monthTotal: number
  achievementPct: number
  money: number | null
  allApproved: boolean
  weeks: Array<{ weekStart: string; points: number; status: string; locked: boolean }>
  activities: Array<{ name: string; times: number; points: number }>
}

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  amir_approved: 'اعتمده الأمير',
  layer_approved: 'معتمد نهائياً',
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

export function monthlyReportHtml(r: Report): string {
  const trackAr = r.mosque.genderTrack === 'female' ? 'نساء' : 'رجال'
  const weekRows = r.weeks.map((w, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(w.weekStart)}</td>
        <td>${w.points}</td>
        <td>${esc(STATUS_AR[w.status] ?? w.status)}</td>
      </tr>`).join('')
  const actRows = r.activities.map((a) => `
      <tr><td>${esc(a.name)}</td><td>${a.times}</td><td>${a.points}</td></tr>`).join('')

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>التقرير الشهري — ${esc(r.mosque.name)} — ${esc(r.month)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;700&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', system-ui, sans-serif; color: #1c1c1a; margin: 0; padding: 24px; background: #fff; }
  .sheet { max-width: 760px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f6e56; padding-bottom: 12px; margin-bottom: 16px; }
  .head h1 { font-size: 20px; margin: 0 0 4px; color: #0f6e56; }
  .head .sub { font-size: 13px; color: #5f5e5a; }
  .badge { font-size: 12px; padding: 4px 10px; border-radius: 8px; background: #e1f5ee; color: #0f6e56; white-space: nowrap; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
  .card { background: #f4f3ee; border-radius: 10px; padding: 12px; }
  .card .lab { font-size: 12px; color: #5f5e5a; }
  .card .val { font-size: 22px; font-weight: 700; }
  .ok { color: #0f6e56; }
  h2 { font-size: 15px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: right; }
  th { background: #f1efe8; font-weight: 500; }
  .foot { margin-top: 24px; font-size: 12px; color: #888780; display: flex; justify-content: space-between; }
  .sign { margin-top: 36px; display: flex; justify-content: space-between; font-size: 13px; }
  @media print { body { padding: 0; } @page { size: A4; margin: 14mm; } .noprint { display: none; } }
  .btn { background: #0f6e56; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font: inherit; cursor: pointer; }
</style>
</head>
<body>
<div class="sheet">
  <button class="btn noprint" onclick="window.print()">طباعة / حفظ PDF</button>
  <div class="head">
    <div>
      <h1>التقرير الشهري — ${esc(r.mosque.name)}</h1>
      <div class="sub">مسار ${trackAr} · الشهر ${esc(r.month)} · مشروع المسجد المؤثر</div>
    </div>
    <span class="badge">${r.allApproved ? 'معتمد نهائياً' : 'قيد الاعتماد'}</span>
  </div>

  <div class="cards">
    <div class="card"><div class="lab">مجموع نقاط الشهر</div><div class="val">${r.monthTotal}<span style="font-size:13px;color:#888780"> / ${r.monthlyTarget}</span></div></div>
    <div class="card"><div class="lab">نسبة الإنجاز</div><div class="val ok">${r.achievementPct}%</div></div>
    <div class="card"><div class="lab">القيمة المستحقة</div><div class="val ok">${r.money === null ? '—' : '$' + r.money}</div></div>
  </div>

  <h2>النقاط الأسبوعية</h2>
  <table>
    <thead><tr><th>#</th><th>بداية الأسبوع (السبت)</th><th>النقاط</th><th>الحالة</th></tr></thead>
    <tbody>${weekRows || '<tr><td colspan="4">لا سجلات لهذا الشهر</td></tr>'}</tbody>
  </table>

  <h2>تفصيل الأنشطة</h2>
  <table>
    <thead><tr><th>النشاط</th><th>عدد المرات</th><th>النقاط</th></tr></thead>
    <tbody>${actRows || '<tr><td colspan="3">لا أنشطة</td></tr>'}</tbody>
  </table>

  <div class="sign">
    <span>توقيع أمير المسجد: ............................</span>
    <span>اعتماد الإدارة: ............................</span>
  </div>
  <div class="foot">
    <span>وُلّد آلياً من منصة المسجد المؤثر</span>
    <span>المعدّل: 280 نقطة = 50$ · الاستحقاق لأمير المسجد</span>
  </div>
</div>
</body>
</html>`
}
