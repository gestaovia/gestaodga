/* ===================== Estrutura da interface ===================== */
let CUR = null;            // usuário logado
let ROUTE = { page: 'login', p: {} };
let DRAFT = null;          // rascunho de formulário em andamento
let SIDE_OPEN = false;

const ICON = { // ícones Lucide (ISC) — https://lucide.dev
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  car: '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  check: '<path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"/><path d="m9 11 3 3L22 4"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  toll: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  fine: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  report: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  handoff: '<path d="M17 12H3"/><path d="m11 18 6-6-6-6"/><path d="M21 5v14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  seat: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  road: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  obra: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  xls: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};
const ic = (k, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;

/* ----- tema claro / escuro (escolha salva neste aparelho) ----- */
const THEME_KEY = 'vialink-theme';
const themeNow = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || t === 'light' ? t : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); };
function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = themeNow() === 'dark' ? '#1C1C1C' : '#F4EFE4';
}
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { applyTheme(null); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { let saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (e) { } if (!saved) { applyTheme(null); render(); } }); } catch (e) { }
const themeBtn = (cls = '') => { const d = themeNow() === 'dark'; return `<button class="icon-btn ${cls}" data-act="theme" aria-label="${d ? 'Usar modo claro' : 'Usar modo escuro'}" title="${d ? 'Modo claro' : 'Modo escuro'}">${ic(d ? 'sun' : 'moon')}</button>`; };

const NAV = [
  { g: 'Visão geral', items: [['dashboard', 'Painel da frota', 'dash'], ['calendario', 'Calendário', 'cal']] },
  { g: 'Frota', items: [['veiculos', 'Veículos', 'car'], ['condutores', 'Condutores', 'user'], ['transferencias', 'Transferências', 'swap']] },
  { g: 'Controle', items: [['checklists', 'Checklists', 'check'], ['abastecimento', 'Abastecimentos', 'fuel'], ['manutencao', 'Manutenção', 'wrench'], ['pedagios', 'Pedágios', 'toll'], ['multas', 'Multas', 'fine']] },
  { g: 'Gestão', items: [['bonificacao', 'Premiação', 'trophy'], ['relatorios', 'Relatórios', 'report']] },
  { g: 'Sistema', items: [['configuracoes', 'Configurações', 'gear']] }
];
const PAGE_ROLES = { configuracoes: ['admin', 'gestor'] };
const isManager = () => CUR && ['admin', 'gestor'].includes(CUR.role);
const isStaff = () => CUR && CUR.role !== 'condutor';
const canPage = page => !PAGE_ROLES[page] || PAGE_ROLES[page].includes(CUR.role);
const myDriver = () => CUR?.driverId ? drv(CUR.driverId) : null;

const PAGES = {}; // registrado nos demais arquivos: PAGES[nome] = { title, render(p), mount?(p), driver? }

function go(page, p = {}, opts = {}) {
  ROUTE = { page, p };
  if (CUR && page !== 'login') { try { sessionStorage.setItem('gv-route', JSON.stringify({ page, p })); } catch (e) { } }
  if (!opts.keepDraft) DRAFT = null;
  SIDE_OPEN = false;
  if (!opts.noPush) { try { history.pushState({ page, p }, ''); } catch (e) { } }
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', e => { if (e.state && CUR) { ROUTE = e.state; DRAFT = null; render(); } });

function render() {
  const root = $('#app');
  stopCamera(); if (typeof destroyMaps === "function") destroyMaps();
  if (!CUR || ROUTE.page === 'login') { root.innerHTML = PAGES.login.render() + themeBtn('theme-fab'); PAGES.login.mount?.(); return; }
  let pg = PAGES[ROUTE.page];
  if (!pg || (!pg.driver && CUR.role === 'condutor') || !canPage(ROUTE.page)) { ROUTE = { page: homePage(), p: {} }; pg = PAGES[ROUTE.page]; }
  const body = pg.render(ROUTE.p);
  if (CUR.role === 'condutor') {
    root.innerHTML = `<div class="drv-shell">${driverTop()}${body}</div>`;
  } else {
    const rb = pg.rightbar ? pg.rightbar(ROUTE.p) : '';
    root.innerHTML = `<div class="app">${sidebar()}${SIDE_OPEN ? '<div class="scrim" data-act="side-close"></div>' : ''}<div class="main">${topbar(pg)}<div class="body-wrap ${rb ? 'with-rb' : ''}"><div class="content">${body}</div>${rb ? `<aside class="rightbar">${rb}</aside>` : ''}</div></div></div>`;
  }
  pg.mount?.(ROUTE.p);
  if (CUR.role === 'condutor') GPS.refresh();
}
const homePage = () => CUR.role === 'condutor' ? 'inicio' : 'dashboard';

function sidebar() {
  const counts = { transferencias: S.transfers.filter(t => !['concluida', 'cancelada'].includes(t.status)).length, dashboard: attentionItems().filter(a => ['bad', 'urg'].includes(a.c)).length };
  const groups = NAV.map(g => {
    const items = g.items.filter(([k]) => canPage(k));
    if (!items.length) return '';
    return `<div class="nav-group">${g.g}</div>` + items.map(([k, l, i]) => `<button data-go="${k}" class="${ROUTE.page === k || (PARENT[ROUTE.page] === k) ? 'on' : ''}">${ic(i)}<span>${l}</span>${counts[k] ? `<span class="count ${k === 'dashboard' ? 'crit' : ''}">${counts[k]}</span>` : ''}</button>`).join('');
  }).join('');
  return `<aside class="side ${SIDE_OPEN ? 'open' : ''}"><div class="brand">${orgBrand()}</div>
    <nav class="nav" aria-label="Menu principal">${groups}</nav>
    <div class="side-foot">${av(CUR)}<div style="flex:1;min-width:0"><b style="color:var(--text2);display:block">${esc(CUR.name)}</b>${roleLabel(CUR)}</div><button class="icon-btn" data-act="logout" aria-label="Sair" title="Sair">${ic('logout')}</button></div></aside>`;
}
// foto de perfil: do próprio usuário ou, para um condutor, do usuário vinculado a ele
const photoOf = o => o ? (o.avatar || (S?.users || []).find(u => u.driverId === o.id || (o.driverId && u.id === o.id))?.avatar || null) : null;
const av = (o, size = '') => { const ph = photoOf(o); return ph && /^data:image\/(jpeg|png|webp);base64,/.test(ph) ? `<span class="avatar img ${size}"><img src="${esc(ph)}" alt=""></span>` : `<span class="avatar ${size}">${initials(o?.name || '?')}</span>`; };
const orgOf = () => S?.settings?.org || {};
const orgLogoOk = l => typeof l === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(l);
function orgBrand(compact) {
  const o = orgOf(); const nm = o.displayName || o.name || 'GestaoVia';
  const logo = orgLogoOk(o.logo) ? `<img class="org-logo" src="${o.logo}" alt="">` : brandMark();
  if (compact) return `${logo}<b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nm)}</b>`;
  return `${logo}<div style="min-width:0"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${esc(nm)}</b><span>GestaoVia${APP_VERSION ? ` · v${APP_VERSION}` : ''}</span></div>`;
}
const brandMark = () => `<img class="brand-logo" src="${window.GV_LOGO || ''}" alt="GestaoVia">`;
const PARENT = { veiculo: 'veiculos', condutor: 'condutores', transferencia: 'transferencias', scan_result: 'veiculos', checklist_view: 'checklists', forcar: 'transferencias', checklist_full: 'manutencao', scanner: 'veiculos', abastecer: 'abastecimento', obra: 'veiculos', problema: 'veiculos' };
function topbar(pg) {
  const parent = PARENT[ROUTE.page];
  const parentTitle = parent ? NAV.flatMap(g => g.items).find(i => i[0] === parent)?.[1] : null;
  const title = typeof pg.title === 'function' ? pg.title(ROUTE.p) : pg.title;
  const unread = myNotifications().filter(n => !n.read).length;
  return `<header class="top">
    <button class="icon-btn menu-btn" data-act="side-open" aria-label="Abrir menu">${ic('menu')}</button>
    ${parentTitle ? `<button class="icon-btn" data-go="${parent}" aria-label="Voltar para ${parentTitle}" title="${parentTitle}">${ic('back')}</button>` : ''}
    <h1>${esc(title)}</h1>
    <div class="spacer"></div>
    ${syncBadge()}
    <button class="icon-btn scan" data-go="scanner" aria-label="Escanear QR Code" title="Escanear QR Code">${ic('qr')}</button>
    <button class="icon-btn" data-act="notifs" aria-label="Notificações" title="Notificações">${ic('bell')}${unread ? `<span class="badge">${unread}</span>` : ''}</button>
    ${themeBtn()}
    <button class="who" data-go="perfil" title="Meu perfil" style="border:0;background:none;cursor:pointer;color:inherit">${av(CUR)}<span class="nm">${esc(CUR.name.split(' ')[0])}</span></button>
  </header>`;
}
function driverTop() {
  const unread = myNotifications().filter(n => !n.read).length;
  const home = ROUTE.page === 'inicio';
  return `<header class="top" style="padding-inline:16px">
    ${home ? orgBrand(true) : `<button class="icon-btn" data-go="inicio" aria-label="Voltar ao início">${ic('back')}</button><h1>${esc(typeof PAGES[ROUTE.page]?.title === 'function' ? PAGES[ROUTE.page].title(ROUTE.p) : PAGES[ROUTE.page]?.title || '')}</h1>`}
    <div class="spacer"></div>
    <button class="icon-btn" data-act="notifs" aria-label="Notificações">${ic('bell')}${unread ? `<span class="badge">${unread}</span>` : ''}</button>
    ${themeBtn()}
    <button class="icon-btn" data-go="perfil" aria-label="Meu perfil" style="padding:0;overflow:hidden">${av(CUR)}</button>
    <button class="icon-btn" data-act="logout" aria-label="Sair">${ic('logout')}</button>
  </header>`;
}
function myNotifications() {
  if (!CUR) return [];
  return S.notifications.filter(n => n.to === CUR.driverId || n.to === CUR.id || (n.to === 'gestao' && isStaff())).sort((a, b) => b.at - a.at);
}

/* ----- componentes ----- */
const plate = (p, lg) => `<span class="plate ${lg ? 'lg' : ''}"><i></i><span>${esc(p)}</span></span>`;
const stTag = s => `<span class="st"><span class="dot ${V_STATUS[s].c}"></span>${V_STATUS[s].l}</span>`;
const pill = (txt, c = '') => `<span class="pill ${c}">${txt}</span>`;
const mLvl = l => `<span class="st"><span class="dot ${M_LEVEL[l].c}"></span>${M_LEVEL[l].l}</span>`;
const projLabel = id => { const p = prj(id); return p ? `${esc(p.code)}` : '<span class="st"><span class="dot urg"></span>Sem obra</span>'; };
const projFull = id => { const p = prj(id); return p ? `${esc(p.code)} <span class="muted">· ${esc(p.name)}</span>` : 'Sem obra'; };
const ccLabel = id => { const c = ccOf(id); return c ? `${c.code} – ${esc(c.name)}` : '—'; };
const drvLink = id => { const d = drv(id); if (!d) return '<span class="muted">—</span>'; return isStaff() ? `<button class="link" data-go="condutor" data-id="${d.id}">${esc(d.name)}</button>` : esc(d.name); };
const vehLink = id => { const v = veh(id); if (!v) return '—'; return isStaff() ? `<button class="link" data-go="veiculo" data-id="${v.id}" style="text-decoration:none">${plate(v.plate)}</button>` : plate(v.plate); };
const empty = t => `<div class="panel-b muted">${t}</div>`;
function photoSrc(p, label = '') {
  if (!p) return null;
  if (typeof p !== 'string') return null;
  if (/^data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+$/.test(p) || /^https:\/\//.test(p)) return p;
  if (p.startsWith('sb:')) { const u = CLOUD.fileUrl(p); if (u) return u; label = 'Foto indisponível'; p = 'x:'; }
  const lab = { frontal: 'Frontal', traseira: 'Traseira', lat_dir: 'Lateral dir.', lat_esq: 'Lateral esq.', painel: 'Painel', cupom: 'Cupom fiscal' }[p.split(':')[1]] || label;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 160 120"><rect width="160" height="120" fill="#C9CED3"/><path d="M28 80h104M36 80v-16l10-18h68l10 18v16" stroke="#7B838B" stroke-width="3" fill="none"/><circle cx="54" cy="84" r="9" fill="#7B838B"/><circle cx="106" cy="84" r="9" fill="#7B838B"/><text x="80" y="22" font-family="sans-serif" font-size="12" fill="#3E454C" text-anchor="middle">${lab}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function thumbs(photos) {
  if (!photos) return '';
  const ks = Object.entries(photos).filter(([, v]) => v && !v.startsWith('removida'));
  if (!ks.length) return '<span class="muted small">Sem fotos</span>';
  return `<div class="thumbs">${ks.map(([k, v]) => `<img src="${esc(photoSrc(v, k))}" alt="${esc((PHOTO_SLOTS.find(s => s[0] === k) || [0, k])[1])}" data-act="photo" data-src="${k}">`).join('')}</div>`;
}

/* ----- modal e aviso ----- */
function openModal({ title, body, foot = '', wide = false, onMount }) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal-bg'; el.id = 'modal';
  el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h2>${esc(title)}</h2><button class="x-btn" data-act="modal-close" aria-label="Fechar">×</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  el.addEventListener('click', e => { if (e.target === el) closeModal(); });
  document.body.appendChild(el);
  onMount?.(el);
  return el;
}
function closeModal() { $('#modal')?.remove(); }
let toastT = null;
function toast(msg) {
  $('.toast')?.remove(); clearTimeout(toastT);
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  toastT = setTimeout(() => t.remove(), 3600);
}

/* ----- eventos globais ----- */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); const p = {}; Object.entries(g.dataset).forEach(([k, v]) => { if (k !== 'go') p[k] = v; }); closeModal(); go(g.dataset.go, p); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'side-open') { SIDE_OPEN = true; render(); }
  else if (act === 'side-close') { SIDE_OPEN = false; render(); }
  else if (act === 'modal-close') closeModal();
  else if (act === 'logout') CLOUD.leave();
  else if (act === 'notifs') showNotifications();
  else if (act === 'theme') { const t = themeNow() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(THEME_KEY, t); } catch (x) { } applyTheme(t); render(); }
  else if (act === 'photo') { openModal({ title: 'Foto', body: `<img src="${esc(e.target.src)}" alt="" style="width:100%">`, wide: true }); }
  else if (ACTIONS[act]) ACTIONS[act](a, e);
});
const ACTIONS = {};

function showNotifications() {
  const ns = myNotifications();
  openModal({
    title: 'Notificações',
    body: ns.length ? `<ul class="att" style="padding:0">${ns.slice(0, 30).map(n => `<li ${n.link && PAGES[n.link.page] ? `data-go="${esc(n.link.page)}" data-id="${esc(n.link.id || '')}"` : ''}><span class="ic ${n.level === 'info' ? 'neu' : n.level}">${ic('bell')}</span><div>${esc(n.text)}${n.read ? '' : ' <span class="pill blue">nova</span>'}</div><span class="when">${fmtShort(n.at)}</span></li>`).join('')}</ul>` : '<p class="empty">Nenhuma notificação.</p>',
    foot: ns.length ? '<button class="btn" data-act="notifs-read">Marcar todas como lidas</button>' : ''
  });
}
ACTIONS['notifs-read'] = () => { myNotifications().forEach(n => n.read = true); save(); closeModal(); render(); };

/* ----- utilidades de formulário ----- */
function formData(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; }
function projectOptions(sel) { return S.projects.filter(p => p.active).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.code)} – ${esc(p.name)}</option>`).join(''); }
function ccOptions(sel) { return S.costCenters.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.code} – ${esc(c.name)}</option>`).join(''); }
function purposeOptions(sel) { return PURPOSES.map(p => `<option ${p === sel ? 'selected' : ''}>${p}</option>`).join(''); }
function driverOptions(sel, filter = () => true) { return S.drivers.filter(filter).map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join(''); }

// redimensiona a foto antes do envio (economiza dados móveis e armazenamento)
function readPhoto(file, maxW = 640) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxW / img.width); const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', .62));
      };
      img.onerror = () => res(fr.result);
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
