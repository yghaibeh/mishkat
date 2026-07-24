// قوالب شاشات مشكاة — تُستهلك من صفحات العرض (فاتح/داكن) ومن index.html
const CDN = 'https://unpkg.com/lucide-static@0.462.0/icons/';
const I = (n, s) => `<i class="ic" ${s ? `style="--m:url(${CDN}${n}.svg);${s}"` : `style="--m:url(${CDN}${n}.svg)"`}></i>`;
const AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
export const arabicNum = (n) => String(n).replace(/[0-9]/g, (c) => AR[+c]);

const NAV = [
  ['house','الرئيسية',1],['landmark','مسجدي',0],['calendar-days','النشاطات',0],
  ['library','المكتبة',0],['book-open','المنهاج',0],['ellipsis','المزيد',0],
];
const bottomNav = () => `<nav class="bottomnav">${NAV.map(([ic,t,on]) =>
  `<button class="navi${on ? ' on' : ''}"><span class="pill">${I(ic,'width:21px;height:21px')}</span><span class="t">${t}</span></button>`).join('')}</nav>`;

export function amirHome() {
  return `<div class="phone">
  <header style="padding:14px 20px 12px;flex:none">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:var(--fs-title);line-height:var(--lh-title);font-weight:700">مشكاة</span>
      <span class="chip role">أمير المسجد</span>
      <span style="flex:1"></span>
      <button class="iconbtn">${I('bell','width:22px;height:22px')}<span class="badge">٣</span></button>
    </div>
    <div style="font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--text-2);margin-top:2px">مسجد خالد بن الوليد · مربع الوعر · منطقة حمص</div>
    <div style="font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--gold);font-weight:500">الجمعة ٩ صفر ١٤٤٨هـ</div>
  </header>
  <div class="scroll" style="padding:4px 16px 170px;gap:20px">
    <div class="card" style="padding:var(--sp-5);box-shadow:var(--shadow-2);display:flex;align-items:center;gap:var(--sp-5)">
      <div style="position:relative;width:112px;height:112px;flex:none">
        <svg width="112" height="112" viewBox="0 0 112 112" style="transform:scaleX(-1) rotate(-90deg)">
          <circle cx="56" cy="56" r="48" fill="none" stroke="var(--surface-2)" stroke-width="10"></circle>
          <circle cx="56" cy="56" r="48" fill="none" stroke="var(--primary)" stroke-width="10" stroke-linecap="round" stroke-dasharray="301.6" stroke-dashoffset="124.9"></circle>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <span style="font-size:30px;font-weight:700;line-height:1">٤١</span>
          <span style="font-size:11px;color:var(--text-3);margin-top:2px">من ٧٠ نقطة</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
        <span style="font-size:var(--fs-section);line-height:var(--lh-section);font-weight:600">أين أنا من هدف الأسبوع؟</span>
        <span style="color:var(--text-2)">بقي ٢٩ نقطة</span>
        <span style="font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--text-3)">آخر إدخال أمس: نشاطان</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <span style="font-size:var(--fs-section);line-height:var(--lh-section);font-weight:600">ماذا بقي عليّ اليوم؟</span>
      <div class="card" style="overflow:hidden">
        <div class="ds-hover" style="display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:64px;cursor:pointer">
          <span style="width:40px;height:40px;border-radius:var(--r-full);background:var(--warning-bg);color:var(--warning-fg);display:flex;align-items:center;justify-content:center;flex:none">${I('pen-line','width:19px;height:19px')}</span>
          <span style="flex:1;font-weight:600">سجل اليوم لم يُدخل بعد</span>
          ${I('chevron-left','width:18px;height:18px;background:var(--text-3)')}
        </div>
        <div class="ds-hover" style="display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:64px;cursor:pointer;border-top:1px solid var(--border)">
          <span style="width:40px;height:40px;border-radius:var(--r-full);background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;flex:none">${I('badge-check','width:19px;height:19px')}</span>
          <span style="flex:1;font-weight:600">اعتمادان بانتظارك</span>
          ${I('chevron-left','width:18px;height:18px;background:var(--text-3)')}
        </div>
      </div>
    </div>
  </div>
  <div class="sticky"><button class="cta ds-btn">${I('pen-line','width:18px;height:18px')}إدخال سجل اليوم</button></div>
  ${bottomNav()}
</div>`;
}

const STUDENTS = [
  ['أحمد الصفدي','أ‍ص','present',1],['محمد الخطيب','م‍خ','present',0],['عبد الرحمن نجار','ع‍ن','present',0],
  ['يوسف العلي','ي‍ع','absent',0],['عمر الأتاسي','ع‍أ','present',0],['معاذ الحمصي','م‍ح','present',0],
  ['بلال درويش','ب‍د','absent',0],['سعيد الرفاعي','س‍ر','present',0],
];
const evalBlock = (open) => `
  <div class="eval" style="flex-direction:column;gap:8px;padding:2px 0 10px 0${open ? '' : ';display:none'}" data-editor${open ? ' data-open' : ''}>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:12px;font-weight:600;color:var(--text-2);min-width:44px">حفظ</span>
      <span style="position:relative;display:inline-block">
        <select style="appearance:none;height:34px;padding:0 10px;padding-inline-end:30px;border-radius:var(--r-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text-1);font:400 13px/1 var(--font);cursor:pointer">
          <option>النبأ</option><option>النازعات</option><option>عبس</option><option>التكوير</option>
        </select>
        ${I('chevron-down','width:15px;height:15px;background:var(--text-3);position:absolute;inset-inline-end:9px;top:10px;pointer-events:none')}
      </span>
      <span class="step"><button data-step="1">${I('plus','width:15px;height:15px')}</button><span class="v" data-val="6">٦<span class="u">آية</span></span><button data-step="-1">${I('minus','width:15px;height:15px')}</button></span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:12px;font-weight:600;color:var(--text-2);min-width:44px">مراجعة</span>
      <span style="display:flex;gap:6px" data-chips><button class="fc on">متقن</button><button class="fc">جيد</button><button class="fc">يعيد</button></span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:12px;font-weight:600;color:var(--text-2);min-width:44px">تجويد</span>
      <span style="display:flex;gap:6px" data-chips><button class="fc on">ممتاز</button><button class="fc">جيد</button><button class="fc">يُحسَّن</button></span>
    </div>
  </div>`;

export function halaqaLog() {
  const present = STUDENTS.filter((s) => s[2] === 'present').length;
  return `<div class="phone">
  <header style="padding:10px 12px 10px 20px;flex:none;display:flex;align-items:center;gap:4px">
    <button class="iconbtn">${I('chevron-right','width:22px;height:22px')}</button>
    <div style="flex:1;min-width:0">
      <div style="font-size:var(--fs-section);line-height:var(--lh-section);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">حلقة أبي بن كعب</div>
      <div style="font-size:var(--fs-caption);line-height:var(--lh-caption);color:var(--text-2)">الثلاثاء ١٣ محرم</div>
    </div>
    <span class="chip mut">صباحية</span>
  </header>
  <div style="padding:6px 16px 12px;flex:none">
    <div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:12px">
      <span style="font-size:var(--fs-section);font-weight:700"><span data-counter>${arabicNum(present)}</span> <span style="font-weight:400;color:var(--text-2);font-size:var(--fs-body)">من ٨</span></span>
      <span style="font-size:var(--fs-caption);color:var(--text-2)">حضر</span>
      <span style="flex:1"></span>
      <span style="display:flex;gap:3px" data-dots>${STUDENTS.map((s) => `<span style="width:14px;height:6px;border-radius:3px;background:${s[2] === 'present' ? 'var(--primary)' : 'var(--surface-2)'}"></span>`).join('')}</span>
    </div>
  </div>
  <div class="scroll" style="padding:0 16px 140px">
    <div class="card" style="overflow:hidden">
      ${STUDENTS.map(([name, init, state, open], i) => `
      <div class="srow" data-state="${state}" style="padding:10px 16px;${i ? 'border-top:1px solid var(--border)' : ''}">
        <div style="display:flex;align-items:center;gap:12px;min-height:48px">
          <span class="av who">${init}</span>
          <span class="who" style="flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
          <span class="pillbox">
            <button class="pseg p" data-att="present">${I('check','width:16px;height:16px')}حاضر</button>
            <button class="pseg a" data-att="absent">${I('x','width:16px;height:16px')}غائب</button>
          </span>
        </div>
        ${evalBlock(!!open)}
      </div>`).join('')}
    </div>
  </div>
  <div class="sticky" style="bottom:0;padding-bottom:20px"><div class="hint">يمكنك التعديل حتى منتصف الليل</div><button class="cta ds-btn">${I('save','width:18px;height:18px')}حفظ سجل اليوم</button></div>
</div>`;
}

const REGIONS = [
  ['حمص','٩٤٪','٣',[5,6,6,7,6,7,8]],
  ['دمشق','٩١٪','٢',[6,6,7,6,7,7,7]],
  ['حلب','٨٧٪','٤',[7,6,6,5,6,6,7]],
  ['حماة','٨١٪','٧',[6,5,5,4,4,3,4]],
  ['اللاذقية','٧٦٪','١',[3,4,4,5,5,6,6]],
];
const spark = (v) => `<span class="spark">${v.map((h, i) => `<i style="height:${h * 3}px" class="${i === v.length - 1 ? 'hi' : ''}"></i>`).join('')}</span>`;

export function adminDash() {
  return `<div class="desk">
  <aside style="width:248px;flex:none;display:flex;flex-direction:column;background:var(--surface);border-inline-end:1px solid var(--border)">
    <div style="padding:22px 20px 10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:var(--fs-title);font-weight:700">مشكاة</span>
      <span class="chip role">المدير العام</span>
    </div>
    <nav style="display:flex;flex-direction:column;gap:2px;padding:10px 12px;flex:1">
      <button class="side on">${I('layout-dashboard')}<span style="flex:1">اللوحة</span></button>
      <button class="side ds-hover">${I('map')}<span style="flex:1">المناطق</span></button>
      <button class="side ds-hover">${I('landmark')}<span style="flex:1">المساجد</span><span class="cnt">٤٠٠</span></button>
      <button class="side ds-hover">${I('badge-check')}<span style="flex:1">الاعتمادات</span><span class="cnt" style="background:var(--danger-bg);color:var(--danger-fg)">١٧</span></button>
      <button class="side ds-hover">${I('users')}<span style="flex:1">الكوادر</span></button>
      <button class="side ds-hover">${I('chart-column')}<span style="flex:1">التقارير</span></button>
    </nav>
    <div style="padding:14px 16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <span class="av" style="width:36px;height:36px;background:var(--gold-bg);color:var(--gold);font-size:13px">ع‍م</span>
      <span style="font-size:var(--fs-caption);font-weight:600">عبد الله المصري</span>
    </div>
  </aside>
  <main style="flex:1;min-width:0;overflow-y:auto;padding:26px 28px 28px;display:flex;flex-direction:column;gap:22px">
    <div style="display:flex;align-items:baseline;gap:12px">
      <span style="font-size:var(--fs-title);line-height:var(--lh-title);font-weight:700">لوحة المدير العام</span>
      <span style="font-size:var(--fs-caption);color:var(--gold);font-weight:500">الجمعة ٩ صفر ١٤٤٨هـ</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
      <div class="stat"><span class="l">مساجد أدخلت سجل اليوم</span><span class="v">٣١٢ <span style="font-size:var(--fs-body);color:var(--text-2);font-weight:500">من ٤٠٠</span></span><span class="c">${I('trending-up','width:14px;height:14px;background:var(--success-fg)')}٧٨٪ من الشبكة</span></div>
      <div class="stat"><span class="l">اعتمادات متأخرة</span><span class="v" style="color:var(--danger-fg)">١٧</span><span class="c">تجاوزت ٤٨ ساعة</span></div>
      <div class="stat"><span class="l">مواضع شاغرة</span><span class="v" style="color:var(--warning-fg)">٥</span><span class="c">بانتظار ترشيح</span></div>
      <div class="stat"><span class="l">حلقات نشطة هذا الأسبوع</span><span class="v" style="color:var(--success-fg)">٨٩٪</span><span class="c">${I('trending-up','width:14px;height:14px;background:var(--success-fg)')}أعلى من الأسبوع الماضي</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <span style="font-size:var(--fs-section);font-weight:600">يحتاج نظرك</span>
      <div class="card" style="overflow:hidden">
        <div class="ds-hover" style="display:flex;align-items:center;gap:14px;padding:14px 20px;cursor:pointer">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--danger-fg);flex:none"></span>
          <span style="flex:1;font-weight:600">منطقة حماة: ٧ مساجد بلا إدخال منذ ٣ أيام</span>
          <span class="chip bad">عاجل</span>
          ${I('chevron-left','width:18px;height:18px;background:var(--text-3)')}
        </div>
        <div class="ds-hover" style="display:flex;align-items:center;gap:14px;padding:14px 20px;cursor:pointer;border-top:1px solid var(--border)">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--warning-fg);flex:none"></span>
          <span style="flex:1;font-weight:600">اعتماد خطة مسجد الرحمن معلّق منذ ٤٨ ساعة</span>
          <span class="chip warn">متوسط</span>
          ${I('chevron-left','width:18px;height:18px;background:var(--text-3)')}
        </div>
        <div class="ds-hover" style="display:flex;align-items:center;gap:14px;padding:14px 20px;cursor:pointer;border-top:1px solid var(--border)">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--text-3);flex:none"></span>
          <span style="flex:1;font-weight:600">موضع محفّظ شاغر في حلقة الفجر — مرشحان جاهزان</span>
          <span class="chip mut">منخفض</span>
          ${I('chevron-left','width:18px;height:18px;background:var(--text-3)')}
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <span style="font-size:var(--fs-section);font-weight:600">المناطق</span>
      <div class="card" style="overflow:hidden">
        <table class="regions">
          <thead><tr>
            <th><span style="display:inline-flex;align-items:center;gap:4px">المنطقة${I('chevrons-up-down','width:13px;height:13px;background:var(--text-3)')}</span></th>
            <th><span style="display:inline-flex;align-items:center;gap:4px">نسبة الإدخال${I('arrow-down','width:13px;height:13px;background:var(--primary)')}</span></th>
            <th>المتأخر</th>
            <th>اتجاه أسبوعي</th>
          </tr></thead>
          <tbody>
          ${REGIONS.map(([r, p, l, s]) => `<tr class="ds-hover">
            <td style="font-weight:600">${r}</td><td>${p}</td>
            <td${+l.replace(/[٠-٩]/g, (c) => AR.indexOf(c)) >= 5 ? ' style="color:var(--danger-fg);font-weight:600"' : ''}>${l}</td>
            <td>${spark(s)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </main>
</div>`;
}

// تفاعلات: حضور/غياب + فتح المحرر + رقائق + عدّادات
export function wire(root) {
  root.addEventListener('click', (e) => {
    const att = e.target.closest('[data-att]');
    if (att) {
      const row = att.closest('.srow');
      const cur = row.getAttribute('data-state');
      const next = cur === att.dataset.att ? 'none' : att.dataset.att;
      row.setAttribute('data-state', next);
      const scope = row.closest('.phone') || root;
      const rows = [...scope.querySelectorAll('.srow')];
      const n = rows.filter((r) => r.getAttribute('data-state') === 'present').length;
      const c = scope.querySelector('[data-counter]');
      if (c) c.textContent = arabicNum(n);
      const dots = scope.querySelector('[data-dots]');
      if (dots) [...dots.children].forEach((d, i) => { d.style.background = rows[i].getAttribute('data-state') === 'present' ? 'var(--primary)' : 'var(--surface-2)'; });
      return;
    }
    const chip = e.target.closest('[data-chips] .fc');
    if (chip) { [...chip.parentElement.children].forEach((c) => c.classList.toggle('on', c === chip)); return; }
    const st = e.target.closest('[data-step]');
    if (st) {
      const v = st.parentElement.querySelector('[data-val]');
      const n = Math.max(1, Math.min(99, +v.dataset.val + +st.dataset.step));
      v.dataset.val = n;
      v.innerHTML = `${arabicNum(n)}<span class="u">آية</span>`;
      return;
    }
    const who = e.target.closest('.srow .who');
    if (who) {
      const row = who.closest('.srow');
      if (row.getAttribute('data-state') === 'present') {
        const ed = row.querySelector('[data-editor]');
        ed.style.display = ed.style.display === 'none' || !ed.style.display ? 'flex' : 'none';
      }
    }
  });
}
