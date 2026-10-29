'use strict';
/* DentAgenda — aplicație de programări pentru cabinet stomatologic.
   Toate datele stau local pe telefon (localStorage). Export JSON/CSV/PDF din Setări. */

const APP_VERSION = '1.0.0';
const KEY = 'dentagenda.v1';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- date ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const monday = (s) => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const toHM = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const DSHORT = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'];
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const dayLabel = (s) => { const d = parseD(s); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const shortDate = (s) => { const d = parseD(s); const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''; return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + y; };
const relDay = (s) => { const t = today(); if (s === t) return 'Azi'; if (s === addDays(t, 1)) return 'Mâine'; if (s === addDays(t, -1)) return 'Ieri'; const d = parseD(s); return DSHORT[d.getDay()] + ' ' + shortDate(s); };

/* ---------- data ---------- */
const DEFAULT_PROCS = [
  { name: 'Consultație', dur: 30 }, { name: 'Control', dur: 30 }, { name: 'Detartraj', dur: 45 },
  { name: 'Obturație', dur: 60 }, { name: 'Tratament canal', dur: 90 }, { name: 'Extracție', dur: 30 }, { name: 'Albire', dur: 60 }
];
const PRESETS = {
  teal: { name: 'Teal (implicit)', bg: '#F4F6F7', ink: '#12212B', accent: '#0B6E6E', card: '#FFFFFF', muted: '#5A6B75', soft: '#E3F1F0', bar: '#FFFFFF', line: '#E6ECEE', on: '#FFFFFF' },
  lila: { name: 'Lila & alb', bg: '#F6F2FB', ink: '#2A1B3D', accent: '#7C4DBA', card: '#FFFFFF', muted: '#6B5B7E', soft: '#EEE5F8', bar: '#FFFFFF', line: '#E8E0F2', on: '#FFFFFF' },
  na: { name: 'Negru & alb', bg: '#0E0E0E', ink: '#FFFFFF', accent: '#FFFFFF', card: '#1C1C1E', muted: '#A8A8AD', soft: '#3A3A3D', bar: '#161616', line: '#2C2C2E', on: '#0E0E0E' },
  np: { name: 'Negru & portocaliu', bg: '#0E0E0E', ink: '#F5F5F5', accent: '#FF8A1F', card: '#1C1C1E', muted: '#A8A8AD', soft: '#3A2410', bar: '#161616', line: '#2C2C2E', on: '#111111' }
};
const SW_BG = ['#FFFFFF', '#F4F6F7', '#F6F2FB', '#FFF7EE', '#0E0E0E'];
const SW_INK = ['#12212B', '#2A1B3D', '#000000', '#F5F5F5', '#FFFFFF'];
const SW_ACC = ['#0B6E6E', '#7C4DBA', '#FF8A1F', '#2563EB', '#000000'];
const STATUS = {
  confirmat: { l: 'Confirmat', hint: 'Implicit la orice programare nouă', dot: '#0B6E6E' },
  neconfirmat: { l: 'Neconfirmat', hint: 'Aștepți confirmarea pacientului', dot: '#C77700' },
  sosit: { l: 'A sosit', hint: 'E în sala de așteptare sau în cabinet', dot: '#2563EB' },
  finalizat: { l: 'Finalizat', hint: 'Tratamentul s-a încheiat', dot: '#46525C' },
  neprezentat: { l: 'Neprezentat', hint: 'Se notează în istoricul pacientului', dot: '#8796A0' },
  anulat: { l: 'Anulat', hint: 'Eliberează intervalul din agendă', dot: '#B42318' }
};
const DEFAULT_SMS = 'Bună ziua, {nume}! Vă reamintim de programarea la stomatolog de {data}, ora {ora}. Vă rugăm să confirmați. Mulțumim! {cabinet}';

function defaults() {
  return {
    app: 'DentAgenda', schema: 1, patients: [], appointments: [],
    settings: {
      clinic: '', theme: { preset: 'teal', bg: '#F4F6F7', ink: '#12212B', accent: '#0B6E6E' },
      work: { start: '09:00', end: '18:00', step: 30 }, procedures: DEFAULT_PROCS.map((p) => ({ ...p })),
      sms: DEFAULT_SMS, lastBackup: null
    }
  };
}
function normalize(d) {
  const def = defaults();
  const s = Object.assign({}, def.settings, d.settings || {});
  s.theme = Object.assign({}, def.settings.theme, s.theme || {});
  s.work = Object.assign({}, def.settings.work, s.work || {});
  if (!Array.isArray(s.procedures)) s.procedures = def.settings.procedures;
  return { app: 'DentAgenda', schema: 1, patients: Array.isArray(d.patients) ? d.patients : [], appointments: Array.isArray(d.appointments) ? d.appointments : [], settings: s };
}
function load() { try { const r = localStorage.getItem(KEY); if (r) return normalize(JSON.parse(r)); } catch (e) { console.error(e); } return defaults(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Nu am putut salva datele: ' + e.message); } }
let db = load();

const pat = (id) => db.patients.find((p) => p.id === id);
const appt = (id) => db.appointments.find((a) => a.id === id);
const isActive = (a) => a.status !== 'anulat';
const apptsOn = (d) => db.appointments.filter((a) => a.date === d).sort((a, b) => a.start.localeCompare(b.start));
const endOf = (a) => toMin(a.start) + (Number(a.dur) || 30);
function overlaps(date, start, dur, exclude) {
  const s = toMin(start), e = s + dur;
  return db.appointments.some((a) => a.id !== exclude && a.date === date && isActive(a) && toMin(a.start) < e && endOf(a) > s);
}
const isFuture = (a) => { const t = today(); return a.date > t || (a.date === t && endOf(a) > nowMin()); };
function nextAppt(pid) { return db.appointments.filter((a) => a.pid === pid && isActive(a) && a.status !== 'finalizat' && isFuture(a)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]; }
function lastVisit(pid) { return db.appointments.filter((a) => a.pid === pid && !isFuture(a) && (a.status === 'finalizat' || a.status === 'confirmat' || a.status === 'sosit')).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0]; }
function needsRecall(pid) { if (nextAppt(pid)) return false; const l = lastVisit(pid); return !!l && l.date < addDays(today(), -182); }
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const shortName = (n) => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w[w.length - 1] + ' ' + w[0][0] + '.' : w[0]; };
const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');
function fillSms(a) {
  const p = pat(a.pid) || {};
  return (db.settings.sms || DEFAULT_SMS)
    .replace(/\{nume\}/g, (p.name || '').split(/\s+/)[0] || '')
    .replace(/\{data\}/g, dayLabel(a.date).toLowerCase())
    .replace(/\{ora\}/g, a.start)
    .replace(/\{cabinet\}/g, db.settings.clinic || '')
    .replace(/[ \t]+/g, ' ').trim();
}
const smsHref = (phone, body) => 'sms:' + cleanPhone(phone) + (isIOS ? '&' : '?') + 'body=' + encodeURIComponent(body);
const telHref = (phone) => 'tel:' + cleanPhone(phone);
const daysSinceBackup = () => db.settings.lastBackup ? Math.floor((Date.now() - new Date(db.settings.lastBackup).getTime()) / 86400000) : null;
const backupDue = () => db.appointments.length + db.patients.length > 0 && (daysSinceBackup() === null || daysSinceBackup() >= 7);

/* ---------- theme ---------- */
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); }
function lum(h) { const c = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => pad(Math.round(v + (y[i] - v) * t).toString(16))).join(''); }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function themeVars() {
  const t = db.settings.theme;
  if (PRESETS[t.preset]) return PRESETS[t.preset];
  const dark = lum(t.bg) < 0.2;
  return {
    bg: t.bg, ink: t.ink, accent: t.accent,
    card: dark ? mix(t.bg, '#ffffff', 0.08) : '#FFFFFF',
    muted: mix(t.ink, t.bg, 0.38),
    soft: rgba(t.accent, dark ? 0.22 : 0.14),
    bar: dark ? mix(t.bg, '#ffffff', 0.04) : '#FFFFFF',
    line: dark ? mix(t.bg, '#ffffff', 0.14) : mix(t.bg, '#000000', 0.08),
    on: lum(t.accent) > 0.45 ? '#111111' : '#FFFFFF'
  };
}
function applyTheme() {
  const v = themeVars(), r = document.documentElement.style;
  Object.entries(v).forEach(([k, val]) => { if (k !== 'name') r.setProperty('--' + k, val); });
  r.setProperty('color-scheme', lum(v.bg) < 0.2 ? 'dark' : 'light');
  document.querySelector('meta[name=theme-color]').setAttribute('content', v.bg);
}

/* ---------- icons ---------- */
const sv = (p, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cal: sv('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  users: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>', 20, 2.4),
  back: sv('<path d="M15 5l-7 7 7 7"/>', 22, 2.2),
  left: sv('<path d="M15 5l-7 7 7 7"/>', 18, 2.2),
  right: sv('<path d="M9 5l7 7-7 7"/>', 18, 2.2),
  chev: sv('<path d="M9 5l7 7-7 7"/>', 18, 2),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 20),
  phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>', 20),
  msg: sv('<path d="M4 5h16v11H8l-4 4z"/>', 20),
  calPlus: sv('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M12 13v5M9.5 15.5h5"/>', 20),
  down: sv('<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>', 20),
  up: sv('<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>', 20),
  check: sv('<path d="M20 6L9 17l-5-5"/>', 22, 2.6),
  warn: sv('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>', 20),
  list: sv('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', 20),
  palette: sv('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>', 20)
};

/* ---------- routing ---------- */
let stack = [{ name: 'today', p: { date: today() } }];
const cur = () => stack[stack.length - 1];
function go(name, p = {}) { stack.push({ name, p }); history.pushState({ n: stack.length }, ''); render(true); }
function replace(name, p = {}) { stack[stack.length - 1] = { name, p }; render(true); }
function tab(name, p) { stack = [{ name, p: p || (name === 'today' ? { date: today() } : {}) }]; render(true); }
function back() { if (stack.length > 1) history.back(); }
window.addEventListener('popstate', () => { if (stack.length > 1) { stack.pop(); render(true); } });

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800); }

function render(resetScroll) {
  const app = $('#app');
  const sc = app.querySelector('.scroll, .wk-body');
  const prev = sc ? sc.scrollTop : 0;
  const c = cur();
  const view = V[c.name] || V.today;
  app.innerHTML = view(c.p);
  const nsc = app.querySelector('.scroll, .wk-body');
  if (nsc) {
    if (!resetScroll) nsc.scrollTop = prev;
    else if (c.name === 'week') { const w = db.settings.work; const tgt = Math.max(0, (Math.min(nowMin(), toMin(w.end)) - toMin(w.start) - 60) / 60 * HPX); nsc.scrollTop = tgt; }
  }
}

const nav = (act) => `<nav class="nav">${[['today', 'Azi', I.clock], ['week', 'Calendar', I.cal], ['patients', 'Pacienți', I.users], ['settings', 'Setări', I.gear]]
  .map(([n, l, i]) => `<button data-a="tab" data-t="${n}" class="${act === n ? 'on' : ''}" aria-label="${l}">${i}<span>${l}</span></button>`).join('')}</nav>`;
const topBack = (title, right = '') => `<header class="top"><button class="icon-btn" data-a="back" aria-label="Înapoi">${I.back}</button><div class="grow"><h2>${title}</h2></div>${right}</header>`;
const badge = (s) => `<span class="badge st-${s}">${esc((STATUS[s] || STATUS.confirmat).l)}</span>`;
const backupWarn = () => backupDue() ? `<div class="warn" style="margin-top:12px">${I.warn}<span>${daysSinceBackup() === null ? 'Nu ai făcut încă niciun backup.' : 'Ultimul backup acum ' + daysSinceBackup() + ' zile.'}</span><button data-a="goExport">Fă backup</button></div>` : '';

const V = {};

/* ---------- AZI ---------- */
V.today = (p) => {
  const d = p.date || today(), t = today(), isT = d === t;
  const list = apptsOn(d), act = list.filter(isActive);
  const w = db.settings.work, ws = toMin(w.start), we = toMin(w.end);
  const wk = monday(d);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(wk, i), dd = parseD(day), has = db.appointments.some((a) => a.date === day && isActive(a));
    return `<button data-a="day" data-d="${day}" class="${day === d ? 'on' : ''} ${day === t ? 'today' : ''}" aria-label="${dayLabel(day)}"><span>${DSHORT[dd.getDay()]}</span><b>${dd.getDate()}</b>${has ? '<i></i>' : ''}</button>`;
  }).join('');
  const n = act.length;
  const title = n ? (isT ? 'Azi ai ' : '') + n + (n === 1 ? ' programare' : ' programări') : (isT ? 'Azi e liber' : 'Nicio programare');
  const cnt = (s) => act.filter((a) => a.status === s).length;
  const sum = [];
  if (cnt('confirmat')) sum.push(`<span class="badge st-confirmat" style="font-size:12px;padding:6px 10px">${cnt('confirmat')} confirmat${cnt('confirmat') === 1 ? 'ă' : 'e'}</span>`);
  if (cnt('neconfirmat')) sum.push(`<span class="badge st-neconfirmat" style="font-size:12px;padding:6px 10px">${cnt('neconfirmat')} neconfirmat${cnt('neconfirmat') === 1 ? 'ă' : 'e'}</span>`);
  if (cnt('finalizat')) sum.push(`<span class="badge st-finalizat" style="font-size:12px;padding:6px 10px">${cnt('finalizat')} finalizat${cnt('finalizat') === 1 ? 'ă' : 'e'}</span>`);

  // items + gaps
  const items = list.map((a) => ({ type: 'a', s: toMin(a.start), a }));
  if (d >= t) {
    let c = ws;
    if (isT) { const step = Number(w.step) || 30; c = Math.max(ws, Math.ceil(nowMin() / step) * step); }
    const busy = act.map((a) => [toMin(a.start), endOf(a)]).sort((x, y) => x[0] - y[0]);
    for (const [s, e] of busy) { if (s - c >= 30 && s <= we) items.push({ type: 'g', s: c, e: Math.min(s, we) }); c = Math.max(c, e); }
    if (we - c >= 30) items.push({ type: 'g', s: c, e: we });
  }
  items.sort((x, y) => x.s - y.s || (x.type === 'g' ? 1 : -1));
  const nm = nowMin();
  const rows = items.map((it) => {
    if (it.type === 'g') return `<div class="tl-row"><span class="tl-time">${toHM(it.s)}</span><button class="gap" data-a="newAt" data-d="${d}" data-t="${toHM(it.s)}">${I.plus}Liber ${toHM(it.s)}–${toHM(it.e)}</button></div>`;
    const a = it.a, x = pat(a.pid) || { name: '(pacient șters)' };
    const now = isT && a.status !== 'anulat' && a.status !== 'finalizat' && toMin(a.start) <= nm && endOf(a) > nm;
    const quick = a.status === 'neconfirmat' && x.phone ? `<span class="quick"><a href="${telHref(x.phone)}" data-a="ext">Sună</a><a href="${smsHref(x.phone, fillSms(a))}" data-a="ext">SMS reamintire</a></span>` : '';
    return `<div class="tl-row"><span class="tl-time" ${now ? 'style="color:var(--accent)"' : ''}>${a.start}</span>
      <div class="appt ${now ? 'now' : ''} ${a.status === 'anulat' ? 'cancel' : ''}" data-a="appt" data-id="${a.id}" role="button" tabindex="0">
        <span class="l1"><span class="nm">${esc(x.name)}</span>${now && a.status !== 'sosit' ? '<span class="badge">Acum</span>' : badge(a.status)}</span>
        <span class="l2">${esc(a.proc || 'Programare')} · ${a.dur} min${a.note ? ' · ' + esc(a.note) : ''}</span>${quick}
      </div></div>`;
  }).join('');
  const empty = !items.length ? `<div class="card empty"><b>${d < t ? 'Nicio programare în ziua asta' : 'Nicio programare'}</b>${d < t ? '' : 'Apasă „Programare” ca să adaugi una.'}</div>` : '';
  return `<header class="top"><div class="grow"><span class="over">${isT ? 'Azi · ' : ''}${dayLabel(d)}</span><h1>${title}</h1></div>
    ${isT ? '' : `<button class="pill" data-a="day" data-d="${t}">Azi</button>`}
    <button class="icon-btn outline" data-a="tab" data-t="patients" aria-label="Caută pacient">${I.search}</button></header>
    <div class="strip">${strip}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px 8px">
      <button class="pill" data-a="day" data-d="${addDays(wk, -7)}" aria-label="Săptămâna trecută">${I.left}</button>
      <span class="small muted" style="font-weight:700">${shortDate(wk)} – ${shortDate(addDays(wk, 6))}</span>
      <button class="pill" data-a="day" data-d="${addDays(wk, 7)}" aria-label="Săptămâna viitoare">${I.right}</button>
    </div>
    ${sum.length ? `<div class="summary">${sum.join('')}</div>` : ''}
    <div class="scroll">${isT ? backupWarn() : ''}<div class="tl" style="margin-top:6px">${rows}</div>${empty}</div>
    <button class="fab" data-a="newAt" data-d="${d}">${I.plus}Programare</button>${nav('today')}`;
};

/* ---------- CALENDAR SĂPTĂMÂNĂ ---------- */
const HPX = 56;
V.week = (p) => {
  const wk = p.wk || monday(today()), t = today();
  const w = db.settings.work, ws = Math.floor(toMin(w.start) / 60) * 60, we = Math.ceil(toMin(w.end) / 60) * 60;
  const H = (we - ws) / 60 * HPX;
  const days = Array.from({ length: 6 }, (_, i) => addDays(wk, i));
  const head = days.map((d) => { const dd = parseD(d); return `<button data-a="day" data-d="${d}" class="${d === t ? 'today' : ''}">${DSHORT[dd.getDay()]} ${dd.getDate()}</button>`; }).join('');
  const hours = Array.from({ length: (we - ws) / 60 }, (_, i) => `<span style="height:${HPX}px">${pad(ws / 60 + i)}</span>`).join('');
  const cols = days.map((d) => {
    const blocks = apptsOn(d).filter(isActive).map((a) => {
      const s = Math.max(toMin(a.start), ws), top = (s - ws) / 60 * HPX, h = Math.max((Number(a.dur) || 30) / 60 * HPX - 2, 18);
      const x = pat(a.pid) || { name: '?' };
      const style = a.status === 'neconfirmat' ? 'background:#FDF1DC;color:#7A4700' : a.status === 'finalizat' ? 'background:var(--line);color:var(--ink)' : a.status === 'sosit' ? 'background:var(--accent);color:var(--on)' : a.status === 'neprezentat' ? 'background:#ECEFF1;color:#46525C' : 'background:var(--soft);color:var(--accent)';
      return `<button class="blk" data-a="appt" data-id="${a.id}" style="top:${top}px;height:${h}px;${style}">${a.start}<br>${esc(shortName(x.name))}${h > 40 ? '<br><span style="font-weight:600;opacity:.85">' + esc(a.proc || '') + '</span>' : ''}</button>`;
    }).join('');
    const nl = d === t && nowMin() > ws && nowMin() < we ? `<div class="now-line" style="top:${(nowMin() - ws) / 60 * HPX}px"></div>` : '';
    return `<div class="wk-col ${d === t ? 'today' : ''}" data-a="wslot" data-d="${d}" style="height:${H}px;background-size:100% ${HPX}px">${blocks}${nl}</div>`;
  }).join('');
  return `<header class="top"><div class="grow"><span class="over">Calendar</span><h1>${shortDate(wk)} – ${shortDate(addDays(wk, 5))}</h1></div>
    <button class="icon-btn outline" data-a="wk" data-n="-7" aria-label="Săptămâna anterioară">${I.left}</button>
    <button class="icon-btn outline" data-a="wk" data-n="7" aria-label="Săptămâna următoare">${I.right}</button></header>
    <div style="padding:0 20px 10px;display:flex;gap:8px"><button class="pill" data-a="wk" data-n="0">Săptămâna asta</button><span class="small muted" style="align-self:center">Atinge un loc liber ca să programezi</span></div>
    <div class="wk-head"><span></span>${head}</div>
    <div class="wk-body"><div class="wk-grid"><div class="wk-hours">${hours}</div>${cols}</div></div>${nav('week')}`;
};

/* ---------- PACIENȚI ---------- */
function patientsList(q, f) {
  q = (q || '').trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  let ps = db.patients.slice().sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  if (q) ps = ps.filter((p) => p.name.toLowerCase().includes(q) || (qd.length >= 3 && cleanPhone(p.phone).includes(qd)));
  if (f === 'next') ps = ps.filter((p) => nextAppt(p.id));
  if (f === 'recall') ps = ps.filter((p) => needsRecall(p.id));
  if (!db.patients.length) return `<div class="card empty"><b>Niciun pacient încă</b>Adaugă unul cu butonul +, sau direct când faci o programare.</div>`;
  if (!ps.length) return `<div class="card empty"><b>Niciun rezultat</b>${q ? 'Încearcă alt nume sau număr.' : ''}</div>`;
  let out = '', letter = '';
  const groups = [];
  for (const p of ps) {
    const L = (p.name.trim()[0] || '#').toUpperCase();
    if (L !== letter) { letter = L; groups.push({ L, items: [] }); }
    groups[groups.length - 1].items.push(p);
  }
  for (const g of groups) {
    out += `<div class="letter">${esc(g.L)}</div><div class="card list">` + g.items.map((p) => {
      const n = nextAppt(p.id), l = lastVisit(p.id), r = !n && needsRecall(p.id);
      const sub = n ? `${relDay(n.date)} ${n.start} · ${esc(n.proc || '')}` : r ? `<span style="color:#A35F00;font-weight:700">De rechemat · ultima vizită ${shortDate(l.date)}</span>` : l ? `Ultima vizită ${shortDate(l.date)}` : esc(p.phone || '');
      return `<button class="li" data-a="patient" data-id="${p.id}"><span class="avatar">${esc(initials(p.name))}</span><span class="t"><b>${esc(p.name)}</b><span>${sub}</span></span><span class="muted">${I.chev}</span></button>`;
    }).join('') + '</div>';
  }
  return out;
}
V.patients = (p) => {
  const f = p.f || 'all';
  return `<header class="top"><div class="grow"><h1>Pacienți</h1></div><span class="small muted" style="font-weight:700">${db.patients.length} în total</span></header>
    <div style="padding:0 20px 10px"><label class="search">${I.search}<input data-f="pq" type="search" placeholder="Caută după nume sau telefon" value="${esc(p.q || '')}" autocomplete="off"></label></div>
    <div class="chips" style="padding:0 20px 6px">${[['all', 'Toți'], ['next', 'Cu programare'], ['recall', 'De rechemat']].map(([k, l]) => `<button class="pill ${f === k ? 'on' : ''}" data-a="pf" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="scroll"><div id="plist">${patientsList(p.q, f)}</div></div>
    <button class="fab round" data-a="newPatient" aria-label="Adaugă pacient">${I.plus}</button>${nav('patients')}`;
};

/* ---------- FIȘĂ PACIENT ---------- */
V.patient = (p) => {
  const x = pat(p.id);
  if (!x) return topBack('Pacient') + '<div class="scroll"><div class="card empty"><b>Pacientul nu mai există</b></div></div>';
  const n = nextAppt(x.id);
  const hist = db.appointments.filter((a) => a.pid === x.id && a !== n).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const ph = x.phone;
  return topBack('', `<button class="pill" data-a="editPatient" data-id="${x.id}">Editează</button>`) + `<div class="scroll">
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 0 16px;text-align:center">
      <span class="avatar big">${esc(initials(x.name))}</span>
      <h1 style="margin:6px 0 0;font-size:24px;font-weight:800">${esc(x.name)}</h1>
      <span class="muted small">${esc(ph || 'Fără telefon')}${x.created ? ' · pacient din ' + new Date(x.created).getFullYear() : ''}</span></div>
    <div class="tiles">
      <a class="tile ${ph ? '' : 'off'}" href="${ph ? telHref(ph) : '#'}" data-a="ext">${I.phone}Sună</a>
      <a class="tile ${ph ? '' : 'off'}" href="${ph ? smsHref(ph, '') : '#'}" data-a="ext">${I.msg}SMS</a>
      <button class="tile pri" data-a="newFor" data-id="${x.id}">${I.calPlus}Programează</button></div>
    ${x.alerts ? `<div class="alert" style="margin-top:12px">${I.warn}<span><b>Atenționări medicale</b>${esc(x.alerts)}</span></div>` : ''}
    ${x.notes ? `<div class="card pad small" style="margin-top:12px;white-space:pre-wrap">${esc(x.notes)}</div>` : ''}
    <span class="sec">Următoarea programare</span>
    ${n ? `<button class="card pad" style="width:100%;text-align:left;display:flex;flex-direction:column;gap:4px" data-a="appt" data-id="${n.id}"><span style="display:flex;justify-content:space-between;width:100%"><b style="font-size:16px">${relDay(n.date)}, ${n.start}</b>${badge(n.status)}</span><span class="muted small">${esc(n.proc || '')} · ${n.dur} min</span></button>` : `<div class="card pad muted small">Nicio programare viitoare.</div>`}
    <span class="sec">Istoric (${hist.length})</span>
    ${hist.length ? `<div class="card list">${hist.map((a) => `<button class="li" data-a="appt" data-id="${a.id}"><span class="t"><b>${esc(a.proc || 'Programare')}</b><span>${dayLabel(a.date)} · ${a.start}</span></span>${badge(a.status)}</button>`).join('')}</div>` : '<div class="card pad muted small">Încă nu are vizite.</div>'}
    <button class="btn danger" style="margin-top:20px" data-a="delPatient" data-id="${x.id}">Șterge pacientul</button></div>`;
};

/* ---------- FORMULAR PACIENT ---------- */
V.pform = (p) => {
  if (!p.form) { const x = p.id ? pat(p.id) : null; p.form = { name: x?.name || '', phone: x?.phone || '', alerts: x?.alerts || '', notes: x?.notes || '' }; }
  const f = p.form;
  return topBack(p.id ? 'Editează pacient' : 'Pacient nou') + `<div class="scroll">
    <div class="field" style="margin-top:4px"><label for="pn">Nume și prenume</label><input id="pn" class="inp" data-f="name" value="${esc(f.name)}" autocomplete="off" autocapitalize="words"></div>
    <div class="field"><label for="pp">Telefon</label><input id="pp" class="inp" data-f="phone" type="tel" inputmode="tel" value="${esc(f.phone)}"></div>
    <div class="field"><label for="pa">Atenționări medicale (alergii, tratamente)</label><textarea id="pa" class="inp" data-f="alerts" rows="2">${esc(f.alerts)}</textarea></div>
    <div class="field"><label for="po">Observații</label><textarea id="po" class="inp" data-f="notes" rows="3">${esc(f.notes)}</textarea></div>
    </div><div class="bottom-bar"><button class="btn pri" data-a="savePatient">Salvează</button></div>`;
};

/* ---------- FORMULAR PROGRAMARE ---------- */
function patResults(f) {
  const q = (f.q || '').trim().toLowerCase();
  if (!q) return db.patients.length ? '<div class="small muted" style="padding:4px 4px 0">Scrie numele sau telefonul pacientului.</div>' : '';
  const qd = q.replace(/\D/g, '');
  const ps = db.patients.filter((p) => p.name.toLowerCase().includes(q) || (qd.length >= 3 && cleanPhone(p.phone).includes(qd))).slice(0, 6);
  return `<div class="card list">${ps.map((p) => {
    const l = lastVisit(p.id);
    return `<button class="li" data-a="fPick" data-id="${p.id}"><span class="t"><b>${esc(p.name)}</b><span>${esc(p.phone || '')}${l ? ' · ultima vizită ' + shortDate(l.date) : ''}</span></span><span class="small" style="font-weight:800;color:var(--accent)">Alege</span></button>`;
  }).join('')}<button class="li" data-a="fNewPat" style="color:var(--accent);font-weight:800">${I.plus}Pacient nou „${esc(f.q.trim())}”</button></div>`;
}
V.form = (p) => {
  if (!p.form) {
    const a = p.id ? appt(p.id) : null;
    const procs = db.settings.procedures;
    p.form = a ? { pid: a.pid, q: '', newMode: false, newName: '', newPhone: '', proc: a.proc, dur: Number(a.dur), date: a.date, start: a.start, status: a.status, note: a.note || '', custom: !procs.some((x) => x.name === a.proc) }
      : { pid: p.pid || null, q: '', newMode: false, newName: '', newPhone: '', proc: procs[0]?.name || '', dur: procs[0]?.dur || 30, date: p.date || today(), start: p.start || '', status: 'confirmat', note: '', custom: false };
  }
  const f = p.form, w = db.settings.work, step = Number(w.step) || 30;
  const x = f.pid ? pat(f.pid) : null;
  let patHtml;
  if (x) patHtml = `<div class="card pad" style="display:flex;align-items:center;gap:12px"><span class="avatar">${esc(initials(x.name))}</span><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(x.name)}</b><br><span class="small muted">${esc(x.phone || '')}</span></span><button class="pill" data-a="fClearPat">Schimbă</button></div>`;
  else if (f.newMode) patHtml = `<div class="card pad" style="display:flex;flex-direction:column;gap:10px"><span class="small" style="font-weight:800;color:var(--accent)">Pacient nou</span>
      <input class="inp" data-f="newName" placeholder="Nume și prenume" value="${esc(f.newName)}" autocapitalize="words">
      <input class="inp" data-f="newPhone" type="tel" inputmode="tel" placeholder="Telefon" value="${esc(f.newPhone)}">
      <button class="small muted" style="align-self:flex-start;font-weight:700" data-a="fCancelNew">Anulează – caută pacient existent</button></div>`;
  else patHtml = `<label class="search" style="border-color:var(--accent)">${I.search}<input data-f="q" type="search" placeholder="Caută pacient sau scrie un nume nou" value="${esc(f.q)}" autocomplete="off"></label><div id="pres" style="margin-top:8px">${patResults(f)}</div>`;

  const procs = db.settings.procedures.map((pr, i) => `<button class="pill ${!f.custom && f.proc === pr.name ? 'acc' : ''}" data-a="fProc" data-i="${i}">${esc(pr.name)}</button>`).join('');
  const slots = [];
  const nm = nowMin();
  for (let m = toMin(w.start); m + step <= toMin(w.end); m += step) {
    const t = toHM(m), busy = overlaps(f.date, t, f.dur, p.id), past = f.date === today() && m + f.dur <= nm;
    slots.push(`<button class="slot ${f.start === t ? 'on' : ''}" data-a="fSlot" data-t="${t}" ${busy && f.start !== t ? 'disabled aria-label="' + t + ' ocupat"' : ''} ${past && f.start !== t ? 'style="opacity:.45"' : ''}>${t}</button>`);
  }
  const conflict = f.start && overlaps(f.date, f.start, f.dur, p.id);
  return topBack(p.id ? 'Editează programarea' : 'Programare nouă') + `<div class="scroll">
    <div class="field" style="margin-top:4px"><span class="lbl">Pacient</span>${patHtml}</div>
    <div class="field"><span class="lbl">Procedură</span><div class="chips">${procs}<button class="pill ${f.custom ? 'acc' : 'dash'}" data-a="fCustom">+ Altă</button></div>
      ${f.custom ? `<input class="inp" data-f="proc" placeholder="Descrie procedura" value="${esc(f.proc)}">` : ''}</div>
    <div class="field"><label for="fd">Data · ${esc(dayLabel(f.date))}</label><input id="fd" class="inp" type="date" data-f="date" value="${f.date}"></div>
    <div class="field"><span class="lbl">Ora${f.start ? ' · ' + f.start + '–' + toHM(toMin(f.start) + f.dur) : ''}</span><div class="slots">${slots.join('')}</div>
      <div style="display:flex;align-items:center;gap:10px"><span class="small muted" style="white-space:nowrap">Altă oră:</span><input class="inp" type="time" data-f="start" value="${f.start}" style="height:44px" step="300"></div>
      ${conflict ? `<div class="warn">${I.warn}Se suprapune cu altă programare.</div>` : ''}</div>
    <div class="field"><span class="lbl">Durată</span><div class="chips">${[15, 30, 45, 60, 90, 120].map((d) => `<button class="pill ${f.dur === d ? 'acc' : ''}" data-a="fDur" data-v="${d}">${d < 60 ? d + ' min' : Math.floor(d / 60) + (d % 60 ? ',5' : '') + ' h'}</button>`).join('')}</div></div>
    <div class="field"><label for="fs">Status</label><select id="fs" class="inp" data-f="status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${s.l}${k === 'confirmat' ? ' (implicit)' : ''}</option>`).join('')}</select></div>
    <div class="field"><label for="fn">Notă (opțional)</label><input id="fn" class="inp" data-f="note" value="${esc(f.note)}" placeholder="ex: durere dinte 3.6"></div>
    </div><div class="bottom-bar"><button class="btn pri" data-a="fSave">${p.id ? 'Salvează modificările' : 'Salvează programarea'}${f.start ? ' · ' + relDay(f.date) + ', ' + f.start : ''}</button></div>`;
};

/* ---------- DETALII PROGRAMARE ---------- */
V.appt = (p) => {
  const a = appt(p.id);
  if (!a) return topBack('Programare') + '<div class="scroll"><div class="card empty"><b>Programarea nu mai există</b></div></div>';
  const x = pat(a.pid) || { name: '(pacient șters)' };
  return topBack('Programare', `<button class="pill" data-a="editAppt" data-id="${a.id}">Editează</button>`) + `<div class="scroll">
    <div class="card pad" style="display:flex;flex-direction:column;gap:12px">
      <button style="display:flex;align-items:center;gap:12px;text-align:left" data-a="patient" data-id="${a.pid}"><span class="avatar">${esc(initials(x.name))}</span><span style="flex:1;min-width:0"><b style="font-size:17px">${esc(x.name)}</b><br><span class="small muted">Vezi fișa pacientului</span></span><span class="muted">${I.chev}</span></button>
      ${x.alerts ? `<div class="alert">${I.warn}<span><b>Atenționări medicale</b>${esc(x.alerts)}</span></div>` : ''}
      <div style="height:1px;background:var(--line)"></div>
      <div class="row2"><div class="kv"><span>Când</span><b>${relDay(a.date)}, ${a.start}–${toHM(endOf(a))}</b></div><div class="kv"><span>Procedură</span><b>${esc(a.proc || '–')}</b></div></div>
      ${a.note ? `<div class="kv"><span>Notă</span><b style="font-weight:600">${esc(a.note)}</b></div>` : ''}
    </div>
    <span class="sec">Status</span>
    <div class="card list stlist">${Object.entries(STATUS).map(([k, s]) => `<button class="li ${a.status === k ? 'on' : ''}" data-a="setStatus" data-id="${a.id}" data-s="${k}"><span class="dot" style="background:${s.dot}"></span><span class="t"><b>${s.l}</b><span>${s.hint}</span></span>${a.status === k ? `<span style="color:var(--accent)">${I.check}</span>` : ''}</button>`).join('')}</div>
    <span class="sec">Acțiuni</span>
    <div class="tiles">
      <a class="tile ${x.phone ? '' : 'off'}" href="${x.phone ? telHref(x.phone) : '#'}" data-a="ext">${I.phone}Sună</a>
      <a class="tile ${x.phone ? '' : 'off'}" href="${x.phone ? smsHref(x.phone, fillSms(a)) : '#'}" data-a="ext">${I.msg}SMS reamintire</a>
      <button class="tile" data-a="editAppt" data-id="${a.id}">${I.cal}Reprogramează</button></div>
    <button class="btn danger" style="margin-top:18px" data-a="delAppt" data-id="${a.id}">Șterge programarea</button></div>`;
};

/* ---------- SETĂRI ---------- */
V.settings = () => {
  const s = db.settings, t = s.theme, v = themeVars();
  const low = contrast(v.ink, v.bg) < 4.5;
  const presets = Object.entries(PRESETS).map(([k, pr]) => `<button class="preset ${t.preset === k ? 'on' : ''}" data-a="preset" data-k="${k}"><span class="sw" style="background:${pr.bg}"><b style="font-size:18px;color:${pr.ink}">Aa</b><span class="dot" style="width:14px;height:14px;border-radius:7px;background:${pr.accent}"></span></span><span>${pr.name}</span></button>`).join('');
  const crow = (label, sub, key, sw) => {
    const val = (t.preset !== 'custom' && PRESETS[t.preset]) ? PRESETS[t.preset][key] : t[key];
    const known = sw.some((c) => c.toLowerCase() === String(val).toLowerCase());
    return `<div class="crow"><span style="display:flex;flex-direction:column"><b style="font-size:14px">${label}</b>${sub ? `<span class="small muted" style="font-size:11px">${sub}</span>` : ''}</span><span class="swatches">${sw.map((c) => `<button class="swb ${c.toLowerCase() === String(val).toLowerCase() ? 'on' : ''}" style="background:${c}" data-a="color" data-k="${key}" data-c="${c}" aria-label="${label} ${c}"></button>`).join('')}<label class="swb pick ${known ? '' : 'on'}" ${known ? '' : `style="background:${val}"`} aria-label="${label} – altă culoare"><input type="color" data-tc="${key}" value="${val}"></label></span></div>`;
  };
  const d = daysSinceBackup();
  return `<header class="top"><div class="grow"><h1>Setări</h1></div></header><div class="scroll">
    <div class="card pad" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center"><span><b style="font-size:15px">09:00 · Andrei Popescu</b><br><span class="small muted">Previzualizare temă</span></span>${badge('confirmat')}</div>
      ${low ? `<div class="alert" style="padding:8px 10px;font-size:12px;font-weight:700">Contrast slab: scrisul se citește greu pe acest fundal</div>` : ''}</div>
    <span class="sec">Teme</span><div class="presets">${presets}</div>
    <span class="sec">Personalizează culorile</span>
    <div class="card">${crow('Fundal', '', 'bg', SW_BG)}${crow('Scris', '', 'ink', SW_INK)}${crow('Taburi', 'și butoane', 'accent', SW_ACC)}</div>
    <span class="sec">Cabinet</span>
    <div class="card pad" style="display:flex;flex-direction:column;gap:12px">
      <div class="field" style="margin:0"><label for="sc">Numele cabinetului (apare în SMS)</label><input id="sc" class="inp" data-s="clinic" value="${esc(s.clinic)}" placeholder="ex: Cabinet Dr. …"></div>
      <div class="row2"><div class="field" style="margin:0"><label for="sws">Program de la</label><input id="sws" class="inp" type="time" data-s="work.start" value="${s.work.start}"></div><div class="field" style="margin:0"><label for="swe">până la</label><input id="swe" class="inp" type="time" data-s="work.end" value="${s.work.end}"></div></div>
      <div class="field" style="margin:0"><label for="sst">Intervale în agendă</label><select id="sst" class="inp" data-s="work.step">${[15, 20, 30].map((n) => `<option value="${n}" ${Number(s.work.step) === n ? 'selected' : ''}>la fiecare ${n} minute</option>`).join('')}</select></div></div>
    <div class="card list" style="margin-top:10px">
      <button class="li" data-a="goProcs" style="height:52px"><span style="color:var(--accent)">${I.list}</span><span class="t"><b>Proceduri și durate</b><span>${s.procedures.length} proceduri</span></span><span class="muted">${I.chev}</span></button>
      <button class="li" data-a="goSms" style="height:52px"><span style="color:var(--accent)">${I.msg}</span><span class="t"><b>Mesaj SMS de reamintire</b></span><span class="muted">${I.chev}</span></button></div>
    <span class="sec">Date</span>
    <div class="card list">
      <button class="li" data-a="goExport" style="height:56px"><span style="color:var(--accent)">${I.down}</span><span class="t"><b>Export date și backup</b><span>${d === null ? 'Niciun backup încă' : 'Ultimul backup: ' + (d === 0 ? 'azi' : 'acum ' + d + ' zile')}</span></span><span class="muted">${I.chev}</span></button>
      <button class="li" data-a="import" style="height:56px"><span style="color:var(--accent)">${I.up}</span><span class="t"><b>Restaurează din backup</b><span>Fișier .json exportat din DentAgenda</span></span><span class="muted">${I.chev}</span></button></div>
    ${backupWarn()}
    <span class="sec">Altele</span>
    <div class="card list">
      ${!db.patients.length ? `<button class="li" data-a="demo" style="height:52px"><span class="t"><b>Încarcă date de test</b><span>Câțiva pacienți și programări, ca să încerci aplicația</span></span></button>` : ''}
      <button class="li" data-a="wipe" style="height:52px;color:#C2281A"><span class="t"><b>Șterge toate datele</b><span>Fă întâi un backup</span></span></button></div>
    <p class="small muted" style="text-align:center;margin:18px 0 0">DentAgenda ${APP_VERSION} · datele stau doar pe acest telefon<br>${db.patients.length} pacienți · ${db.appointments.length} programări</p>
    </div>${nav('settings')}`;
};

V.procs = () => {
  const ps = db.settings.procedures;
  return topBack('Proceduri și durate') + `<div class="scroll">
    <p class="small muted" style="margin:0 4px 10px">Durata se completează automat când alegi procedura la o programare.</p>
    <div class="card list">${ps.map((pr, i) => `<div class="li" style="gap:8px"><input class="inp" style="height:42px;flex:1" data-pi="${i}" data-pk="name" value="${esc(pr.name)}" aria-label="Nume procedură">
      <select class="inp" style="height:42px;width:104px" data-pi="${i}" data-pk="dur" aria-label="Durată">${[15, 20, 30, 45, 60, 90, 120, 150, 180].map((d) => `<option value="${d}" ${Number(pr.dur) === d ? 'selected' : ''}>${d} min</option>`).join('')}</select>
      <button class="icon-btn" data-a="procDel" data-i="${i}" aria-label="Șterge ${esc(pr.name)}" style="color:#C2281A">✕</button></div>`).join('')}</div>
    <button class="btn sec2" style="margin-top:12px" data-a="procAdd">${I.plus}Adaugă procedură</button></div>`;
};

V.sms = () => topBack('Mesaj SMS') + `<div class="scroll">
  <div class="field" style="margin-top:4px"><label for="smt">Textul reamintirii</label><textarea id="smt" class="inp" data-s="sms" rows="6">${esc(db.settings.sms)}</textarea></div>
  <p class="small muted" style="margin:10px 4px">Se înlocuiesc automat: <b>{nume}</b> – prenumele pacientului, <b>{data}</b>, <b>{ora}</b>, <b>{cabinet}</b> – numele cabinetului din Setări.<br><br>Mesajul se deschide în aplicația de SMS a telefonului, gata de trimis – îl trimiți tu cu un tap.</p>
  <button class="btn sec2" data-a="smsReset">Revino la textul implicit</button></div>`;

/* ---------- EXPORT ---------- */
V.export = (p) => {
  const fmt = p.fmt || 'json', per = p.per || 'all';
  const d = daysSinceBackup();
  const opt = (k, title, desc) => `<button class="card pad" data-a="exFmt" data-k="${k}" style="display:flex;gap:12px;align-items:flex-start;text-align:left;width:100%;${fmt === k ? 'border:1.5px solid var(--accent)' : ''}"><span style="width:20px;height:20px;border-radius:10px;border:2px solid ${fmt === k ? 'var(--accent)' : 'var(--line)'};display:flex;align-items:center;justify-content:center;margin-top:1px;flex:none">${fmt === k ? '<span style="width:10px;height:10px;border-radius:5px;background:var(--accent)"></span>' : ''}</span><span><b style="font-size:15px">${title}</b><br><span class="small muted">${desc}</span></span></button>`;
  return topBack('Export date') + `<div class="scroll">
    <div class="card pad" style="display:flex;gap:12px;align-items:center;${d !== null && d < 7 ? 'background:var(--soft);border-color:transparent' : ''}">${d !== null && d < 7 ? `<span style="color:var(--accent)">${I.check}</span>` : I.warn}<span><b style="font-size:14px">${d === null ? 'Niciun backup încă' : 'Ultimul backup: ' + (d === 0 ? 'azi' : 'acum ' + d + ' zile')}</b><br><span class="small muted">${db.patients.length} pacienți · ${db.appointments.length} programări</span></span></div>
    <span class="sec">Format</span>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${opt('json', 'Backup complet (.json)', 'Tot: pacienți, programări, setări. Se poate restaura aici sau importa în aplicația mare (PC + telefon).')}
      ${opt('csvA', 'Programări – Excel (.csv)', 'Data, ora, pacient, telefon, procedură, status.')}
      ${opt('csvP', 'Pacienți – Excel (.csv)', 'Nume, telefon, atenționări, ultima vizită.')}
      ${opt('pdf', 'Agendă de printat (PDF)', 'Lista programărilor pe zile. Pe iPhone: Print → ciupește previzualizarea → Partajează.')}</div>
    ${fmt === 'csvA' || fmt === 'pdf' ? `<span class="sec">Perioadă</span><div class="chips">${[['all', 'Tot'], ['week', 'Săptămâna asta'], ['month', 'Luna asta'], ['range', 'Interval…']].map(([k, l]) => `<button class="pill ${per === k ? 'on' : ''}" data-a="exPer" data-k="${k}">${l}</button>`).join('')}</div>
      ${per === 'range' ? `<div class="row2" style="margin-top:10px"><input class="inp" type="date" data-ex="from" value="${p.from || today()}" aria-label="De la"><input class="inp" type="date" data-ex="to" value="${p.to || addDays(today(), 30)}" aria-label="Până la"></div>` : ''}` : ''}
    <p class="small muted" style="margin:16px 4px 0">Pe telefon se deschide meniul de partajare: salvezi în Fișiere / Drive sau trimiți pe email / WhatsApp. Păstrează backup-ul și în afara telefonului.</p>
    </div><div class="bottom-bar"><button class="btn pri" data-a="doExport">${I.up}Exportă</button></div>`;
};

function periodRange(p) {
  const t = today(), per = p.per || 'all';
  if (per === 'week') return [monday(t), addDays(monday(t), 6)];
  if (per === 'month') { const d = parseD(t); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
  if (per === 'range') return [p.from || t, p.to || addDays(t, 30)];
  return ['0000-00-00', '9999-99-99'];
}
const csvCell = (v) => { v = String(v ?? ''); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const csv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');

function deliver(name, mime, content) {
  const blob = new Blob([content], { type: mime });
  let file = null;
  try { file = new File([blob], name, { type: mime }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: name }).then(() => true).catch((e) => { if (e && e.name === 'AbortError') return false; downloadBlob(blob, name); return true; });
  }
  downloadBlob(blob, name);
  return Promise.resolve(true);
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function doExport(p) {
  const fmt = p.fmt || 'json', stamp = today();
  if (fmt === 'json') {
    const data = JSON.stringify({ ...db, exportedAt: new Date().toISOString(), appVersion: APP_VERSION }, null, 2);
    deliver(`DentAgenda-backup-${stamp}.json`, 'application/json', data).then((ok) => { if (ok) { db.settings.lastBackup = new Date().toISOString(); save(); toast('Backup exportat'); render(); } });
    return;
  }
  const [from, to] = periodRange(p);
  const list = db.appointments.filter((a) => a.date >= from && a.date <= to).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  if (fmt === 'csvA') {
    const rows = [['Data', 'Ora', 'Durata (min)', 'Pacient', 'Telefon', 'Procedura', 'Status', 'Nota']].concat(list.map((a) => { const x = pat(a.pid) || {}; return [a.date, a.start, a.dur, x.name || '', x.phone || '', a.proc || '', (STATUS[a.status] || {}).l || a.status, a.note || '']; }));
    deliver(`DentAgenda-programari-${stamp}.csv`, 'text/csv', csv(rows)).then((ok) => ok && toast('Exportat'));
  } else if (fmt === 'csvP') {
    const rows = [['Nume', 'Telefon', 'Atentionari medicale', 'Observatii', 'Ultima vizita', 'Urmatoarea programare']].concat(db.patients.slice().sort((a, b) => a.name.localeCompare(b.name, 'ro')).map((x) => { const l = lastVisit(x.id), n = nextAppt(x.id); return [x.name, x.phone || '', x.alerts || '', x.notes || '', l ? l.date : '', n ? n.date + ' ' + n.start : '']; }));
    deliver(`DentAgenda-pacienti-${stamp}.csv`, 'text/csv', csv(rows)).then((ok) => ok && toast('Exportat'));
  } else if (fmt === 'pdf') {
    const byDay = {};
    list.forEach((a) => { (byDay[a.date] = byDay[a.date] || []).push(a); });
    const days = Object.keys(byDay).sort();
    $('#print').innerHTML = `<h1>${esc(db.settings.clinic || 'Agenda programări')}</h1><p>${(p.per || 'all') === 'all' ? 'Toate programările' : 'Perioada ' + shortDate(from) + ' – ' + shortDate(to)} · generat ${dayLabel(today()).toLowerCase()}</p>` +
      (days.length ? days.map((d) => `<h2>${dayLabel(d)}</h2><table><tr><th style="width:12%">Ora</th><th style="width:30%">Pacient</th><th style="width:18%">Telefon</th><th>Procedură</th><th style="width:14%">Status</th></tr>${byDay[d].map((a) => { const x = pat(a.pid) || {}; return `<tr><td>${a.start}–${toHM(endOf(a))}</td><td>${esc(x.name || '')}</td><td>${esc(x.phone || '')}</td><td>${esc(a.proc || '')}${a.note ? '<br><i>' + esc(a.note) + '</i>' : ''}</td><td>${esc((STATUS[a.status] || {}).l || '')}</td></tr>`; }).join('')}</table>`).join('') : '<p>Nicio programare în perioada aleasă.</p>');
    setTimeout(() => window.print(), 50);
  }
}

function importFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.patients) || !Array.isArray(d.appointments)) throw new Error('nu pare un backup DentAgenda');
      if (!confirm(`Backup cu ${d.patients.length} pacienți și ${d.appointments.length} programări${d.exportedAt ? ' (din ' + new Date(d.exportedAt).toLocaleDateString('ro-RO') + ')' : ''}.\n\nÎnlocuiești datele de acum de pe telefon?`)) return;
      db = normalize(d); save(); applyTheme(); toast('Date restaurate'); tab('today');
    } catch (e) { alert('Nu am putut citi fișierul: ' + e.message); }
  };
  r.readAsText(file);
}

function loadDemo() {
  const names = [['Andrei Popescu', '0721 111 214'], ['Maria Ionescu', '0744 222 381'], ['Elena Dumitru', '0733 333 102'], ['Radu Stan', '0755 444 917'], ['Ionuț Marin', '0766 555 640'], ['Roxana Pavel', '0722 666 053'], ['Cristina Vasile', '0745 777 288']];
  const ids = names.map(([name, phone]) => { const id = uid(); db.patients.push({ id, name, phone, alerts: name === 'Elena Dumitru' ? 'Alergie la penicilină' : '', notes: '', created: Date.now() }); return id; });
  const t = today(), wk = monday(t);
  const add = (pi, date, start, proc, dur, status) => db.appointments.push({ id: uid(), pid: ids[pi], date, start, proc, dur, status, note: '', created: Date.now() });
  add(0, t, '09:00', 'Control', 30, 'confirmat'); add(1, t, '10:00', 'Obturație', 60, 'neconfirmat');
  add(2, t, '11:30', 'Tratament canal', 90, 'confirmat'); add(3, t, '15:00', 'Extracție', 30, 'confirmat');
  add(5, addDays(wk, 0), '10:00', 'Detartraj', 45, 'finalizat'); add(6, addDays(wk, 1), '12:00', 'Consultație', 30, 'finalizat');
  add(4, addDays(t, 1), '09:30', 'Albire', 60, 'confirmat'); add(6, addDays(t, 2), '14:00', 'Obturație', 60, 'confirmat');
  add(4, addDays(t, -250), '11:00', 'Control', 30, 'finalizat');
  save();
}

/* ---------- acțiuni ---------- */
const form = () => cur().p.form;
const A = {
  ext: () => true,
  tab: (d) => tab(d.t),
  back: () => back(),
  day: (d) => { if (cur().name === 'today') { cur().p.date = d.d; render(true); } else tab('today', { date: d.d }); },
  wk: (d) => { const p = cur().p; p.wk = d.n === '0' ? monday(today()) : addDays(p.wk || monday(today()), Number(d.n)); render(true); },
  wslot: (d, el, e) => {
    const w = db.settings.work, ws = Math.floor(toMin(w.start) / 60) * 60, step = Number(w.step) || 30;
    const y = e.clientY - el.getBoundingClientRect().top;
    const m = ws + Math.floor((y / HPX * 60) / step) * step;
    go('form', { date: d.d, start: toHM(Math.max(m, toMin(w.start))) });
  },
  appt: (d) => go('appt', { id: d.id }),
  patient: (d) => { if (pat(d.id)) go('patient', { id: d.id }); },
  newAt: (d) => go('form', { date: d.d, start: d.t || '' }),
  newFor: (d) => go('form', { pid: d.id, date: today() }),
  newPatient: () => go('pform', {}),
  editPatient: (d) => go('pform', { id: d.id }),
  editAppt: (d) => go('form', { id: d.id }),
  pf: (d) => { cur().p.f = d.k; render(); },
  savePatient: () => {
    const p = cur().p, f = p.form, name = f.name.trim();
    if (!name) { alert('Scrie numele pacientului.'); return; }
    if (p.id) { Object.assign(pat(p.id), { name, phone: f.phone.trim(), alerts: f.alerts.trim(), notes: f.notes.trim() }); save(); toast('Salvat'); back(); }
    else { const id = uid(); db.patients.push({ id, name, phone: f.phone.trim(), alerts: f.alerts.trim(), notes: f.notes.trim(), created: Date.now() }); save(); toast('Pacient adăugat'); replace('patient', { id }); }
  },
  delPatient: (d) => {
    const x = pat(d.id), n = db.appointments.filter((a) => a.pid === d.id).length;
    if (!confirm(`Ștergi pacientul ${x.name}${n ? ' și cele ' + n + ' programări ale lui' : ''}? Nu se poate anula.`)) return;
    db.patients = db.patients.filter((p) => p.id !== d.id); db.appointments = db.appointments.filter((a) => a.pid !== d.id); save(); toast('Pacient șters'); back();
  },
  fPick: (d) => { const f = form(); f.pid = d.id; f.q = ''; render(); },
  fClearPat: () => { const f = form(); f.pid = null; render(); setTimeout(() => { const i = document.querySelector('[data-f=q]'); i && i.focus(); }, 30); },
  fNewPat: () => { const f = form(); f.newMode = true; const q = f.q.trim(); if (/^[\d\s+]+$/.test(q)) f.newPhone = q; else f.newName = q.replace(/\b\w/g, (c) => c.toUpperCase()); render(); },
  fCancelNew: () => { const f = form(); f.newMode = false; render(); },
  fProc: (d) => { const f = form(), pr = db.settings.procedures[Number(d.i)]; f.proc = pr.name; f.dur = Number(pr.dur) || 30; f.custom = false; render(); },
  fCustom: () => { const f = form(); f.custom = true; f.proc = ''; render(); setTimeout(() => { const i = document.querySelector('[data-f=proc]'); i && i.focus(); }, 30); },
  fSlot: (d) => { form().start = d.t; render(); },
  fDur: (d) => { form().dur = Number(d.v); render(); },
  fSave: () => {
    const p = cur().p, f = p.form;
    let pid = f.pid;
    if (!pid) {
      if (!f.newMode || !f.newName.trim()) { alert(f.newMode ? 'Scrie numele pacientului nou.' : 'Alege pacientul (sau creează unul nou).'); return; }
      pid = uid(); db.patients.push({ id: pid, name: f.newName.trim(), phone: f.newPhone.trim(), alerts: '', notes: '', created: Date.now() });
      f.pid = pid; f.newMode = false;
    }
    if (!f.date) { alert('Alege data.'); return; }
    if (!f.start) { alert('Alege ora.'); return; }
    if (!f.proc.trim()) f.proc = 'Consultație';
    if (overlaps(f.date, f.start, f.dur, p.id) && !confirm('Intervalul se suprapune cu altă programare. Salvezi oricum?')) { save(); render(); return; }
    if (p.id) { Object.assign(appt(p.id), { pid, date: f.date, start: f.start, dur: f.dur, proc: f.proc.trim(), status: f.status, note: f.note.trim() }); save(); toast('Programare actualizată'); back(); }
    else { db.appointments.push({ id: uid(), pid, date: f.date, start: f.start, dur: f.dur, proc: f.proc.trim(), status: f.status || 'confirmat', note: f.note.trim(), created: Date.now() }); save(); toast('Programare salvată'); tab('today', { date: f.date }); }
  },
  setStatus: (d) => { appt(d.id).status = d.s; save(); toast('Status: ' + STATUS[d.s].l); render(); },
  delAppt: (d) => { if (!confirm('Ștergi definitiv programarea? (Dacă pacientul a anulat, mai bine pune statusul „Anulat”.)')) return; db.appointments = db.appointments.filter((a) => a.id !== d.id); save(); toast('Programare ștearsă'); back(); },
  preset: (d) => { db.settings.theme = { preset: d.k, bg: PRESETS[d.k].bg, ink: PRESETS[d.k].ink, accent: PRESETS[d.k].accent }; save(); applyTheme(); render(); },
  color: (d) => { setColor(d.k, d.c); },
  goExport: () => go('export', {}),
  goProcs: () => go('procs'),
  goSms: () => go('sms'),
  import: () => $('#importFile').click(),
  exFmt: (d) => { cur().p.fmt = d.k; render(); },
  exPer: (d) => { cur().p.per = d.k; render(); },
  doExport: () => doExport(cur().p),
  procAdd: () => { db.settings.procedures.push({ name: 'Procedură nouă', dur: 30 }); save(); render(); setTimeout(() => { const l = document.querySelectorAll('[data-pk=name]'); const i = l[l.length - 1]; if (i) { i.focus(); i.select(); } }, 30); },
  procDel: (d) => { const pr = db.settings.procedures[Number(d.i)]; if (!confirm('Ștergi „' + pr.name + '” din listă?')) return; db.settings.procedures.splice(Number(d.i), 1); save(); render(); },
  smsReset: () => { db.settings.sms = DEFAULT_SMS; save(); render(); toast('Text implicit'); },
  demo: () => { loadDemo(); toast('Date de test încărcate'); tab('today'); },
  wipe: () => { if (!confirm('Ștergi TOȚI pacienții și TOATE programările de pe acest telefon?')) return; if (!confirm('Sigur? Fără backup, datele se pierd definitiv.')) return; const s = db.settings; db = defaults(); db.settings = s; save(); toast('Date șterse'); render(); }
};
function setColor(key, c) {
  const t = db.settings.theme;
  if (t.preset !== 'custom') { const pr = PRESETS[t.preset] || PRESETS.teal; t.bg = pr.bg; t.ink = pr.ink; t.accent = pr.accent; }
  t.preset = 'custom'; t[key] = c; save(); applyTheme(); render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.a];
  if (!fn) return;
  if (el.dataset.a === 'ext') { if (el.classList.contains('off')) e.preventDefault(); e.stopPropagation(); return; }
  e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('div[data-a][role=button]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', (e) => {
  const el = e.target, c = cur();
  if (el.dataset.f === 'pq') { c.p.q = el.value; $('#plist').innerHTML = patientsList(c.p.q, c.p.f || 'all'); return; }
  if (el.dataset.f && c.p.form) { c.p.form[el.dataset.f] = el.value; if (el.dataset.f === 'q') $('#pres').innerHTML = patResults(c.p.form); return; }
  if (el.dataset.s === 'sms' || el.dataset.s === 'clinic') { db.settings[el.dataset.s] = el.value; save(); return; }
  if (el.dataset.tc) { const t = db.settings.theme; if (t.preset !== 'custom') { const pr = PRESETS[t.preset] || PRESETS.teal; t.bg = pr.bg; t.ink = pr.ink; t.accent = pr.accent; } t.preset = 'custom'; t[el.dataset.tc] = el.value; applyTheme(); }
});
document.addEventListener('change', (e) => {
  const el = e.target, c = cur();
  if (el.id === 'importFile') { if (el.files[0]) importFile(el.files[0]); el.value = ''; return; }
  if (el.dataset.tc) { setColor(el.dataset.tc, el.value); return; }
  if (c.name === 'form' && (el.dataset.f === 'date' || el.dataset.f === 'start' || el.dataset.f === 'status')) { c.p.form[el.dataset.f] = el.value || (el.dataset.f === 'date' ? today() : ''); render(); return; }
  if (el.dataset.ex) { c.p[el.dataset.ex] = el.value; return; }
  if (el.dataset.pi !== undefined) { const pr = db.settings.procedures[Number(el.dataset.pi)]; if (el.dataset.pk === 'dur') pr.dur = Number(el.value); else pr.name = el.value.trim() || pr.name; save(); return; }
  if (el.dataset.s && el.dataset.s.startsWith('work.')) {
    const k = el.dataset.s.slice(5), w = db.settings.work;
    const val = k === 'step' ? Number(el.value) : el.value;
    if (k === 'start' && val && toMin(val) >= toMin(w.end)) { alert('Ora de început trebuie să fie înainte de sfârșit.'); render(); return; }
    if (k === 'end' && val && toMin(val) <= toMin(w.start)) { alert('Ora de sfârșit trebuie să fie după început.'); render(); return; }
    if (val) w[k] = val; save(); toast('Salvat'); return;
  }
});

/* ---------- start ---------- */
applyTheme();
history.replaceState({ n: 1 }, '');
render(true);
setInterval(() => { const n = cur().name; if ((n === 'today' || n === 'week') && !document.hidden) render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && (cur().name === 'today' || cur().name === 'week')) render(); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
