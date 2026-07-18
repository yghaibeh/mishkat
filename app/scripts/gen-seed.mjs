// مولّد بذرة ضخمة للقسمين (ذكور/نساء) — الفصل التام. حتميّ (PRNG ببذرة ثابتة).
// تشغيل: node scripts/gen-seed.mjs > src/server/database/seed_big.sql
// البنية: الإدارة العليا (مشتركة) → قسم (men/women) → منطقة → مربع → [مسجد+حلقات (ذكور)] | [حلقة+طالبات+دروس (نساء)]
const PW = "pbkdf2$100000$8T/B/AaCUb7IZ0bystvNjw==$LxZKTHYFK9tz1EnXiZLfi4Je5xflHrh4ndYv1TrR+qA="; // = mishkat123
const NOW = Date.now(); // حيّ: بذرةُ تجربةٍ بتواريخ اليوم (كانت مجمّدة 2025-07 فتقرأ «هذا الأسبوع/الشهر» صفراً — بلاغ المالك ٢٠٢٦-٠٧-١٨). المعرفاتُ تبقى حتميةً عبر PRNG الثابت.
// مساعدات هجرية/أسبوعية حيّة (مطابقة لدوال utils/week.ts)
const _hp = (d) => Object.fromEntries(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
const HM = (t = NOW) => { const p = _hp(new Date(t)); return `${p.year}-${String(p.month).padStart(2, "0")}`; };
const HD = (t = NOW) => { const p = _hp(new Date(t)); return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`; };
const weekStartSat = (t = NOW) => { const x = new Date(t); const diff = (x.getUTCDay() - 6 + 7) % 7; x.setUTCDate(x.getUTCDate() - diff); return x.toISOString().slice(0, 10); };
const THIS_HM = HM(); const THIS_WEEK = weekStartSat(); const PREV_WEEK = weekStartSat(NOW - 7 * 86_400_000);
const hmPlus = (i) => { const [y, m] = THIS_HM.split("-").map(Number); const t = (y * 12 + (m - 1) + i); return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
const DAY = 86400000;

// PRNG حتميّ (mulberry32) + معرّفات تسلسلية
let _s = 0x1234abcd;
const R = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rint = (a, b) => Math.floor(a + R() * (b - a + 1));
const pick = (a) => a[Math.floor(R() * a.length)];
const chance = (p) => R() < p;
let _u = 0; const uid = (p) => `${p}${(++_u).toString(36)}`;

const MALE = ["محمد","أحمد","عبدالله","عمر","خالد","يوسف","إبراهيم","مصطفى","حسن","حسين","علي","سعيد","طارق","ياسر","أنس","زيد","بلال","حمزة","سلمان","عثمان","معاذ","أيمن","عبدالرحمن","صهيب","أسامة"];
const FEMALE = ["فاطمة","عائشة","مريم","خديجة","زينب","أسماء","رقية","سمية","هدى","نور","صفية","حفصة","آمنة","سارة","ليلى","رنا","دعاء","إسراء","جنى","سلمى"];
const SUR = ["الحموي","الإدلبي","الحلبي","الشامي","الخطيب","العمر","القاسم","الأحمد","الحسن","النعسان","الزعبي","الرفاعي","الكردي","الجاسم","الصالح","المحمد","البكري","الحريري","الديب","السالم"];
const MOSQUE = ["الفاروق","النور","التقوى","الهدى","الرحمة","القدس","بلال","حمزة","عثمان","الصحابة","الإيمان","الفتح","التوحيد","السلام","الأنصار","البخاري","الفرقان","الصديق","خالد","سعد","النصر","قباء","الرحمن","العزيز","الوفاء"];
const HALAQA = ["أم إبراهيم","أم أحمد","أم خالد","أم عبدالله","أم محمد","أم عمر","أم يوسف","أم سلمى","أم رقية","أم حفصة","أم أنس","أم البراء","أم الزبير","أم معاذ","أم زيد","أم عبدالرحمن"];
const SQ = ["المدينة","الشمالي","الجنوبي","الشرقي","الغربي","الوسط","الجديد","القديم"];
const QUAL = ["إجازة في القرآن","بكالوريوس شريعة","حافظة متقنة","دبلوم تربية",null];
const MAJALIS = ["المجلس الأول: النية","المجلس الثاني: الإخلاص","المجلس الثالث: الصلاة","المجلس الرابع: الصحبة","المجلس الخامس: بر الوالدين","المجلس السادس: حسن الخلق"];
const LESSON = ["مدارسة على بصيرة","تثبيت الحفظ","تزكية وسلوك","فقه العبادات","سيرة نبوية","آداب طالبة العلم"];
// رموز محافظات صحيحة من lib/syria-regions.ts (تُترجَم عربيًّا عبر govLabel)
const GOVS_M = [["حلب","aleppo"],["إدلب","idlib"],["حماة","hama"]];
const GOVS_W = [["حلب","aleppo"],["إدلب","idlib"],["اللاذقية","latakia"]];
const DIST = { aleppo: ["jabal_semaan","azaz","albab","afrin"], idlib: ["harem","ariha","jisr_shughur","maarrat_numan"], hama: ["masyaf","suqaylabiyah","mahardah","salamiyah"], latakia: ["haffah","jableh","qardaha"] };
const distOf = (gid) => pick(DIST[gid] ?? [null]);

const rows = {};
const add = (t, r) => { (rows[t] ??= []).push(r); };
const nm = (g) => `${pick(g === "male" ? MALE : FEMALE)} ${pick(g === "male" ? SUR : SUR)}`;

const persons = [], menMosques = [], amirs = [], teacherRows = [], venueRows = [], circleIds = [], allHalaqat = [];
function person(name, gender, home) { const id = uid("zp"); add("persons", { id, full_name: name, gender, birth_year_hijri: rint(1380, 1432), home_org_unit_id: home, status: "active", created_at: NOW }); persons.push({ id, gender }); return id; }
function user(personId, login, last) { add("users", { id: uid("zu"), person_id: personId, login, password_hash: PW, last_login: last ?? null, mfa_secret: null, mfa_enabled: 0, created_at: NOW }); }
function role(personId, role_, unitId, unitPath, portfolio) { add("role_assignments", { id: uid("zra"), person_id: personId, role: role_, org_unit_id: unitId, org_path: unitPath, portfolio: portfolio ?? null, start_date: NOW - rint(60, 700) * DAY, end_date: null, term_number: 1, approval_status: "approved", approved_by: "u-admin", created_at: NOW }); }
const org = (o) => add("org_units", { city: null, governorate: null, district: null, status: "active", created_at: NOW, ...o });

// ===== الإدارة العليا (مشتركة فوق القسمين) =====
const pAdmin = person("المدير العام", "male", null);
add("users", { id: "u-admin", person_id: pAdmin, login: "admin", password_hash: PW, last_login: NOW, mfa_secret: null, mfa_enabled: 0, created_at: NOW });
add("role_assignments", { id: "ra-admin", person_id: pAdmin, role: "admin", org_unit_id: "men", org_path: "/", portfolio: null, start_date: NOW, end_date: null, term_number: 1, approval_status: "approved", approved_by: null, created_at: NOW });

const LOGIN = {}; // login ثابت لأول وحدة من كل نوع بكل قسم

function buildSection(section, gt, govs) {
  const root = section; const rootPath = `/${root}/`;
  org({ id: root, parent_id: null, path: rootPath, type: "section", section, gender_track: gt, name: section === "men" ? "قسم الذكور" : "قسم النساء" });
  const pHead = person(section === "men" ? "المشرف العام للذكور" : "المشرفة العامة للنساء", section === "men" ? "male" : "female", root);
  user(pHead, section === "men" ? "head_men" : "head_women", NOW - rint(0, 4) * DAY); role(pHead, "section_head", root, rootPath);

  govs.forEach(([gname, gid], gi) => {
    const regId = uid("zr"), regPath = `${rootPath}${regId}/`;
    org({ id: regId, parent_id: root, path: regPath, type: "rabita", section, gender_track: gt, name: `منطقة ${gname}`, city: gname, governorate: gid });
    const pReg = person((section === "men" ? "مسؤول منطقة " : "مسؤولة منطقة ") + gname, section === "men" ? "male" : "female", regId);
    role(pReg, "rabita", regId, regPath);
    if (gi === 0) user(pReg, section === "men" ? "region_men" : "region_women");

    const sqCount = rint(2, 3);
    for (let s = 0; s < sqCount; s++) {
      const sqId = uid("zq"), sqPath = `${regPath}${sqId}/`, sqName = `مربع ${SQ[s % SQ.length]} ${gname}`;
      org({ id: sqId, parent_id: regId, path: sqPath, type: "square", section, gender_track: gt, name: sqName, city: gname, governorate: gid, district: distOf(gid) });
      const pSq = person((section === "men" ? "مسؤول " : "مسؤولة ") + sqName, section === "men" ? "male" : "female", sqId);
      role(pSq, "square", sqId, sqPath);
      if (gi === 0 && s === 0) user(pSq, section === "men" ? "square_men" : "square_women");
      if (section === "men") menSquare(sqId, sqPath, gname, gid, gi === 0 && s === 0);
      else womenSquare(sqId, sqPath, gname, gid, gi === 0 && s === 0);
    }
  });
}

const ACT_MALE = [["m_family_meeting",1],["m_ala_baseera",2],["m_lesson_mosque",2],["m_quran",1],["m_lecture_attend",1],["m_lessons",1],["m_media_post",1]];
function menSquare(sqId, sqPath, gname, gid, firstSq) {
  const n = rint(5, 8);
  for (let m = 0; m < n; m++) {
    const mid = uid("zm"), mpath = `${sqPath}${mid}/`, mname = `مسجد ${pick(MOSQUE)}`;
    org({ id: mid, parent_id: sqId, path: mpath, type: "mosque", section: "men", gender_track: "male", name: mname, city: gname, governorate: gid, district: distOf(gid) });
    menMosques.push({ id: mid, path: mpath });
    const pAmir = person("أمير " + mname, "male", mid); role(pAmir, "amir", mid, mpath);
    if (firstSq && m === 0) user(pAmir, "amir", NOW - rint(0, 6) * DAY); else if (chance(0.5)) user(pAmir, uid("zam"));
    const recentPts = chance(0.1) ? null : pick([rint(58, 75), rint(58, 75), rint(42, 55), rint(20, 39), rint(0, 19)]);
    amirs.push({ personId: pAmir, mosqueId: mid, mosquePath: mpath, recentPoints: recentPts });
    // أسرة المسجد
    for (const [r_, pf] of [["deputy","نائب"],["secretary","أمانة السر"],["treasurer","الصندوق"],["committee","الدعوة"],["committee","الإغاثة"]]) if (chance(0.6)) { const pp = person(nm("male"), "male", mid); role(pp, r_, mid, mpath, pf); }
    for (let k = 0; k < rint(4, 8); k++) { const pp = person(nm("male"), "male", mid); role(pp, chance(0.7) ? "member" : "participant", mid, mpath); if (chance(0.15)) teacherRows.push({ personId: pp, unit: sqId, path: sqPath }); }
    // حلقات المسجد
    for (let c = 0; c < rint(1, 3); c++) { const cid = uid("zc"); const ty = pick(["tahfeez","rashidi","ala_baseera"]); add("circles", { id: cid, mosque_id: mid, type: ty, gender_track: "male", name: `حلقة ${ty === "tahfeez" ? "تحفيظ" : ty === "rashidi" ? "الرشيدي" : "على بصيرة"}`, teacher_person_id: null, capacity: rint(15, 30), notes: null, status: "active", created_at: NOW }); circleIds.push(cid); }
    // سجل أسبوعي حديث + إدخالات
    if (recentPts !== null) {
      const status = pick(["draft","draft","amir_approved","layer_approved"]);
      const wid = uid("zwr"); let tot = 0;
      for (let e = 0; e < rint(3, 7); e++) { const [aid, pts] = pick(ACT_MALE); const cnt = rint(1, 4); const p = pts * cnt; tot += p; add("daily_entries", { id: uid("zde"), client_uuid: uid("cu"), weekly_record_id: wid, mosque_id: mid, week_start: "2025-12-06", day: pick(["sat","sun","mon","tue","wed"]), activity_type_id: aid, count: cnt, points: p, note: null, participant_count: rint(1, 9), shura_confirmed: 1, entered_by: null, entered_by_committee: null, recorded_at: NOW, synced_at: NOW }); }
      add("weekly_records", { id: wid, mosque_id: mid, mosque_path: mpath, week_start: chance(0.5) ? THIS_WEEK : PREV_WEEK, hijri_month: THIS_HM, scheme_id: "scheme-male", total_points: tot, status, locked: status === "layer_approved" ? 1 : 0, locked_at: status === "layer_approved" ? NOW - 2 * DAY : null, last_entry_at: NOW - rint(0, 8) * DAY, approved_by_amir: status !== "draft" ? "u-admin" : null, approved_by_layer: status === "layer_approved" ? "u-admin" : null, created_at: NOW - rint(1, 10) * DAY });
    }
  }
}

let teacherWDone = false, mushrifaDone = false;
function womenSquare(sqId, sqPath, gname, gid, firstSq) {
  const n = rint(3, 5);
  for (let h = 0; h < n; h++) {
    const hid = uid("zh"), hpath = `${sqPath}${hid}/`, hname = `حلقة نسائية — ${pick(HALAQA)}`;
    org({ id: hid, parent_id: sqId, path: hpath, type: "halaqa", section: "women", gender_track: "female", name: hname, city: gname, governorate: gid, district: distOf(gid) });
    // المشرفة (amir على الحلقة)
    const pMush = person("المشرفة " + nm("female"), "female", hid); role(pMush, "amir", hid, hpath);
    if (firstSq && h === 0 && !mushrifaDone) { user(pMush, "mushrifa", NOW - rint(0, 5) * DAY); mushrifaDone = true; }
    // المعلّمة + مكان (بيت) + سجل على بصيرة
    const pTe = person("المعلّمة " + nm("female"), "female", hid); const tid = uid("zt");
    add("teachers", { id: tid, person_id: pTe, qualification: pick(QUAL), hourly_rate_id: "rate-hour-current", active: 1, created_at: NOW });
    role(pTe, "teacher", sqId, sqPath); teacherRows.push({ personId: pTe, id: tid, unit: sqId, path: sqPath });
    if (firstSq && h === 0 && !teacherWDone) { user(pTe, "teacher_w"); teacherWDone = true; }
    const vid = uid("zv"); add("venues", { id: vid, type: "home", name: hname, org_unit_id: hid, gender_track: "female", created_at: NOW }); venueRows.push(vid);
    const halId = uid("zhl"); add("halaqat", { id: halId, name: hname, venue_id: vid, teacher_id: tid, gender_track: "female", curriculum: "baseera", capacity: rint(10, 20), status: "active", created_at: NOW }); allHalaqat.push(halId);
    // طالبات ثابتات
    const st = rint(8, 15); const enr = [];
    for (let s = 0; s < st; s++) { const eid = uid("ze"); add("enrollments", { id: eid, halaqa_id: halId, person_id: "", student_name: nm("female"), status: chance(0.92) ? "active" : "withdrawn", created_at: NOW - rint(10, 120) * DAY }); enr.push(eid); }
    // دروس + كشف حضور (حاضرة/غائبة/مستأذنة) لكل طالبة + تقييمات + من اعتمد
    for (let l = 0; l < rint(2, 5); l++) {
      const lid = uid("zls");
      const status = pick(["recorded","approved","approved","rejected"]);
      let present = 0;
      for (const en of enr) { const state = pick(["present","present","present","absent","excused"]); if (state === "present") present++; add("lesson_attendance", { id: uid("zla"), lesson_session_id: lid, enrollment_id: en, state, note: null, created_at: NOW - rint(1, 40) * DAY }); }
      add("lesson_sessions", { id: lid, halaqa_id: halId, teacher_id: tid, date_hijri: HD(NOW - rint(0, 20) * DAY), hijri_month: THIS_HM, lesson_title: pick(LESSON), majlis: pick(MAJALIS), duration_hours: pick([1, 1.5, 2]), materials: null, attendance_count: present, self_eval: rint(3, 5), companion_activities: pick(["زيارة مريضة","جولة دعوية","توزيع مطويات",null]), status, rejection_reason: status === "rejected" ? "يلزم استكمال التقرير" : null, approved_by: status === "approved" ? "u-admin" : null, created_at: NOW - rint(1, 40) * DAY });
      for (const en of enr) if (chance(0.5)) add("student_evaluations", { id: uid("zse"), enrollment_id: en, lesson_session_id: lid, score: rint(60, 100), note: chance(0.3) ? pick(["ممتازة","تحتاج مراجعة","متقدّمة","ملتزمة"]) : null, created_at: NOW });
    }
  }
}

buildSection("men", "male", GOVS_M);
buildSection("women", "female", GOVS_W);

// ===== على بصيرة إضافية للذكور (معاهد/مساجد ضمن قسم الذكور فقط) =====
const menVenueRows = []; // أماكن قسم الذكور حصرًا (لا نخلط بأماكن النساء)
for (let i = 0; i < 20; i++) { const id = uid("zv"); add("venues", { id, type: pick(["mosque","institute"]), name: `${pick(["معهد","مركز","دار"])} ${pick(MOSQUE)}`, org_unit_id: pick(menMosques).id, gender_track: "male", created_at: NOW }); menVenueRows.push(id); venueRows.push(id); }
for (const tp of teacherRows.filter((t) => !t.id).slice(0, 60)) { tp.id = uid("zt"); add("teachers", { id: tp.id, person_id: tp.personId, qualification: pick(QUAL), hourly_rate_id: "rate-hour-current", active: 1, created_at: NOW }); }
const menTeachers = teacherRows.filter((t) => t.id && t.path && t.path.startsWith("/men/"));
for (let i = 0; i < 80; i++) { const id = uid("zhl"); const tchr = pick(menTeachers); add("halaqat", { id, name: `حلقة ${pick(["الفجر","العصر","النور","الإتقان","الصدّيق"])} ${i + 1}`, venue_id: pick(menVenueRows), teacher_id: tchr.id, gender_track: "male", curriculum: pick(["baseera","tahfeez","rashidi"]), capacity: pick([15, 20, 25, 30]), status: "active", created_at: NOW }); allHalaqat.push(id);
  // شمول القسم الرجالي (بلاغ المالك): طلاب ودروس هذا الشهر — كانت الحلقات الرجالية قشوراً (طلاب=0، ساعات=0)
  const menr = []; for (let sN = 0; sN < rint(6, 16); sN++) { const eid = uid("ze"); add("enrollments", { id: eid, halaqa_id: id, person_id: "", student_name: nm("male"), status: chance(0.92) ? "active" : "withdrawn", created_at: NOW - rint(10, 120) * DAY }); menr.push(eid); }
  for (let l = 0; l < rint(1, 4); l++) { const lid = uid("zls"); const lst = pick(["recorded", "approved", "approved"]); let present = 0;
    for (const en of menr) { const state = pick(["present", "present", "present", "absent", "excused"]); if (state === "present") present++; add("lesson_attendance", { id: uid("zla"), lesson_session_id: lid, enrollment_id: en, state, note: null, created_at: NOW - rint(1, 20) * DAY }); }
    add("lesson_sessions", { id: lid, halaqa_id: id, teacher_id: tchr.id, date_hijri: HD(NOW - rint(0, 20) * DAY), hijri_month: THIS_HM, lesson_title: pick(LESSON), majlis: pick(MAJALIS), duration_hours: pick([1, 1.5, 2]), materials: null, attendance_count: present, self_eval: rint(3, 5), companion_activities: null, status: lst, rejection_reason: null, approved_by: lst === "approved" ? "u-admin" : null, created_at: NOW - rint(1, 20) * DAY });
    for (const en of menr) if (chance(0.4)) add("student_evaluations", { id: uid("zse"), enrollment_id: en, lesson_session_id: lid, score: rint(60, 100), note: null, created_at: NOW }); }
}

// ===== المالية (نقاط الأمراء + ساعات المعلّمات/ين) =====
const rate = 50 / 280; let entN = 0;
for (const a of amirs) { if (!a.recentPoints || !chance(0.6) || entN++ > 90) continue; const amount = Math.round(a.recentPoints * rate * 100) / 100; const eid = uid("zent"); const status = pick(["proposed","proposed","approved","paid"]); add("monthly_entitlements", { id: eid, person_id: a.personId, month: THIS_HM, gross_amount: amount, currency: "USD", status, approved_by: status === "proposed" ? null : "u-admin", created_at: NOW }); add("entitlement_tracks", { id: uid("zetk"), entitlement_id: eid, kind: "points", basis: a.recentPoints, rate, amount, source_ref: a.mosqueId }); if (status === "paid") add("payouts", { id: uid("zpo"), entitlement_id: eid, net_amount: amount, paid_amount: amount, reference: `حوالة ${rint(1000, 9999)}`, recorded_by: "u-admin", paid_at: NOW - rint(1, 20) * DAY }); }
for (const t of menTeachers.slice(0, 40)) { const hours = rint(4, 30); const amount = Math.round(hours * 2 * 100) / 100; const eid = uid("zent"); const status = pick(["proposed","approved","paid"]); add("monthly_entitlements", { id: eid, person_id: t.personId, month: THIS_HM, gross_amount: amount, currency: "USD", status, approved_by: status === "proposed" ? null : "u-admin", created_at: NOW }); add("entitlement_tracks", { id: uid("zetk"), entitlement_id: eid, kind: "hours", basis: hours, rate: 2, amount, source_ref: "ala_baseera" }); }

// ===== المسابقة (قسم الذكور) =====
const compId = uid("zcomp"); add("competitions", { id: compId, name: "مسابقة المسجد المؤثر 1447–1448", start_month: "1447-07", end_month: "1448-07", qualification_month: "1448-06", prize_pool: 25000, status: "active", created_at: NOW });
const programs = []; for (let i = 0; i < 8; i++) { const pid = uid("zmp"); add("monthly_programs", { id: pid, competition_id: compId, month_hijri: hmPlus(i - 4), track: pick(["worship","knowledge","activities"]), title: pick(["حفظ جزء","ختمة تدبر","دورة علمية","نشاط دعوي"]), max_points: pick([50, 100, 150]) }); programs.push(pid); }
const menPersons = persons.filter((p) => p.gender === "male").slice(0, 400); let partN = 0;
for (const p of menPersons) { if (!chance(0.6) || partN++ > 300) continue; const partId = uid("zpart"); add("participants", { id: partId, competition_id: compId, person_id: p.id, mosque_id: pick(menMosques).id, age_at_registration: rint(15, 40), status: pick(["active","active","qualified","withdrawn"]), created_at: NOW }); for (const prog of programs) if (chance(0.5)) add("participant_scores", { id: uid("zpsc"), participant_id: partId, program_id: prog, points: rint(0, 150), excuse_status: chance(0.85) ? "none" : "excused", recorded_by: "u-admin", created_at: NOW }); }

// ===== مالية المسجد + اجتماعات + تحفيظ (عيّنة للذكور) =====
for (const m of menMosques) { if (chance(0.4)) { for (let i = 0; i < rint(1, 3); i++) add("donations", { id: uid("zdon"), mosque_id: m.id, donor_name: chance(0.4) ? null : nm("male"), amount: pick([50, 100, 200, 500]), collected_by: "u-admin", approved_by_amir: 1, note: null, at: NOW - rint(1, 90) * DAY }); for (let i = 0; i < rint(1, 2); i++) add("expenses", { id: uid("zexp"), mosque_id: m.id, category: pick(["كهرباء","ماء","صيانة","تدفئة"]), amount: pick([30, 60, 120, 250]), spent_by: "u-admin", note: null, at: NOW - rint(1, 90) * DAY }); }
  if (chance(0.3)) { const cId = uid("ztc"); add("tahfeez_circles", { id: cId, mosque_id: m.id, name: pick(["حلقة الفجر","حلقة الصغار","حلقة الإتقان"]), teacher_person_id: pick(persons).id, created_at: NOW }); for (let i = 0; i < rint(3, 8); i++) { const sId = uid("zts"); add("tahfeez_students", { id: sId, circle_id: cId, person_id: pick(menPersons).id, status: "active", created_at: NOW }); for (let j = 0; j < rint(1, 2); j++) add("tahfeez_progress", { id: uid("ztp"), student_id: sId, scope: pick(["سورة البقرة","جزء عمّ","سورة الكهف"]), from_ayah: 1, to_ayah: rint(10, 50), rating: rint(3, 5), date_hijri: HD(NOW - rint(1, 15) * DAY), created_at: NOW }); } } }

// ===== بيانات اتصال (خصوصية — جدول منفصل) =====
for (const p of persons) if (chance(0.5)) add("person_contacts", { person_id: p.id, phone: `09${rint(10000000, 99999999)}`, telegram: chance(0.4) ? `@user${p.id.slice(1, 6)}` : null, guardian_phone: chance(0.15) ? `09${rint(10000000, 99999999)}` : null });

// ===== طلاب حلقات المسجد (circle_students) =====
for (const cid of circleIds) if (chance(0.6)) for (let i = 0; i < rint(4, 12); i++) add("circle_students", { id: uid("zcs"), circle_id: cid, name: nm("male"), notes: chance(0.2) ? "منتظم" : null, status: chance(0.9) ? "active" : "left", created_at: NOW });

// ===== حوافز تشغيلية (اختيارية) =====
for (let i = 0; i < 15; i++) add("incentives", { id: uid("zinc"), person_id: pick(persons).id, recipient_name: nm("male"), month: THIS_HM, reason: pick(["تجهيز مراوح","دعم دورة","مكافأة تميّز","صيانة طارئة"]), amount: pick([50, 100, 150, 200]), created_by: "u-admin", created_at: NOW });

// ===== اختبارات المسابقة المركزية + النتائج =====
const partIds = (rows.participants ?? []).map((p) => p.id);
for (let i = 0; i < 3; i++) { const eid = uid("zce"); add("central_exams", { id: eid, competition_id: compId, title: `الاختبار المركزي ${i + 1}`, date_hijri: `1447-${String(9 + i * 2).padStart(2, "0")}-15`, max_score: 100, created_at: NOW }); for (const pid of partIds) if (chance(0.5)) add("exam_results", { id: uid("zer"), exam_id: eid, participant_id: pid, score: rint(40, 100), created_at: NOW }); }

// ===== اجتماعات الشورى + الحضور + القرارات (الذكور) =====
for (const m of menMosques) if (chance(0.35)) {
  const meetId = uid("zmt"), voters = rint(5, 9), present = rint(Math.ceil(voters / 2), voters);
  add("meetings", { id: meetId, mosque_id: m.id, type: pick(["periodic","periodic","extraordinary"]), called_by: "u-admin", scheduled_at: NOW - rint(1, 60) * DAY, member_count: voters, minutes: chance(0.6) ? "نوقشت خطة اللجان واعتُمدت الموازنة الشهرية." : null, created_at: NOW });
  for (let i = 0; i < voters; i++) add("meeting_attendance", { id: uid("zma"), meeting_id: meetId, person_id: pick(persons).id, present: i < present ? 1 : 0 });
  for (let d = 0; d < rint(1, 3); d++) { const vf = rint(Math.ceil(present / 2), present); add("decisions", { id: uid("zdc"), meeting_id: meetId, title: pick(["إقرار خطة اللجنة","تكليف عضو جديد","اعتماد الموازنة","تنظيم نشاط دعوي"]), kind: pick(["binding","advisory"]), votes_for: vf, votes_against: present - vf, total_voters: present, amir_vote_for: 1, result: vf > present / 2 ? "passed" : "failed", note: null }); }
}

// ===== لجان المسجد + خططها (الذكور) =====
const COMMS = [["الدعوة والتربية الشرعية","main"],["العلاقات العامة","main"],["الإغاثة","main"],["الإعلام والنشر","sub"],["الصيانة والنظافة","sub"]];
for (const m of menMosques) if (chance(0.4)) for (const [cn, ct] of COMMS) if (chance(0.6)) { const cid = uid("zcm"); add("committees", { id: cid, mosque_id: m.id, name: cn, type: ct, head_person_id: pick(persons).id, head_name: nm("male"), status: "active", created_at: NOW }); for (let i = 0; i < rint(1, 4); i++) add("committee_plans", { id: uid("zcp"), committee_id: cid, title: pick(["دورة شرعية","حملة إغاثية","نشرة إعلامية","نشاط طلابي"]), period: null, recurring: chance(0.3) ? 1 : 0, month_hijri: chance(0.7) ? `1447-${String(rint(6, 12)).padStart(2, "0")}` : null, status: pick(["planned","done","cancelled"]), created_at: NOW }); }

// ===== سجلّ الحلقة الأسبوعي + أنشطة الحلقة الجماعية (القسمان) =====
for (const hid of allHalaqat) if (chance(0.4)) {
  add("weekly_halaqa_records", { id: uid("zwh"), halaqa_id: hid, week_start: "2025-12-06", supervisor_notes: chance(0.5) ? "أداء المعلّم/ة ممتاز والالتزام جيّد." : null, admin_notes: chance(0.3) ? "تُشكر الحلقة على نشاطها." : null, created_at: NOW });
  for (let s = 0; s < rint(1, 4); s++) add("halaqa_group_activities", { id: uid("zga"), halaqa_id: hid, week_start: "2025-12-06", seq: s + 1, description: pick(["زيارة مريض","درس عام لشيخ ضيف","جولة دعوية وتوزيع مطويات","نشاط رياضي/ترفيهي","تنظيف المكان","ملتقى طلابي"]), date_hijri: `1447-06-${String(rint(1, 28)).padStart(2, "0")}`, created_at: NOW });
}

// ===== استقالات (عيّنة) =====
for (let i = 0; i < 6; i++) { const ra = pick(rows.role_assignments); add("resignations", { id: uid("zrs"), role_assignment_id: ra.id, person_id: ra.person_id, reason: pick(["ظروف خاصة","انتقال سكن","انشغال دراسي"]), requested_at: NOW - rint(5, 40) * DAY, decision_deadline: NOW + rint(1, 25) * DAY, status: pick(["pending","accepted","rejected"]), decided_by: chance(0.5) ? "u-admin" : null, decided_at: chance(0.5) ? NOW - rint(1, 10) * DAY : null }); }

// ===== إعدادات التطبيق =====
add("app_settings", { key: "point_rate_note", value: "المعدّل 50$/280 نقطة — قابل للتعديل بأثر قادم", updated_at: NOW });
add("app_settings", { key: "hourly_rate_note", value: "سعر الساعة 2$ — قابل للتعديل", updated_at: NOW });
add("app_settings", { key: "weekly_target", value: "70", updated_at: NOW });

// ===== إشعارات =====
for (let i = 0; i < 120; i++) add("notifications", { id: uid("zn"), person_id: pick(persons).id, channel: pick(["telegram","inapp","inapp"]), kind: pick(["entry_reminder","term_ending","layer_approval_needed","week_approved","week_rejected"]), payload: null, status: pick(["queued","sent","sent"]), created_at: NOW - rint(0, 30) * DAY, sent_at: chance(0.6) ? NOW - rint(0, 30) * DAY : null, read_at: chance(0.4) ? NOW - rint(0, 10) * DAY : null });

// =====================================================================
// ===== توسعةٌ شاملة: كأنّ النظامَ مكتمل — كلُّ الموديلات لها بيانات =====
// =====================================================================
const menPersonIds = persons.filter((p) => p.gender === "male").map((p) => p.id);
const HIJRI = THIS_HM;
const dh = () => `1447-${String(rint(4, 6)).padStart(2, "0")}-${String(rint(1, 28)).padStart(2, "0")}`;

// ===== المسؤول الماليّ (حسابٌ للتجريب) =====
const pFinance = person("المسؤول الماليّ", "male", null);
add("users", { id: "u-finance", person_id: pFinance, login: "finance", password_hash: PW, last_login: NOW - DAY, mfa_secret: null, mfa_enabled: 0, created_at: NOW });
add("role_assignments", { id: "ra-finance", person_id: pFinance, role: "finance_officer", org_unit_id: "men", org_path: "/", portfolio: null, start_date: NOW - 90 * DAY, end_date: null, term_number: 1, approval_status: "approved", approved_by: "u-admin", created_at: NOW });
add("person_contacts", { person_id: pFinance, phone: "0955123456", telegram: "@finance_officer", guardian_phone: null });

// ===== الدفتر المحاسبيّ (قيودٌ متوازنةٌ حتمًا: Σمدين=Σدائن) =====
function je(source, ref, memoTxt, hijri, lines, whenDaysAgo) {
  const eid = uid("zje");
  add("journal_entries", { id: eid, entry_date: NOW - (whenDaysAgo ?? rint(3, 170)) * DAY, date_hijri: hijri, memo: memoTxt, source, source_ref: ref, reversal_of: null, created_by: "u-admin", created_at: NOW });
  for (const l of lines) add("journal_lines", { id: uid("zjl"), entry_id: eid, account_id: l.acc, fund_id: l.fund, debit_cents: Math.round((l.d || 0) * 100), credit_cents: Math.round((l.c || 0) * 100), currency: l.cur ?? null, amount_orig: l.ao ?? null });
  return eid;
}
// أرصدةٌ افتتاحيّة لكلّ صندوق (Dr نقد/بنك — Cr الرصيد المرحَّل 3100)
const OPEN = { general: 12000, zakat: 8000, sadaqah: 4000, waqf: 6000, projects: 3000 };
for (const [fund, amt] of Object.entries(OPEN)) je("opening", `1110:${fund}`, "رصيدٌ افتتاحيّ (نقد)", HIJRI, [{ acc: "1110", fund, d: amt * 0.6 }, { acc: "3100", fund, c: amt * 0.6 }], 170);
for (const [fund, amt] of Object.entries(OPEN)) je("opening", `1120:${fund}`, "رصيدٌ افتتاحيّ (بنك)", HIJRI, [{ acc: "1120", fund, d: amt * 0.4 }, { acc: "3100", fund, c: amt * 0.4 }], 170);
// رصيدٌ افتتاحيٌّ بالليرة السوريّة (تعدّد العملات)
je("opening", "1115:general", "رصيدٌ افتتاحيّ (ل.س)", HIJRI, [{ acc: "1115", fund: "general", d: 500, cur: "SYP", ao: 6500000 }, { acc: "3100", fund: "general", c: 500 }], 170);
// تبرّعاتٌ مركزيّة مُرحَّلة (Dr نقد / Cr التبرّعات)
for (let i = 0; i < 40; i++) { const fund = pick(["general", "general", "zakat", "sadaqah", "waqf", "projects"]); const amt = pick([100, 200, 300, 500, 750, 1000]); je("donation", uid("dref"), `تبرّعٌ لصندوق ${fund}`, dh(), [{ acc: pick(["1110", "1110", "1120"]), fund, d: amt }, { acc: "4100", fund, c: amt }]); }
// مصروفاتٌ تشغيليّة مُرحَّلة (Dr مصروف / Cr نقد)
for (let i = 0; i < 30; i++) { const fund = pick(["general", "general", "waqf", "projects"]); const amt = pick([40, 80, 120, 200, 350]); const acc = pick(["5200", "5200", "5300"]); je("expense", uid("eref"), pick(["كهرباء وماء", "صيانة", "تدفئة", "قرطاسية", "محروقات مولّد"]), dh(), [{ acc, fund, d: amt }, { acc: "1110", fund, c: amt }]); }
// رواتبُ مصروفة (Dr الرواتب / Cr نقد)
for (let i = 0; i < 12; i++) { const amt = pick([50, 100, 150, 200]); je("payout", uid("pref"), "راتبٌ/مكافأةٌ مصروفة", HIJRI, [{ acc: "5100", fund: "general", d: amt }, { acc: "1110", fund: "general", c: amt }]); }

// ===== المانحون + التعهّدات =====
const donorIds = [];
for (let i = 0; i < 30; i++) { const id = uid("zdnr"); add("donors", { id, name: nm("male"), phone: chance(0.7) ? `09${rint(10000000, 99999999)}` : null, note: chance(0.2) ? pick(["محسنٌ دائم", "من أهل الخير", "يفضّل الوقف"]) : null, created_at: NOW - rint(30, 300) * DAY }); donorIds.push(id); }
for (const did of donorIds) if (chance(0.5)) { const amount = pick([500, 1000, 2000, 5000]); const fulfilled = chance(0.4) ? amount : Math.round(amount * pick([0, 0.25, 0.5, 0.75]) * 100) / 100; add("pledges", { id: uid("zplg"), donor_id: did, fund_id: pick(["general", "waqf", "projects", "zakat"]), amount, fulfilled, due_at: NOW + rint(10, 120) * DAY, status: fulfilled >= amount ? "fulfilled" : "open", note: chance(0.3) ? "تعهّدٌ لمشروع المصلّى" : null, created_by: "u-admin", created_at: NOW - rint(10, 90) * DAY }); }

// ===== الموازنات (لكلّ صندوقٍ لفترتين) =====
for (const period of ["1447-05", THIS_HM]) for (const fund of ["general", "zakat", "sadaqah", "waqf", "projects"]) if (chance(0.8)) add("budgets", { id: uid("zbdg"), period, fund_id: fund, account_id: pick(["5100", "5200", "5300"]), amount: pick([1000, 2000, 3000, 5000]), note: null, created_by: "u-admin", created_at: NOW - rint(20, 80) * DAY });

// ===== مطالبات الصرف (معلّق/معتمَد/مرفوض) =====
for (let i = 0; i < 20; i++) { const st = pick(["pending", "pending", "approved", "rejected"]); const rq = pick(["u-finance", "u-admin"]); add("expense_claims", { id: uid("zclm"), mosque_id: pick(menMosques).id, fund_id: pick(["general", "waqf", "projects"]), category: pick(["صيانة سبورة", "شراء مكيّف", "طباعة مطويات", "أدوات نظافة", "إكرام ضيف"]), amount: pick([60, 120, 250, 400, 600]), note: chance(0.4) ? "مرفقٌ الإيصال" : null, status: st, requested_by: rq, requested_at: NOW - rint(2, 40) * DAY, decided_by: st === "pending" ? null : "u-admin", decided_at: st === "pending" ? null : NOW - rint(1, 20) * DAY, reject_reason: st === "rejected" ? pick(["يتجاوز الموازنة", "يلزم عرضُ سعرٍ ثانٍ", "بندٌ غيرُ ضروريّ الآن"]) : null, expense_id: null, receipt_url: chance(0.3) ? "/media/receipt-sample.jpg" : null }); }

// ===== السُلَف =====
for (let i = 0; i < 10; i++) { const principal = pick([200, 300, 500, 800]); const repaid = Math.round(principal * pick([0, 0.2, 0.5]) * 100) / 100; add("staff_advances", { id: uid("zadv"), person_id: pick(menPersonIds), principal, balance: principal - repaid, monthly_deduction: pick([50, 80, 100]), fund_id: "general", status: principal - repaid <= 0 ? "settled" : "active", note: chance(0.3) ? "سلفةٌ تُستردّ أقساطًا" : null, created_by: "u-admin", created_at: NOW - rint(20, 120) * DAY }); }

// ===== الصناديق النثريّة + حركاتها =====
for (let i = 0; i < 4; i++) { const bid = uid("zpcb"); const float = pick([200, 300, 500]); const spent = Math.round(float * pick([0.2, 0.4, 0.6]) * 100) / 100; add("petty_cash_boxes", { id: bid, name: pick(["نثرية الإدارة", "نثرية اللجان", "نثرية الصيانة", "نثرية الضيافة"]), custodian_person_id: pick(menPersonIds), custodian_name: nm("male"), float_amount: float, balance: float - spent, fund_id: "general", status: "active", created_by: "u-admin", created_at: NOW - rint(30, 100) * DAY }); let rem = spent; for (let j = 0; j < rint(2, 5) && rem > 0; j++) { const a = Math.min(rem, pick([10, 20, 30, 50])); rem -= a; add("petty_cash_txns", { id: uid("zpct"), box_id: bid, kind: "expense", amount: a, category: pick(["قرطاسية", "ضيافة", "مواصلات", "أدوات"]), note: null, created_by: "u-finance", created_at: NOW - rint(1, 25) * DAY }); } add("petty_cash_txns", { id: uid("zpct"), box_id: bid, kind: "open", amount: float, category: null, note: "فتحُ الصندوق", created_by: "u-admin", created_at: NOW - rint(30, 100) * DAY }); }

// ===== الأصول الثابتة + الإهلاك =====
for (let i = 0; i < 8; i++) { const aid = uid("zfa"); const cost = pick([600, 900, 1200, 2400, 5000]); const life = pick([12, 24, 36, 48]); const salvage = Math.round(cost * 0.1); add("fixed_assets", { id: aid, name: pick(["حاسوب مكتبيّ", "مكيّف", "مولّد كهرباء", "طابعة", "سبّورة ذكيّة", "نظام صوت", "مركبة نقل", "أثاث مكتب"]), cost, salvage_value: salvage, useful_life_months: life, start_period: "1447-01", fund_id: pick(["general", "projects", "waqf"]), status: "active", note: null, created_by: "u-admin", created_at: NOW - rint(60, 200) * DAY }); const monthly = Math.round(((cost - salvage) / life) * 100) / 100; for (let m = 1; m <= rint(2, 5); m++) add("depreciation_runs", { id: uid("zdep"), fixed_asset_id: aid, period: `1447-${String(m).padStart(2, "0")}`, amount: monthly, created_at: NOW - (6 - m) * 20 * DAY }); }

// ===== دفعات الصرف المجمّعة + بنودها =====
for (let i = 0; i < 5; i++) { const bid = uid("zpb"); const paid = chance(0.5); add("payment_batches", { id: bid, title: pick(["مكافآت المعلّمين 1447-06", "دفعة أمراء المساجد", "بدلات مواصلات", "دعم اللجان"]), period: HIJRI, fund_id: "general", status: paid ? "paid" : "draft", created_by: "u-finance", created_at: NOW - rint(5, 40) * DAY, paid_by: paid ? "u-admin" : null, paid_at: paid ? NOW - rint(1, 15) * DAY : null }); for (let j = 0; j < rint(3, 8); j++) add("payment_batch_items", { id: uid("zpbi"), batch_id: bid, person_name: nm("male"), amount: pick([50, 75, 100, 150]), note: null, created_at: NOW - rint(5, 40) * DAY }); }

// ===== أسعار الصرف (تاريخيّة) =====
for (const [cur, base] of [["SYP", 0.0000769], ["TRY", 0.031]]) for (let k = 0; k < 3; k++) add("fx_rates", { id: uid("zfx"), currency: cur, rate_to_base: cur === "SYP" ? base * (1 - k * 0.05) : base * (1 - k * 0.03), effective_at: NOW - k * 20 * DAY, created_by: "u-admin", created_at: NOW - k * 20 * DAY });

// ===== المطابقة البنكيّة (وسمُ بعض القيود مطابَقة) =====
const bankEntries = (rows.journal_lines ?? []).filter((l) => l.account_id === "1120").slice(0, 12);
for (const l of bankEntries) if (chance(0.6)) add("reconciliations", { id: uid("zrec"), entry_id: l.entry_id, account_id: "1120", reconciled_by: "u-admin", reconciled_at: NOW - rint(1, 20) * DAY, note: null });

// ===== تعديلات الرواتب (بدلات/خصومات) =====
for (let i = 0; i < 16; i++) add("payroll_adjustments", { id: uid("zpadj"), person_id: pick(menPersonIds), month: HIJRI, kind: pick(["allowance", "allowance", "deduction"]), amount: pick([20, 30, 50, 75]), note: pick(["بدلُ مواصلات", "بدلُ سكن", "خصمُ غياب", "مكافأةُ تميّز"]), created_by: "u-admin", created_at: NOW - rint(5, 30) * DAY });

// ===== أفعالُ محرّك الاعتماد (معلّقٌ للتجربة + تاريخٌ منفَّذ/مرفوض) =====
const demoMosque = menMosques[0].id;
const PENDING = [
  { kind: "budget_set", payload: { period: HIJRI, fundId: "projects", amount: 1500 }, summary: "ضبطُ موازنة مشاريع بـ$1,500", amt: 0 },
  { kind: "fx_rate_set", payload: { currency: "TRY", rateToBase: 0.032 }, summary: "تحديثُ سعر صرف ₺", amt: 0 },
  { kind: "expense_add", payload: { mosqueId: demoMosque, category: "صيانة مكيّفات", amount: 180, fund: "general" }, summary: "مصروفُ «صيانة مكيّفات» $180 من صندوق general", amt: 180 },
  { kind: "petty_open", payload: { name: "نثرية الطوارئ", floatAmount: 250 }, summary: "فتحُ صندوقٍ نثريّ «نثرية الطوارئ» بسقف $250", amt: 250 },
  { kind: "advance_grant", payload: { personId: pick(menPersonIds), principal: 400, monthlyDeduction: 80 }, summary: "منحُ سلفةٍ $400 تُستردُّ $80 شهريًّا", amt: 400 },
];
let faN = 0;
for (const a of PENDING) { const id = uid("zfa2"); add("finance_actions", { id, kind: a.kind, payload: JSON.stringify(a.payload), summary: a.summary, amount_usd: a.amt, currency: null, orig_amount: null, status: "pending", proposed_by: "u-finance", proposed_at: NOW - (++faN) * 2 * DAY, decided_by: null, decided_at: null, reject_reason: null, executed_at: null, result_ref: null, error: null, resubmit_of: null, client_uuid: uid("cufa"), created_at: NOW - faN * 2 * DAY }); }
// تاريخٌ: منفَّذان + مرفوض
add("finance_actions", { id: uid("zfa2"), kind: "donation_add", payload: JSON.stringify({ mosqueId: demoMosque, amount: 300, donorName: "محسن", fund: "general" }), summary: "تبرّعٌ $300 لصندوق general", amount_usd: 300, currency: null, orig_amount: null, status: "executed", proposed_by: "u-finance", proposed_at: NOW - 12 * DAY, decided_by: "u-admin", decided_at: NOW - 11 * DAY, reject_reason: null, executed_at: NOW - 11 * DAY, result_ref: "R-000123", error: null, resubmit_of: null, client_uuid: uid("cufa"), created_at: NOW - 12 * DAY });
add("finance_actions", { id: uid("zfa2"), kind: "budget_set", payload: JSON.stringify({ period: HIJRI, fundId: "general", amount: 4000 }), summary: "ضبطُ موازنة عامّة $4,000", amount_usd: 0, currency: null, orig_amount: null, status: "executed", proposed_by: "u-finance", proposed_at: NOW - 10 * DAY, decided_by: "u-admin", decided_at: NOW - 9 * DAY, reject_reason: null, executed_at: NOW - 9 * DAY, result_ref: null, error: null, resubmit_of: null, client_uuid: uid("cufa"), created_at: NOW - 10 * DAY });
add("finance_actions", { id: uid("zfa2"), kind: "expense_add", payload: JSON.stringify({ mosqueId: demoMosque, category: "أثاث فاخر", amount: 2000, fund: "general" }), summary: "مصروفُ «أثاث فاخر» $2,000", amount_usd: 2000, currency: null, orig_amount: null, status: "rejected", proposed_by: "u-finance", proposed_at: NOW - 8 * DAY, decided_by: "u-admin", decided_at: NOW - 7 * DAY, reject_reason: "يتجاوز حاجةَ الشهر — قدِّم بندًا أدنى", executed_at: null, result_ref: null, error: null, resubmit_of: null, client_uuid: uid("cufa"), created_at: NOW - 8 * DAY });
// إشعاراتُ المال (queued — بحمولةٍ مُهيكَلة كي تُعرَض وتُرسَل)
for (const a of PENDING.slice(0, 3)) add("notifications", { id: uid("zn2"), person_id: pAdmin, channel: "inapp", kind: "finance_proposal", payload: JSON.stringify({ summary: a.summary, amountUsd: a.amt }), status: "queued", created_at: NOW - rint(1, 6) * DAY, sent_at: null, read_at: null });
add("notifications", { id: uid("zn2"), person_id: pFinance, channel: "inapp", kind: "finance_decision", payload: JSON.stringify({ outcome: "rejected", summary: "مصروفُ «أثاث فاخر» $2,000", reason: "يتجاوز حاجةَ الشهر — قدِّم بندًا أدنى" }), status: "sent", created_at: NOW - 7 * DAY, sent_at: NOW - 7 * DAY, read_at: null });
add("notifications", { id: uid("zn2"), person_id: pFinance, channel: "inapp", kind: "finance_decision", payload: JSON.stringify({ outcome: "approved", summary: "تبرّعٌ $300 لصندوق general" }), status: "sent", created_at: NOW - 11 * DAY, sent_at: NOW - 11 * DAY, read_at: NOW - 10 * DAY });

// ===== المكتبة التدريبيّة: موادّ + إنجاز =====
const MAT = [["دليل الأمير", "leadership", "pdf", "amir"], ["أساسيّات على بصيرة", "education", "pdf", "teacher"], ["مهارات الإشراف", "supervision", "link", "supervisor"], ["فقه إدارة المسجد", "management", "pdf", "amir"], ["التعامل مع الشباب", "education", "audio", "all"], ["إعداد التقارير", "admin", "pdf", "amir"], ["أمن المعلومات", "tech", "link", "all"], ["الإسعافات الأوّليّة", "safety", "pdf", "all"]];
const matIds = [];
MAT.forEach(([title, cat, kind, aud], i) => { const id = uid("zmat"); matIds.push({ id, aud }); add("materials", { id, title, category: cat, kind, external_url: kind === "link" ? "https://example.org/material" : null, content_type: kind === "pdf" ? "application/pdf" : kind === "audio" ? "audio/mpeg" : null, size_bytes: kind === "pdf" ? rint(200000, 5000000) : null, description: "مادّةٌ تدريبيّةٌ إلزاميّةٌ ضمن مسار التأهيل.", audience: aud, sort_order: i + 1, status: "active", created_by: "u-admin", created_at: NOW - rint(30, 200) * DAY }); });
// إنجازُ الموادّ لأصحاب الأدوار (أمراء/معلّمون)
for (const a of amirs.slice(0, 40)) for (const m of matIds) if ((m.aud === "amir" || m.aud === "all") && chance(0.6)) { const opened = chance(0.8); const done = opened && chance(0.6); add("material_progress", { id: uid("zmp"), material_id: m.id, person_id: a.personId, delivered_at: NOW - rint(20, 90) * DAY, opened_at: opened ? NOW - rint(5, 60) * DAY : null, completed_at: done ? NOW - rint(1, 40) * DAY : null }); }

// ===== الاختبارات والواجبات (مسجد + حلقة) =====
const examIds = [];
for (let i = 0; i < 10; i++) { const eid = uid("zex"); const kind = pick(["exam", "homework"]); const scope = pick(["mosque", "circle"]); const st = pick(["published", "published", "closed", "draft"]); const mid = pick(menMosques).id; examIds.push({ id: eid, scope, scopeId: scope === "mosque" ? mid : pick(circleIds), mid }); add("exams", { id: eid, scope_kind: scope, scope_id: scope === "mosque" ? mid : pick(circleIds), mosque_id: mid, kind, title: kind === "exam" ? pick(["اختبار على بصيرة", "اختبار الفقه", "مراجعة الوحدة"]) : pick(["واجب الحفظ", "تلخيص الدرس", "بحثٌ قصير"]), description: "أجب عن الأسئلة قبل انتهاء الوقت.", publish_at: NOW - rint(5, 30) * DAY, due_at: NOW + rint(-5, 15) * DAY, status: st, created_by: "u-admin", created_by_name: "المدير العام", created_at: NOW - rint(10, 40) * DAY }); }
for (const ex of examIds) { const qn = rint(3, 6); for (let q = 0; q < qn; q++) { const isMcq = chance(0.6); add("exam_questions", { id: uid("zeq"), exam_id: ex.id, sort_order: q + 1, kind: isMcq ? "mcq" : "tf", text: isMcq ? pick(["ما حكمُ صلاة الجماعة؟", "متى يجب الوضوء؟", "ما أوّلُ أركان الإسلام؟"]) : pick(["الصلاةُ عمودُ الدين.", "الوضوءُ لا ينتقض بالنوم.", "الزكاةُ ركنٌ من أركان الإسلام."]), options: isMcq ? JSON.stringify(["واجبة", "سنّة مؤكّدة", "مستحبّة", "مباحة"]) : null, correct: isMcq ? "0" : pick(["true", "false"]), points: 1 }); } }
for (const ex of examIds) if (ex.scope) { const subn = rint(2, 8); for (let s = 0; s < subn; s++) { const maxS = rint(3, 6); add("exam_submissions", { id: uid("zes"), exam_id: ex.id, person_id: pick(menPersonIds), person_name: nm("male"), answers: JSON.stringify({ "0": "0", "1": "true" }), score: rint(1, maxS), max_score: maxS, submitted_at: NOW - rint(1, 20) * DAY }); } }

// ===== النشاطات والمتابعة =====
const actIds = [];
for (let i = 0; i < 12; i++) { const aid = uid("zac"); const scope = pick(["mosque", "circle"]); const mid = pick(menMosques).id; actIds.push(aid); add("activities", { id: aid, scope_kind: scope, scope_id: scope === "mosque" ? mid : pick(circleIds), mosque_id: mid, title: pick(["زيارة مريض", "جولة دعوية", "حملة نظافة المسجد", "توزيع مطويات", "لقاء تعارف"]), details: "شارك وأرسل ردَّك بما أنجزتَه.", due_at: NOW + rint(-3, 10) * DAY, status: pick(["published", "published", "closed"]), created_by: "u-admin", created_by_name: "المدير العام", created_at: NOW - rint(5, 30) * DAY }); }
for (const aid of actIds) { const rn = rint(1, 6); for (let r = 0; r < rn; r++) add("activity_responses", { id: uid("zar"), activity_id: aid, person_id: pick(menPersonIds), person_name: nm("male"), body: pick(["أنجزتُ المهمّةَ وزرتُ ثلاثةَ بيوت.", "شاركتُ في الحملة والحمد لله.", "وزّعتُ ٥٠ مطويّة.", "تمّ اللقاء بحضورٍ جيّد."]), submitted_at: NOW - rint(1, 20) * DAY, review_status: pick(["pending", "seen", "accepted"]), reviewed_by: chance(0.5) ? "u-admin" : null }); }

// ===== العُهد والأصول التشغيليّة + المحروقات =====
const assetIds = [];
for (let i = 0; i < 15; i++) { const id = uid("zas"); const kind = pick(["personal_custody", "vehicle", "equipment"]); const m = pick(menMosques); assetIds.push({ id, kind }); add("assets", { id, kind, name: kind === "vehicle" ? pick(["سيّارة نقل", "دراجة ناريّة", "حافلة صغيرة"]) : kind === "equipment" ? pick(["مكبّر صوت", "خيمة", "طاولات", "كراسي"]) : pick(["حاسوب محمول", "هاتف", "كاميرا"]), details: chance(0.4) ? "بحالةٍ جيّدة" : null, org_unit_id: m.id, org_path: m.path, holder_person_id: pick(menPersonIds), holder_name: nm("male"), status: pick(["active", "active", "returned"]), created_by: "u-admin", created_at: NOW - rint(30, 200) * DAY, updated_at: NOW - rint(1, 30) * DAY }); }
for (const a of assetIds.filter((x) => x.kind === "vehicle")) for (let m = 4; m <= 6; m++) add("asset_expenses", { id: uid("zae"), asset_id: a.id, month: `1447-${String(m).padStart(2, "0")}`, fuel_amount: pick([40, 60, 80, 100]), other_amount: chance(0.4) ? pick([20, 50]) : 0, note: chance(0.3) ? "تغيير زيت" : null, created_by: "u-admin", created_at: NOW - (6 - m) * 20 * DAY });

// ===== الإعلانات =====
for (let i = 0; i < 8; i++) add("announcements", { id: uid("zann"), title: pick(["تحديثُ نظام النقاط", "موعدُ الاختبار المركزيّ", "حملةُ الشتاء", "دورةٌ تدريبيّة للأمراء", "تهنئةٌ بالعام الهجريّ"]), body: "نُعلمكم بالتفاصيل التالية… بارك الله في جهودكم جميعًا.", scope_path: pick(["/", "/men/", "/women/"]), audience: pick(["all", "leaders", "students"]), sent_count: rint(20, 300), created_by: "u-admin", created_by_name: "المدير العام", created_at: NOW - rint(1, 40) * DAY });

// ===== الزيارات الإشرافيّة =====
for (let i = 0; i < 25; i++) { const m = pick(menMosques); const st = pick(["draft", "submitted", "approved", "approved"]); add("supervision_visits", { id: uid("zsv"), circle_kind: pick(["tahfeez", "baseera"]), circle_ref_id: pick(circleIds), circle_name: pick(["حلقة الفجر", "حلقة على بصيرة", "حلقة التحفيظ"]), mosque_id: m.id, unit_path: m.path, submitter_path: m.path, visited_by: "u-admin", visited_by_name: "المشرف الميدانيّ", visit_date_hijri: dh(), monthly_visit_no: rint(1, 3), student_count: rint(8, 25), final_score: rint(60, 98), notes: chance(0.6) ? pick(["أداءٌ ممتاز والتزامٌ جيّد", "يلزم تحسينُ الحضور", "الحلقةُ نشطةٌ ومنظّمة"]) : null, details: null, status: st, approved_by: st === "approved" ? "u-admin" : null, approved_by_name: st === "approved" ? "المدير العام" : null, created_at: NOW - rint(2, 50) * DAY, updated_at: NOW - rint(1, 30) * DAY }); }

// ===== طلبات الانضمام (معلّقة للتجربة) =====
for (let i = 0; i < 8; i++) { const kind = pick(["student", "teacher", "amir"]); const m = pick(menMosques); add("registration_requests", { id: uid("zreg"), kind, full_name: nm("male"), gender: "male", login: kind === "student" ? null : `applicant${i}`, password_hash: kind === "student" ? null : PW, phone: `09${rint(10000000, 99999999)}`, target_unit_id: m.id, target_path: m.path, proposed_unit_name: null, proposed_parent_id: null, circle_id: kind === "student" ? pick(circleIds) : null, note: chance(0.4) ? "أرغبُ في الانضمام والمشاركة" : null, status: pick(["pending", "pending", "approved", "rejected"]), decided_by: null, decided_by_name: null, decided_at: null, reject_reason: null, created_unit_id: null, created_person_id: null, created_user_id: null, created_at: NOW - rint(1, 20) * DAY }); }

// ===== جلسات التحفيظ اليوميّة + سجلّاتها =====
const tcircles = (rows.tahfeez_circles ?? []).slice(0, 30);
const tstudents = rows.tahfeez_students ?? [];
for (const tc of tcircles) { const studs = tstudents.filter((s) => s.circle_id === tc.id); if (!studs.length) continue; for (let d = 0; d < rint(2, 4); d++) { const sid = uid("zths"); add("tahfeez_sessions", { id: sid, circle_id: tc.id, date_hijri: dh(), day_no: rint(1, 30), mosque_id: tc.mosque_id, created_by: "u-admin", created_at: NOW - rint(1, 30) * DAY }); for (const s of studs) if (chance(0.85)) add("tahfeez_daily_records", { id: uid("zthr"), session_id: sid, student_id: s.id, attendance: pick(["present", "present", "present", "absent", "excused"]), hifz_scope: "surah", hifz_from: rint(1, 5), hifz_to: rint(6, 20), hifz_grade: pick(["ممتاز", "جيّد جدًّا", "جيّد"]), hifz_mode: "surah", hifz_surah: rint(1, 30), review_scope: "surah", review_from: 1, review_to: rint(5, 15), review_grade: pick(["ممتاز", "جيّد"]), review_mode: "surah", review_surah: rint(1, 30), tajweed_grade: pick(["ممتاز", "جيّد جدًّا"]), companion: chance(0.3) ? "أتمّ الواجب" : null, companion_kind: null, note: null, created_at: NOW - rint(1, 30) * DAY }); } }

// ===== دروس المساجد + حضورها =====
for (const m of menMosques) if (chance(0.5)) for (let l = 0; l < rint(1, 3); l++) { const lid = uid("zml"); add("mosque_lessons", { id: lid, mosque_id: m.id, title: pick(["درس الفجر", "شرح الأربعين النوويّة", "تفسير جزء عمّ", "فقه العبادات", "السيرة النبويّة"]), description: chance(0.5) ? "درسٌ أسبوعيٌّ مفتوحٌ للجميع" : null, place: pick(["المصلّى الرئيس", "قاعة الدروس", "المكتبة"]), starts_at: NOW + rint(-10, 10) * DAY, duration_min: pick([30, 45, 60]), material_id: chance(0.3) ? pick(matIds).id : null, status: pick(["scheduled", "confirmed", "delivered"]), created_by: "u-admin", created_at: NOW - rint(5, 40) * DAY, updated_at: NOW - rint(1, 20) * DAY }); for (let a = 0; a < rint(3, 12); a++) add("mosque_lesson_attendance", { id: uid("zmla"), lesson_id: lid, person_id: chance(0.6) ? pick(menPersonIds) : null, name: nm("male"), created_at: NOW - rint(1, 20) * DAY }); }

// ===== التقدّم في المنهج (لطالبات على بصيرة) =====
const MANHAJ_KEYS = ["unit-01__lesson-01", "unit-02__lesson-01", "unit-03__lesson-02", "unit-09__lesson-04", "unit-05__lesson-01"];
for (const en of (rows.enrollments ?? []).slice(0, 200)) if (chance(0.5)) for (const mk of MANHAJ_KEYS) if (chance(0.5)) add("curriculum_progress", { id: uid("zcp2"), enrollment_id: en.id, manhaj_key: mk, status: pick(["done", "done", "in_progress"]), rating: rint(3, 5), source: "lesson", date_hijri: dh(), updated_at: NOW - rint(1, 40) * DAY });

// ===== مرفقات الإعلام (صور مربوطة بالسجلّ اليوميّ ودروس الحلقات) =====
const weeklyIds = (rows.weekly_records ?? []).map((w) => w.id);
for (let i = 0; i < 40; i++) add("attachments", { id: uid("zatt"), scope: pick(["daily_record", "daily_record", "lesson"]), ref_id: pick(weeklyIds.length ? weeklyIds : ["w0"]), caption: chance(0.6) ? pick(["نشاطٌ دعويّ", "توزيع مساعدات", "درسٌ في المسجد", "جولةُ إشراف"]) : null, content_type: "image/jpeg", uploaded_by: "u-admin", client_uuid: uid("cuatt"), created_at: NOW - rint(1, 60) * DAY });

// ===== الإخراج =====
const out = [];
const v = (x) => x === null || x === undefined ? "NULL" : typeof x === "number" ? x : typeof x === "boolean" ? (x ? 1 : 0) : `'${String(x).replace(/'/g, "''")}'`;
// INSERT OR IGNORE: البذرةُ حتميّةٌ لكنّ بعضَ التوليد العشوائيّ قد يصادف قيدَ تفرّدٍ طبيعيّ (مثل daily_entries)؛ التجاهلُ يُبقيها متينةً وقابلةً لإعادة التحميل.
for (const [t, rs] of Object.entries(rows)) { if (!rs.length) continue; const cols = Object.keys(rs[0]); for (let i = 0; i < rs.length; i += 60) { const chunk = rs.slice(i, i + 60); out.push(`INSERT OR IGNORE INTO ${t} (${cols.join(",")}) VALUES\n` + chunk.map((r) => `(${cols.map((c) => v(r[c])).join(",")})`).join(",\n") + ";"); } }
const counts = Object.fromEntries(Object.entries(rows).map(([t, r]) => [t, r.length]));
process.stderr.write("ROWS: " + JSON.stringify(counts) + "\n");
process.stdout.write("-- بذرة ضخمة للقسمين (مولّدة عبر scripts/gen-seed.mjs) — لا تُحرّر يدويًّا\nPRAGMA foreign_keys=OFF;\n" + out.join("\n") + "\n");
