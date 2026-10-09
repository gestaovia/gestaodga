/* ===================== Relatórios mensais (PDF e Excel) e fechamento da premiação ===================== */
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthRange = key => { const [y, m] = key.split('-').map(Number); return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()]; };
const monthName = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]}/${y}`; };
const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1).getTime()); };
const closingCfg = () => { const s = S.settings.score; return s.closing || (s.closing = { auto: true, day: 5 }); };
const closingOf = key => (S.closings || []).find(c => c.month === key) || null;

/* ---------- carregamento sob demanda das bibliotecas (só quando exporta) ---------- */
const LIBS = {};
function loadScript(src) {
  return LIBS[src] || (LIBS[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete LIBS[src]; rej(new Error('Não foi possível carregar o gerador de arquivos. Verifique a internet.')); }; document.head.appendChild(s); }));
}
const needXlsx = () => window.XLSX ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
async function needPdf() { if (!window.jspdf?.jsPDF) throw new Error('O gerador de PDF não carregou. Verifique a internet.'); if (!window.jspdf.jsPDF.API.autoTable) await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'); }

/* ---------- km por obra: tempo de cada trecho de obra dentro da posse ---------- */
function kmByProject(from, to) {
  const out = {};
  S.custody.forEach(c => {
    const end = c.end || nowTs(); const endKm = c.endKm ?? veh(c.vehicleId)?.odometer ?? c.startKm; if (end <= c.start) return;
    const kmPerMs = (endKm - c.startKm) / (end - c.start);
    const segs = c.segments.length ? c.segments : [{ at: c.start, projectId: null }];
    segs.forEach((s, i) => {
      const a = Math.max(i ? s.at : c.start, from), b = Math.min(segs[i + 1]?.at ?? end, end, to);
      if (b > a) out[s.projectId || '_'] = (out[s.projectId || '_'] || 0) + kmPerMs * (b - a);
    });
  });
  return out;
}
function rentalInMonth(v, from, to) {
  const r = v.rental; if (v.ownership !== 'locada' || !r?.monthly) return 0;
  const a = Math.max(from, r.pickupDate || from), b = Math.min(to, r.returnedAt || to);
  return b > a ? r.monthly * (b - a) / (to - from) : 0;
}

/* ---------- dados do mês ---------- */
function monthReport(key) {
  const [from, to] = monthRange(key); const rows = periodCosts(from, to);
  const sumK = (f, kind) => sum(rows.filter(r => f(r) && r.kind === kind), r => r.value);
  const inP = t => t >= from && t < to;
  const vehicles = S.vehicles.map(v => {
    const f = r => r.vehicleId === v.id; const fuels = S.fuel.filter(x => x.vehicleId === v.id && inP(x.at));
    const kmv = kmInPeriod(from, to, c => c.vehicleId === v.id); const lit = sum(fuels, x => x.liters);
    const o = { placa: v.plate, veiculo: `${v.brand} ${v.model}`, frota: v.ownership === 'locada' ? 'Locada' : 'Própria', km: Math.round(kmv), litros: lit, consumo: lit ? kmv / lit : null,
      combustivel: sumK(f, 'Combustível'), pedagios: sumK(f, 'Pedágios'), multas: sumK(f, 'Multas'), manutencao: sumK(f, 'Manutenção'), documentacao: sumK(f, 'Documentação'), locacao: rentalInMonth(v, from, to),
      checklists: S.checklists.filter(k => k.vehicleId === v.id && inP(k.at)).length, ocorrencias: S.issues.filter(i => i.vehicleId === v.id && inP(i.at)).length };
    o.total = o.combustivel + o.pedagios + o.multas + o.manutencao + o.documentacao + o.locacao; o.custoKm = o.km > 0 ? o.total / o.km : null;
    return o;
  }).filter(o => o.km || o.total || o.checklists).sort((a, b) => b.total - a.total);
  const drivers = S.drivers.filter(d => !d._ro).map(d => {
    const f = r => r.driverId === d.id; const sc = driverScore(d.id, from, Math.min(to, nowTs()));
    const fines = S.fines.filter(x => inP(x.at) && fineMatch(x).driverId === d.id);
    const o = { condutor: d.name, km: Math.round(kmInPeriod(from, to, c => c.driverId === d.id)), posses: S.custody.filter(c => c.driverId === d.id && c.start < to && (!c.end || c.end > from)).length,
      diarios: sc.req ? `${sc.done}/${sc.req}` : '—', atrasos: sc.late, abastecimentos: S.fuel.filter(x => x.driverId === d.id && inP(x.at)).length,
      combustivel: sumK(f, 'Combustível'), pedagios: sumK(f, 'Pedágios'), multasQtd: fines.length, multas: sumK(f, 'Multas'), pontuacao: Math.round(sc.total), premio: 0 };
    o.posses ? (o.premio = sc.bonus) : (o.pontuacao = null);
    o.total = o.combustivel + o.pedagios + o.multas; return o;
  }).filter(o => o.km || o.total || o.posses).sort((a, b) => a.condutor.localeCompare(b.condutor, 'pt-BR'));
  const kmP = kmByProject(from, to);
  const ids = [...new Set([...rows.map(r => r.projectId || '_'), ...Object.keys(kmP)])];
  const projects = ids.map(id => {
    const f = r => (r.projectId || '_') === id; const p = prj(id);
    const cs = S.custody.filter(c => c.start < to && (!c.end || c.end > from) && c.segments.some(s => (s.projectId || '_') === id));
    const o = { obra: p ? p.code : 'Sem obra', descricao: p?.name || 'Custos sem obra identificada', km: Math.round(kmP[id] || 0),
      combustivel: sumK(f, 'Combustível'), pedagios: sumK(f, 'Pedágios'), multas: sumK(f, 'Multas'), manutencao: sumK(f, 'Manutenção'), documentacao: sumK(f, 'Documentação'),
      veiculos: new Set(cs.map(c => c.vehicleId)).size, condutores: new Set(cs.map(c => c.driverId)).size };
    o.total = o.combustivel + o.pedagios + o.multas + o.manutencao + o.documentacao; return o;
  }).filter(o => o.km || o.total).sort((a, b) => b.total - a.total);
  return { key, from, to, vehicles, drivers, projects };
}
const COLS = {
  vehicles: [['placa', 'Placa'], ['veiculo', 'Veículo'], ['frota', 'Frota'], ['km', 'Km rodados', 'int'], ['litros', 'Litros', 'n1'], ['consumo', 'Km/l', 'n1'], ['combustivel', 'Combustível', 'R$'], ['pedagios', 'Pedágios', 'R$'], ['multas', 'Multas', 'R$'], ['manutencao', 'Manutenção', 'R$'], ['documentacao', 'Documentação', 'R$'], ['locacao', 'Locação', 'R$'], ['total', 'Total', 'R$'], ['custoKm', 'Custo/km', 'R$'], ['checklists', 'Checklists', 'int'], ['ocorrencias', 'Ocorrências', 'int']],
  drivers: [['condutor', 'Condutor'], ['km', 'Km rodados', 'int'], ['posses', 'Posses', 'int'], ['diarios', 'Diários feitos'], ['atrasos', 'Atrasos', 'int'], ['abastecimentos', 'Abastec.', 'int'], ['combustivel', 'Combustível', 'R$'], ['pedagios', 'Pedágios', 'R$'], ['multasQtd', 'Multas (qtd)', 'int'], ['multas', 'Multas', 'R$'], ['total', 'Total', 'R$'], ['pontuacao', 'Pontuação', 'int'], ['premio', 'Prêmio', 'R$']],
  projects: [['obra', 'Obra (CC)'], ['descricao', 'Descrição'], ['km', 'Km rodados', 'int'], ['veiculos', 'Veículos', 'int'], ['condutores', 'Condutores', 'int'], ['combustivel', 'Combustível', 'R$'], ['pedagios', 'Pedágios', 'R$'], ['multas', 'Multas', 'R$'], ['manutencao', 'Manutenção', 'R$'], ['documentacao', 'Documentação', 'R$'], ['total', 'Total', 'R$']]
};
const REP_TITLES = { vehicles: 'Por veículo', drivers: 'Por condutor', projects: 'Por obra', premiacao: 'Fechamento da premiação' };
const fmtCell = (v, t) => v == null || v === '' ? '—' : typeof v === 'string' && t ? v : t === 'R$' ? money(v) : t === 'int' ? nf(v) : t === 'n1' ? nf(v, 1) : String(v);
const totalsRow = (list, cols) => Object.fromEntries(cols.map(([k, , t], i) => [k, i === 0 ? 'Total' : (t === 'R$' && k !== 'custoKm') || (t === 'int' && !['pontuacao'].includes(k)) || k === 'litros' ? sum(list, o => o[k]) : '']));

/* ---------- fechamento da premiação ---------- */
function buildClosing(key, auto) {
  const [from, to] = monthRange(key);
  // só participa do fechamento quem teve posse de veículo no mês
  const rows = S.drivers.filter(d => !d._ro && S.custody.some(c => c.driverId === d.id && c.start < to && (!c.end || c.end > from))).map(d => {
    const sc = driverScore(d.id, from, to);
    return { driverId: d.id, name: d.name, score: Math.round(sc.total * 10) / 10, tier: sc.tier ? `A partir de ${sc.tier.min}` : '', bonus: sc.bonus || 0, parts: sc.parts.map(p => ({ l: p.l, v: Math.round(p.v * 10) / 10, max: p.max, info: p.info })) };
  }).sort((a, b) => b.score - a.score);
  return { id: uid(), month: key, closedAt: nowTs(), closedBy: CUR.id, auto: !!auto, rows, total: sum(rows, r => r.bonus) };
}
function closeMonth(key, auto) {
  if (closingOf(key)) return null;
  const c = buildClosing(key, auto); if (auto && !c.rows.length) return null; /* mês sem posses: nada a fechar */ S.closings = S.closings || []; S.closings.push(c);
  log('premiacao', `Fechamento da premiação de ${monthName(key)} ${auto ? 'feito automaticamente' : `feito por ${CUR.name}`}: ${c.rows.filter(r => r.bonus).length} premiado(s), ${money(c.total)}`, {});
  notify('gestao', `Fechamento da premiação de ${monthName(key)} concluído${auto ? ' automaticamente' : ''}: ${money(c.total)} em prêmios.`, { level: 'ok', link: { page: 'relatorios', id: '' } });
  return c;
}
// fechamento automático: no dia configurado, fecha o mês anterior (feito por quem da gestão abrir o sistema)
function autoCloseCheck() {
  if (!isManager()) return;
  const cfg = closingCfg(); if (!cfg.auto) return;
  const now = new Date(); if (now.getDate() < (cfg.day || 1)) return;
  const prev = shiftMonth(monthKey(nowTs()), -1);
  if (closingOf(prev)) return;
  if (closeMonth(prev, true)) { save(); toast(`Premiação de ${monthName(prev)} fechada automaticamente.`); }
}

/* ---------- tela ---------- */
let REP_M = null;
PAGES.relatorios = {
  title: 'Relatórios',
  render({ tab = 'vehicles' }) {
    REP_M = REP_M || monthKey(nowTs());
    const R = monthReport(REP_M); const cur = REP_M === monthKey(nowTs());
    const tabs = Object.entries(REP_TITLES).map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-go="relatorios" data-tab="${k}">${l}</button>`).join('');
    let body;
    if (tab === 'premiacao') body = closingView(REP_M);
    else {
      const list = R[tab]; const cols = COLS[tab]; const tot = totalsRow(list, cols);
      body = `<div class="panel"><div class="panel-h"><h3>${REP_TITLES[tab]} · ${monthName(REP_M)}</h3><div class="row"><button class="btn sm" data-act="rep-pdf" data-k="${tab}">${ic('doc')}PDF</button><button class="btn sm" data-act="rep-xls" data-k="${tab}">${ic('xls')}Excel</button></div></div>
        ${tbl(cols.map(([, l, t]) => (t ? '>' : '') + l), list.length ? [...list, tot].map((o, i) => `<tr>${cols.map(([k, , t]) => `<td class="${t ? 'r' : ''}">${i === list.length ? `<b>${o[k] === '' ? '' : esc(fmtCell(o[k], t))}</b>` : esc(fmtCell(o[k], t))}</td>`).join('')}</tr>`) : [], 'Sem movimento neste mês.')}</div>`;
    }
    return `<div class="page-head"><div class="row" style="gap:8px"><button class="icon-btn" data-act="rep-m" data-d="-1" aria-label="Mês anterior">${ic('back')}</button><b style="min-width:150px;text-align:center;text-transform:capitalize">${monthName(REP_M)}</b><button class="icon-btn" data-act="rep-m" data-d="1" aria-label="Próximo mês" ${cur ? 'disabled' : ''}>${ic('chev')}</button>${cur ? pill('mês atual · parcial') : ''}</div>
        <button class="btn" data-act="rep-xls-all">${ic('xls')}Excel completo do mês</button></div>
      <div class="panel"><div class="panel-h"><div class="tabs">${tabs}</div></div></div>
      <div class="stack" style="margin-top:12px">${body}</div>`;
  }
};
function closingView(key) {
  const c = closingOf(key); const cfg = closingCfg(); const M = isManager(); const cur = key === monthKey(nowTs());
  const data = c || buildClosing(key, false);
  const rows = data.rows.map((r, i) => `<tr><td class="num">${i + 1}º</td><td><span class="row" style="gap:8px;flex-wrap:nowrap">${av(drv(r.driverId) || { name: r.name })}${esc(r.name)}</span></td><td class="r">${nf(r.score, 1)}</td><td class="small">${esc(r.tier || '—')}</td><td class="r"><b>${money(r.bonus)}</b></td></tr>`);
  const status = c ? `<div class="note ok">${ic('lock')}<div><b>Mês fechado</b> em ${fmtDT(c.closedAt)} ${c.auto ? '(automático)' : `por ${esc(userName(c.closedBy))}`}. Os valores abaixo ficam guardados como estavam no fechamento.</div></div>`
    : `<div class="note ${cur ? '' : 'warn'}">${ic('cal')}<div><b>${cur ? 'Prévia do mês em andamento' : 'Mês ainda não fechado'}</b> — ${cfg.auto ? `fechamento automático no dia ${cfg.day} do mês seguinte` : 'fechamento automático desligado'}. <button class="link" data-go="bonificacao" data-tab="metricas">Configurar</button></div></div>`;
  return `${status}
    <div class="kpis">${kpi('Condutores', data.rows.length, 'user')}${kpi('Premiados', data.rows.filter(r => r.bonus).length, 'trophy', 'c-green')}${kpi('Total de prêmios', money(data.total), 'star')}</div>
    <div class="panel"><div class="panel-h"><h3>Premiação · ${monthName(key)}</h3><div class="row">
      <button class="btn sm" data-act="rep-pdf" data-k="premiacao">${ic('doc')}PDF para o RH</button><button class="btn sm" data-act="rep-xls" data-k="premiacao">${ic('xls')}Excel</button>
      ${M && !c && !cur ? `<button class="btn sm ok" data-act="close-month">${ic('lock')}Fechar o mês</button>` : ''}${c && CUR.role === 'admin' ? '<button class="btn sm danger" data-act="reopen-month">Reabrir</button>' : ''}</div></div>
      ${tbl(['#', 'Condutor', '>Pontuação', 'Faixa', '>Prêmio'], rows, 'Nenhum condutor com posse neste mês.')}</div>`;
}
ACTIONS['rep-m'] = a => { REP_M = shiftMonth(REP_M, +a.dataset.d); if (REP_M > monthKey(nowTs())) REP_M = monthKey(nowTs()); render(); };
ACTIONS['close-month'] = () => openModal({ title: `Fechar ${monthName(REP_M)}`, body: '<p>A pontuação e o prêmio de cada condutor ficam guardados como estão agora e vão para o relatório do RH. Só o administrador pode reabrir.</p>', foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="close-month-ok">Fechar o mês</button>' });
ACTIONS['close-month-ok'] = () => { closeMonth(REP_M, false); save(); closeModal(); toast('Mês fechado.'); render(); };
ACTIONS['reopen-month'] = () => openModal({ title: `Reabrir ${monthName(REP_M)}`, body: '<p>O fechamento será desfeito e os valores voltam a ser calculados com os dados atuais.</p>', foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn danger" data-act="reopen-month-ok">Reabrir</button>' });
ACTIONS['reopen-month-ok'] = () => { const c = closingOf(REP_M); if (c) { S.closings = S.closings.filter(x => x !== c); log('premiacao', `Fechamento da premiação de ${monthName(REP_M)} reaberto por ${CUR.name}`, {}); save(); } closeModal(); toast('Mês reaberto.'); render(); };

/* ---------- exportação ---------- */
function premRows(key) {
  const c = closingOf(key) || buildClosing(key, false);
  const crit = [...new Set(c.rows.flatMap(r => r.parts.map(p => p.l)))];
  return { c, crit, cols: [['pos', '#', 'int'], ['name', 'Condutor'], ...crit.map(l => ['p:' + l, l, 'n1']), ['score', 'Pontuação', 'n1'], ['tier', 'Faixa'], ['bonus', 'Prêmio', 'R$']],
    list: c.rows.map((r, i) => ({ pos: i + 1, ...r, ...Object.fromEntries(r.parts.map(p => ['p:' + p.l, p.v])) })) };
}
function sheetOf(cols, list, withTotal = true) {
  const head = cols.map(([, l]) => l);
  const body = list.map(o => cols.map(([k, , t]) => { const v = o[k]; return v == null || v === '' ? '' : (t === 'R$' || t === 'n1') ? Math.round(v * 100) / 100 : v; }));
  if (withTotal && list.length) { const t = totalsRow(list, cols); body.push(cols.map(([k]) => t[k] === '' ? '' : typeof t[k] === 'number' ? Math.round(t[k] * 100) / 100 : t[k])); }
  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  ws['!cols'] = cols.map(([, l, t]) => ({ wch: Math.max(l.length + 2, t ? 12 : 22) }));
  cols.forEach(([, , t], ci) => { if (t !== 'R$') return; for (let r = 1; r <= body.length; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c: ci })]; if (cell && typeof cell.v === 'number') cell.z = '"R$" #,##0.00'; } });
  return ws;
}
async function exportXlsx(kinds) {
  await needXlsx();
  const wb = XLSX.utils.book_new(); const R = monthReport(REP_M);
  kinds.forEach(k => {
    if (k === 'premiacao') { const P = premRows(REP_M); XLSX.utils.book_append_sheet(wb, sheetOf(P.cols, P.list), 'Premiação'); }
    else XLSX.utils.book_append_sheet(wb, sheetOf(COLS[k], R[k]), { vehicles: 'Veículos', drivers: 'Condutores', projects: 'Obras' }[k]);
  });
  const org = orgOf(); const info = XLSX.utils.aoa_to_sheet([['Relatório', kinds.length > 1 ? 'Relatório completo do mês' : REP_TITLES[kinds[0]]], ['Mês', monthName(REP_M)], ['Empresa', org.name || org.displayName || ''], ['CNPJ', org.cnpj ? cnpjFmt(org.cnpj) : ''], ['Gerado em', fmtDT(nowTs())], ['Gerado por', CUR.name]]);
  info['!cols'] = [{ wch: 14 }, { wch: 40 }]; XLSX.utils.book_append_sheet(wb, info, 'Informações');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await offerFile(`GestaoVia_${kinds.length > 1 ? 'completo' : kinds[0]}_${REP_M}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
async function exportPdf(kind) {
  await needPdf();
  const { jsPDF } = window.jspdf; const land = kind !== 'premiacao';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth(); const org = orgOf();
  doc.setFillColor(46, 46, 46); doc.rect(0, 0, W, 24, 'F'); doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${org.displayName || org.name || 'GestaoVia'}${org.cnpj ? ` · CNPJ ${cnpjFmt(org.cnpj)}` : ''}`, 14, 9);
  doc.setFontSize(15); doc.text(`${kind === 'premiacao' ? 'Fechamento da premiação' : 'Relatório mensal · ' + REP_TITLES[kind].toLowerCase()} — ${monthName(REP_M)}`, 14, 18);
  doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  let cols, list, y = 32;
  if (kind === 'premiacao') {
    const P = premRows(REP_M); cols = [['pos', '#', 'int'], ['name', 'Condutor'], ['score', 'Pontuação', 'n1'], ['tier', 'Faixa'], ['bonus', 'Prêmio', 'R$']]; list = P.list;
    doc.text(P.c.closedAt && closingOf(REP_M) ? `Mês fechado em ${fmtDT(P.c.closedAt)}${P.c.auto ? ' (automático)' : ''}.` : 'Prévia: o mês ainda não foi fechado; os valores podem mudar.', 14, y); y += 5;
  } else { cols = COLS[kind]; list = monthReport(REP_M)[kind]; }
  const tot = totalsRow(list, cols);
  doc.autoTable({
    startY: y, head: [cols.map(([, l]) => l)], body: list.map(o => cols.map(([k, , t]) => fmtCell(o[k], t))),
    foot: list.length ? [cols.map(([k, , t], i) => i === 0 ? 'Total' : tot[k] === '' ? '' : fmtCell(tot[k], t))] : undefined,
    styles: { font: 'helvetica', fontSize: land ? 7.5 : 9, cellPadding: 1.6 }, headStyles: { fillColor: [46, 46, 46] }, footStyles: { fillColor: [232, 228, 218], textColor: 20, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(cols.map(([, , t], i) => [i, { halign: t ? 'right' : 'left' }])), margin: { left: 14, right: 14 },
    didParseCell: h => { if (h.section !== 'body') h.cell.styles.halign = cols[h.column.index]?.[2] ? 'right' : 'left'; }
  });
  if (kind === 'premiacao') {
    let yy = doc.lastAutoTable.finalY + 22; if (yy > 260) { doc.addPage(); yy = 40; }
    doc.setDrawColor(120); [[14, 'Gestor de frota'], [W / 2 + 6, 'Recursos Humanos']].forEach(([x, l]) => { doc.line(x, yy, x + W / 2 - 20, yy); doc.text(l, x, yy + 5); });
  }
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120); doc.text(`GestaoVia · gerado em ${fmtDT(nowTs())} por ${CUR.name} · página ${i}/${n}`, 14, doc.internal.pageSize.getHeight() - 6); }
  await offerFile(`GestaoVia_${kind}_${REP_M}.pdf`, doc.output('blob'));
}
const busy = async (a, fn) => { a.disabled = true; try { await fn(); } catch (e) { toast(e.message || String(e)); } finally { a.disabled = false; } };
ACTIONS['rep-pdf'] = a => busy(a, () => exportPdf(a.dataset.k));
ACTIONS['rep-xls'] = a => busy(a, () => exportXlsx([a.dataset.k]));
ACTIONS['rep-xls-all'] = a => busy(a, () => exportXlsx(['vehicles', 'drivers', 'projects', 'premiacao']));
