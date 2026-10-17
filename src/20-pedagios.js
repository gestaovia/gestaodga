/* ===================== Pedágios: fechamento mensal =====================
   - Sem Parar (veículos com TAG): a gestão importa o extrato/fatura do mês (Excel .xlsx/.xls ou CSV). O sistema lê
     as colunas (placa, data, hora, praça e valor), reconhece a placa do veículo e associa cada passagem à obra
     em que ele estava (posse no horário; sem posse no horário, posse do mesmo dia). Passagens repetidas não entram.
   - Manual (veículos sem TAG): o gestor de frota lança a passagem; a obra vem da posse do dia ou é escolhida.
   - Cada mês mostra o fechamento por obra (Sem Parar + manual) e exporta para Excel. */
const TOLL_SRC = { semparar: 'Sem Parar', manual: 'Manual' };
const tollSrc = t => t.source || (/manual/i.test(t.invoice || '') ? 'manual' : 'semparar');
const tollPlate = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const tollMatchPill = m => m.how === 'auto' ? pill('Posse no horário', 'ok') : m.how === 'dia' ? pill('Posse do dia', 'ok') : m.how === 'manual' ? pill('Ajuste manual', '') : m.noVeh ? pill('Placa não cadastrada', 'bad') : pill('Sem posse no dia', 'warn');
function tollTable(list, opts = {}) {
  const M = isManager();
  return tbl(['Data e hora', 'Placa', 'Local', '>Valor', 'Origem', 'Condutor', 'Obra', 'Correspondência', ...(M ? [''] : [])], list.sort((a, b) => b.at - a.at).slice(0, opts.limit || 300).map(t => {
    const m = tollMatch(t);
    return `<tr><td class="nowrap">${t.noTime ? `${fmtDate(t.at)} <span class="tiny muted">sem hora</span>` : fmtShort(t.at)}</td><td>${plate(t.plate)}</td><td class="small">${esc(t.place || '—')}${t.note ? `<div class="tiny muted">${esc(t.note)}</div>` : ''}</td><td class="r">${money(t.value)}</td>
      <td>${pill(TOLL_SRC[tollSrc(t)])}</td><td>${m.driverId && drv(m.driverId) ? drvLink(m.driverId) : '<span class="muted">—</span>'}</td><td>${m.projectId && prj(m.projectId) ? esc(prj(m.projectId).code) : '<span class="muted">—</span>'}</td>
      <td>${tollMatchPill(m)}</td>
      ${M ? `<td class="nowrap"><button class="btn sm" data-act="toll-adj" data-id="${t.id}">${m.how === 'manual' ? 'Editar' : 'Ajustar'}</button>${tollSrc(t) === 'manual' || !t.importId ? ` <button class="btn sm danger" data-act="toll-del" data-id="${t.id}" title="Excluir lançamento">${ic('trash')}</button>` : ''}</td>` : ''}</tr>`;
  }), opts.empty || 'Nenhuma passagem.');
}

/* ----- página ----- */
let TOLL_M = null;
function tollMonth(key) {
  const [from, to] = monthRange(key); const list = S.tolls.filter(t => t.at >= from && t.at < to);
  const rows = list.map(t => ({ t, m: tollMatch(t), src: tollSrc(t) }));
  const by = new Map();
  rows.forEach(r => { const k = r.m.projectId || '_'; const o = by.get(k) || { k, n: 0, sp: 0, man: 0 }; o.n++; o[r.src === 'manual' ? 'man' : 'sp'] += +r.t.value || 0; by.set(k, o); });
  const obras = [...by.values()].map(o => ({ ...o, total: o.sp + o.man })).sort((a, b) => (a.k === '_') - (b.k === '_') || b.total - a.total);
  return { key, from, to, list, rows, obras, total: sum(list, t => +t.value || 0), sp: sum(rows.filter(r => r.src !== 'manual'), r => +r.t.value || 0), man: sum(rows.filter(r => r.src === 'manual'), r => +r.t.value || 0), un: rows.filter(r => r.m.how === 'sem' || !r.m.projectId) };
}
/* ----- fechamento mensal (v1.12.0) -----
   Fechar o mês guarda a foto do fechamento por obra e das passagens (como foram enviadas ao financeiro).
   Depois de fechado: o banco recusa incluir, alterar ou excluir passagens daquele mês e correções de obra
   nas posses não mudam mais o fechamento (a tela avisa se o cálculo atual ficou diferente).
   Só o administrador reabre, com motivo. */
const tollClosing = key => (S.tollClosings || []).find(c => c.month === key) || null;
const tollLockedAt = t => t != null && !!tollClosing(monthKey(t));
const tollLockMsg = t => `O mês de ${monthName(monthKey(t))} está fechado. Para alterar, o administrador reabre o mês em Pedágios.`;
function tollMonthView(key) {
  const T = tollMonth(key); const C = tollClosing(key); if (!C) return T;
  const live = new Map(T.obras.map(o => [o.k, o.total])); const snap = C.rows?.obras || [];
  const diff = Math.round((Math.abs(T.total - C.total) + snap.reduce((a, o) => a + Math.abs((live.get(o.k) || 0) - o.total), 0)) * 100) / 100;
  return { ...T, closed: C, live: { total: T.total, obras: T.obras }, obras: snap, total: C.total, sp: sum(snap, o => o.sp), man: sum(snap, o => o.man), diff };
}
function tollSnapshot(T) {
  return {
    obras: T.obras.map(o => ({ k: o.k, code: o.k === '_' ? '' : prj(o.k)?.code || '', name: o.k === '_' ? '' : prj(o.k)?.name || '', n: o.n, sp: Math.round(o.sp * 100) / 100, man: Math.round(o.man * 100) / 100, total: Math.round(o.total * 100) / 100 })),
    passagens: T.rows.slice().sort((a, b) => a.t.at - b.t.at).map(({ t, m, src }) => ({ id: t.id, at: t.at, noTime: !!t.noTime, plate: t.plate, place: t.place || '', value: +t.value || 0, src, invoice: t.invoice || '', driver: m.driverId ? drv(m.driverId)?.name || '' : '', obra: m.projectId ? prj(m.projectId)?.code || '' : '', how: m.how }))
  };
}
ACTIONS['toll-close'] = () => {
  if (!isManager()) return; const key = TOLL_M || monthKey(nowTs()); const T = tollMonth(key);
  if (key >= monthKey(nowTs())) return toast('Feche o mês depois que ele terminar.');
  openModal({ title: `Fechar pedágios de ${monthName(key)}`, body: `<p>Total <b>${money(T.total)}</b> em ${T.list.length} passagem(ns), ${T.obras.filter(o => o.k !== '_').length} obra(s).</p>
      ${T.un.length ? `<div class="note warn">${ic('alert')}<div>${T.un.length} passagem(ns) sem obra identificada (${money(sum(T.un, r => +r.t.value || 0))}). Se fechar assim, elas ficam em "Sem obra" no fechamento.</div></div>` : ''}
      <p class="small muted">Depois de fechado, o fechamento por obra e as passagens ficam congelados como estão agora: não é possível importar, lançar, ajustar ou excluir passagens deste mês, e correções de obra nas posses não mudam mais estes valores. Só o administrador reabre.</p>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-close-ok">Fechar o mês</button>` });
};
ACTIONS['toll-close-ok'] = () => {
  const key = TOLL_M || monthKey(nowTs()); if (tollClosing(key)) return closeModal();
  const T = tollMonth(key); (S.tollClosings = S.tollClosings || []).push({ id: uid('tcl'), month: key, closedAt: nowTs(), closedBy: CUR.id, rows: tollSnapshot(T), total: Math.round(T.total * 100) / 100 });
  log('pedagio', `Pedágios de ${monthName(key)} fechados por ${CUR.name}: ${money(T.total)} em ${T.list.length} passagem(ns)`, {});
  save(); closeModal(); toast('Mês fechado.'); render();
};
ACTIONS['toll-reopen'] = () => {
  const key = TOLL_M; const C = tollClosing(key); if (!C || CUR.role !== 'admin') return;
  openModal({ title: `Reabrir pedágios de ${monthName(key)}`, body: `<p class="small muted">O fechamento de ${fmtDT(C.closedAt)} (${money(C.total)}) deixa de valer e o mês volta a ser calculado pelas passagens e posses atuais. Fica registrado na auditoria.</p><label class="field"><span>Motivo</span><input class="inp" id="tro-r" placeholder="Ex.: fatura complementar do Sem Parar"></label><p class="err" id="tro-err"></p>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn danger" data-act="toll-reopen-ok">Reabrir</button>` });
};
ACTIONS['toll-reopen-ok'] = () => {
  const key = TOLL_M; const C = tollClosing(key); const r = $('#tro-r').value.trim(); if (r.length < 5) return $('#tro-err').textContent = 'Informe o motivo.';
  S.tollClosings = S.tollClosings.filter(x => x !== C);
  log('pedagio', `Pedágios de ${monthName(key)} reabertos por ${CUR.name} (fechamento de ${fmtDT(C.closedAt)}, ${money(C.total)}): ${r}`, {});
  save(); closeModal(); toast('Mês reaberto.'); render();
};
PAGES.pedagios = {
  title: 'Pedágios',
  render({ f = '' }) {
    TOLL_M = TOLL_M || monthKey(nowTs()); const key = TOLL_M; const T = tollMonthView(key); const M = isManager(); const C = T.closed;
    const cur = key >= monthKey(nowTs());
    const pass = r => !f || (f === 'sem' ? (r.m.how === 'sem' || !r.m.projectId) : r.src === f);
    const list = T.rows.filter(pass).map(r => r.t);
    const imports = (S.settings.tollImports || []).filter(x => x.month === key);
    const noTag = S.vehicles.filter(v => v.active !== false && v.tollTag === false);
    const nav = `<div class="row" style="gap:8px"><button class="icon-btn" data-act="toll-m" data-d="-1" aria-label="Mês anterior">${ic('back')}</button><div style="text-align:center;min-width:130px"><b style="text-transform:capitalize">${monthName(key)}</b><div class="tiny muted">fechamento mensal</div></div><button class="icon-btn" data-act="toll-m" data-d="1" aria-label="Próximo mês" ${cur ? 'disabled' : ''}>${ic('chev')}</button></div>`;
    const chip = (k, l, n) => `<button class="chip ${f === k ? 'on' : ''}" data-go="pedagios" ${k ? `data-f="${k}"` : ''}>${l}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
    return `<div class="stack">
      <div class="page-head" style="margin:0">${nav}${M ? `<div class="row"><button class="btn" data-act="toll-xlsx">${ic('report')}Excel do mês</button><button class="btn" data-act="toll-manual">${ic('plus')}Lançar manual (sem TAG)</button><button class="btn pri" data-act="toll-import">${ic('toll')}Importar fatura Sem Parar</button></div>` : ''}</div>
      <div class="kpis">${kpi('Total do mês', money(T.total), 'report', 'c-blue', '', `${T.list.length} passagem(ns)`)}${kpi('Sem Parar', money(T.sp), 'toll', '', '', imports.length ? `${imports.length} importação(ões)` : 'fatura não importada')}${kpi('Manual (sem TAG)', money(T.man), 'edit', '', '', `${noTag.length} veículo(s) sem TAG`)}${kpi('Sem obra', T.un.length, 'alert', T.un.length ? 'c-yellow' : '', 'data-go="pedagios" data-f="sem"', 'para ajustar')}</div>
      ${C ? `<div class="note ok">${ic('check')}<div style="flex:1"><b>Mês fechado</b> em ${fmtDT(C.closedAt)} por ${esc(userName(C.closedBy))}: valores congelados como foram fechados.${T.diff >= 0.01 ? `<br><span style="color:var(--orange)">O cálculo atual ficou diferente do fechamento (total atual ${money(T.live.total)}), por correção de obra ou de posse feita depois. O fechamento não muda; se precisar refletir, o administrador reabre o mês.</span>` : ''}</div>${CUR.role === 'admin' ? `<button class="btn sm" data-act="toll-reopen">Reabrir</button>` : ''}</div>`
        : M && !cur ? `<div class="note">${ic('cal')}<div style="flex:1">Mês encerrado e ainda aberto no sistema. Confira as passagens sem obra e feche para congelar o fechamento enviado ao financeiro.</div><button class="btn sm ok" data-act="toll-close">Fechar o mês</button></div>` : ''}
      ${!imports.length && M && !C ? `<div class="note">${ic('toll')}<div>A fatura do Sem Parar de ${monthName(key)} ainda não foi importada. Baixe o extrato em Excel (ou CSV) no portal do Sem Parar e use <b>Importar fatura Sem Parar</b>.</div></div>` : ''}
      <div class="panel"><div class="panel-h"><h2>Fechamento por obra</h2><span class="small muted">obra da posse no horário da passagem (ou do dia)</span></div>
        ${tbl(['Obra', '>Passagens', '>Sem Parar', '>Manual', '>Total'], T.obras.map(o => `<tr><td>${o.k === '_' ? pill('Sem obra identificada', 'warn') : `<b>${esc(o.code || prj(o.k)?.code || '—')}</b> <span class="small muted">${esc(o.name || prj(o.k)?.name || '')}</span>`}</td><td class="r num">${o.n}</td><td class="r">${money(o.sp)}</td><td class="r">${money(o.man)}</td><td class="r"><b>${money(o.total)}</b></td></tr>`).concat(T.obras.length ? [`<tr><td><b>Total</b></td><td class="r num"><b>${T.list.length}</b></td><td class="r"><b>${money(T.sp)}</b></td><td class="r"><b>${money(T.man)}</b></td><td class="r"><b>${money(T.total)}</b></td></tr>`] : []), 'Nenhuma passagem neste mês.')}</div>
      ${imports.length ? `<div class="panel"><div class="panel-h"><h3>Faturas importadas</h3></div>${tbl(['Importada em', 'Fatura', 'Arquivo', '>Passagens', '>Valor', 'Por', ...(M ? [''] : [])], imports.map(x => { const n = S.tolls.filter(t => t.importId === x.id); return `<tr><td class="nowrap small">${fmtDT(x.at)}</td><td>${esc(x.ref || '—')}</td><td class="small">${esc(x.file || 'colado')}</td><td class="r num">${n.length}</td><td class="r">${money(sum(n, t => +t.value || 0))}</td><td class="small">${esc(userName(x.by))}</td>${M ? `<td class="r">${n.length ? `<button class="btn sm danger" data-act="toll-undo" data-id="${x.id}">Desfazer</button>` : '<span class="tiny muted">desfeita</span>'}</td>` : ''}</tr>`; }))}</div>` : ''}
      <div class="panel"><div class="panel-h"><div class="filters">${chip('', 'Todas', T.rows.length)}${chip('semparar', 'Sem Parar', T.rows.filter(r => r.src !== 'manual').length)}${chip('manual', 'Manual', T.rows.filter(r => r.src === 'manual').length)}${chip('sem', 'Sem obra', T.un.length)}</div></div>${tollTable(list, { empty: 'Nenhuma passagem neste filtro.' })}</div>
    </div>`;
  }
};
ACTIONS['toll-m'] = a => { TOLL_M = shiftMonth(TOLL_M || monthKey(nowTs()), +a.dataset.d); if (TOLL_M > monthKey(nowTs())) TOLL_M = monthKey(nowTs()); render(); };

/* ----- leitura do arquivo (Excel/CSV) ----- */
function csvRows(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const dl = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === dl) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}
async function tollReadFile(file) {
  const name = file.name.toLowerCase();
  if (/\.(csv|txt)$/.test(name)) {
    const buf = await file.arrayBuffer(); let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    return csvRows(text);
  }
  await needXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  // planilha com mais linhas que parecem passagens (placa + valor)
  let best = null;
  wb.SheetNames.forEach(n => { const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); const sc = rows.filter(r => r.some(c => /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i.test(String(c).trim()))).length; if (!best || sc > best.sc) best = { rows, sc }; });
  return (best?.rows || []).map(r => r.map(c => typeof c === 'string' ? c.trim() : c)).filter(r => r.some(c => c !== '' && c != null));
}
const TOLL_FIELDS = [['plate', 'Placa', true], ['date', 'Data (ou data e hora)', true], ['time', 'Hora', false], ['place', 'Praça / local', false], ['value', 'Valor', true], ['type', 'Tipo / descrição', false], ['tag', 'TAG', false]];
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function tollGuess(head) {
  const h = head.map(norm); const used = new Set();
  const find = (...res) => { for (const re of res) { const i = h.findIndex((x, j) => !used.has(j) && re.test(x)); if (i >= 0) { used.add(i); return i; } } return -1; };
  const map = {};
  map.plate = find(/^placa/, /placa/);
  map.value = find(/^valor( (da )?(passagem|tarifa|cobrado|r\$|\(r\$\)))?$/, /^valor/, /valor/, /tarifa/);
  map.date = find(/data.*hora|data\/hora/, /^data( (da )?(passagem|utilizacao|transacao|uso))?$/, /^data/, /data/);
  map.time = find(/^hora/, /hora/, /horario/);
  map.place = find(/praca/, /estabelecimento/, /^local/, /rodovia/, /concessionaria/, /descri/);
  map.type = find(/^tipo/, /servico/, /produto/, /descri/, /categoria de uso/);
  map.tag = find(/^tag/, /tag/, /dispositivo/);
  return map;
}
function tollHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) { const h = rows[i].map(norm); if (h.some(x => /placa/.test(x)) && h.some(x => /valor|tarifa/.test(x))) return i; }
  return -1;
}
const xlSerial = n => { const u = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 864e5)); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds()).getTime(); };
function tollParseDate(dv, tv) {
  // aceita data do Excel (número), "dd/mm/aaaa", "dd/mm/aa", "aaaa-mm-dd", com ou sem hora; hora em coluna própria (texto ou fração do dia)
  let at = null, hasTime = false;
  if (typeof dv === 'number' && dv > 20000) { at = xlSerial(dv); hasTime = dv % 1 > 1e-6; }
  else if (dv instanceof Date) { at = dv.getTime(); hasTime = dv.getHours() + dv.getMinutes() > 0; }
  else {
    const s = String(dv || '').trim(); let m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; at = new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime(); hasTime = !!m[4]; }
    else if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/))) { at = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime(); hasTime = !!m[4]; }
  }
  if (at == null || isNaN(at)) return null;
  if (tv !== '' && tv != null) {
    let h = null, mi = 0, se = 0;
    if (typeof tv === 'number') { const x = Math.round((tv % 1) * 86400); h = Math.floor(x / 3600); mi = Math.floor(x % 3600 / 60); se = x % 60; }
    else { const m = String(tv).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/); if (m) { h = +m[1]; mi = +m[2]; se = +(m[3] || 0); } }
    if (h != null) { const d = new Date(at); d.setHours(h, mi, se, 0); at = d.getTime(); hasTime = true; }
  }
  return { at, noTime: !hasTime };
}
const tollParseValue = v => { if (typeof v === 'number') return v; let s = String(v || '').replace(/R\$|\s/g, ''); const neg = /^-|^\(.*\)$|-$/.test(s); s = s.replace(/[()\-]/g, ''); if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); const n = parseFloat(s); return isNaN(n) ? null : (neg ? -n : n); };
const TOLL_SKIP = /estacion|mensalidade|adesao|taxa|tarifa de servico|anuidade|recarga|combustivel|lava|drive|credito|desconto|juros|multa/;
function tollBuild(rows, hi, map, onlyToll) {
  const out = [];
  rows.slice(hi + 1).forEach((r, i) => {
    const g = k => map[k] >= 0 ? r[map[k]] : '';
    const pl = tollPlate(g('plate')); const val = tollParseValue(g('value')); const dt = tollParseDate(g('date'), map.time >= 0 ? g('time') : '');
    const type = norm(g('type')); const place = String(g('place') ?? '').trim();
    const line = hi + 2 + i;
    if (!pl && !val) return; // linha de total/vazia
    if (/total/.test(norm(r.join(' '))) && !/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(pl)) return;
    const o = { line, plate: pl, value: val, at: dt?.at ?? null, noTime: dt?.noTime ?? true, place: place || (type ? String(g('type')).trim() : ''), tag: String(g('tag') ?? '').trim(), type: String(g('type') ?? '').trim(), status: 'ok', why: '' };
    if (onlyToll && (TOLL_SKIP.test(type) || (!type && TOLL_SKIP.test(norm(place))))) { o.status = 'skip'; o.why = 'não é passagem de pedágio'; }
    else if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(pl)) { o.status = 'err'; o.why = 'placa inválida'; }
    else if (o.at == null) { o.status = 'err'; o.why = 'data inválida'; }
    else if (val == null || val === 0) { o.status = 'err'; o.why = 'valor inválido'; }
    else if (tollLockedAt(o.at)) { o.status = 'skip'; o.why = 'mês já fechado'; }
    else if (S.tolls.some(t => t.plate === pl && Math.abs(t.at - o.at) < 60e3 && Math.abs((+t.value || 0) - val) < 0.005)) { o.status = 'dup'; o.why = 'já importada'; }
    else if (out.some(x => x.status === 'ok' && x.plate === pl && x.at === o.at && x.value === val && x.place === o.place)) { o.status = 'dup'; o.why = 'repetida no arquivo'; }
    if (o.status === 'ok') { o.m = tollMatch({ plate: pl, at: o.at, noTime: o.noTime }); if (o.m.noVeh) o.warn = 'placa não cadastrada'; }
    out.push(o);
  });
  return out;
}

/* ----- importação ----- */
let TIMP = null;
ACTIONS['toll-import'] = () => {
  if (!isManager()) return;
  TIMP = { rows: null, hi: -1, map: {}, file: '', list: [] };
  const prev = shiftMonth(monthKey(nowTs()), -1);
  openModal({ title: 'Importar fatura Sem Parar', wide: true, body: `<div class="stack" style="gap:12px">
      <p class="small muted">No portal do Sem Parar, baixe o extrato de passagens do mês em Excel ou CSV e escolha o arquivo aqui. O sistema reconhece a placa de cada passagem e associa à obra em que o veículo estava no horário (ou no dia).</p>
      <div class="form-grid three">
        <label class="field"><span>Mês da fatura</span><input class="inp" type="month" id="ti-ref" value="${prev}"></label>
        <label class="field"><span>Nº da fatura (opcional)</span><input class="inp" id="ti-no" placeholder="Ex.: 123456789"></label>
        <label class="field"><span>Arquivo (.xlsx, .xls ou .csv)</span><input class="inp" type="file" id="ti-file" accept=".xlsx,.xls,.csv,.txt"></label>
      </div>
      <details><summary class="small" style="cursor:pointer">Ou cole as linhas copiadas da planilha (com o cabeçalho)</summary><textarea class="inp mono" id="ti-paste" style="min-height:110px;margin-top:6px" placeholder="Placa;Data;Hora;Praça;Valor&#10;ABC1D23;09/10/2026;09:15;Praça Valinhos – SP-330 km 82;11,60"></textarea><button class="btn sm" data-act="toll-paste" style="margin-top:6px">Ler linhas coladas</button></details>
      <label class="row small" style="gap:8px"><span class="toggle"><input type="checkbox" id="ti-only" checked><i></i></span>Importar só passagens de pedágio (ignorar estacionamento, mensalidade e taxas)</label>
      <div id="ti-box"></div><p class="err" id="ti-err"></p></div>`,
    foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-import-ok" id="ti-ok" disabled>Importar</button>' });
  $('#ti-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return; $('#ti-err').textContent = ''; $('#ti-box').innerHTML = '<p class="small muted">Lendo o arquivo…</p>';
    try { tollLoaded(await tollReadFile(f), f.name); } catch (er) { $('#ti-box').innerHTML = ''; $('#ti-err').textContent = 'Não foi possível ler o arquivo: ' + (er.message || er); }
  });
  $('#ti-only').addEventListener('change', tollPreview);
};
ACTIONS['toll-paste'] = () => { const t = $('#ti-paste').value; if (!t.trim()) return; tollLoaded(csvRows(t), 'linhas coladas'); };
function tollLoaded(rows, file) {
  const hi = tollHeaderRow(rows);
  if (hi < 0) { $('#ti-box').innerHTML = ''; $('#ti-err').textContent = 'Não encontrei o cabeçalho com as colunas "Placa" e "Valor". Confira se o arquivo é o extrato de passagens.'; return; }
  TIMP.rows = rows; TIMP.hi = hi; TIMP.file = file; TIMP.map = tollGuess(rows[hi]);
  // ajusta o mês da fatura pela data mais comum das passagens
  tollPreview(true);
}
function tollPreview(setRef) {
  if (!TIMP?.rows) return;
  const head = TIMP.rows[TIMP.hi]; const only = $('#ti-only')?.checked !== false;
  TIMP.list = tollBuild(TIMP.rows, TIMP.hi, TIMP.map, only);
  const ok = TIMP.list.filter(o => o.status === 'ok');
  if (setRef === true && ok.length) { const cnt = {}; ok.forEach(o => { const k = monthKey(o.at); cnt[k] = (cnt[k] || 0) + 1; }); const k = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; $('#ti-ref').value = k; }
  const n = s => TIMP.list.filter(o => o.status === s).length;
  const sel = (k, l, req) => `<label class="field"><span>${l}${req ? '' : ' <span class="muted">(opcional)</span>'}</span><select class="inp" data-tmap="${k}"><option value="-1">—</option>${head.map((h, i) => `<option value="${i}" ${TIMP.map[k] === i ? 'selected' : ''}>${esc(String(h || `Coluna ${i + 1}`))}</option>`).join('')}</select></label>`;
  const byObra = new Map(); ok.forEach(o => { const k = o.m?.projectId || '_'; byObra.set(k, (byObra.get(k) || 0) + o.value); });
  const st = o => o.status === 'ok' ? (o.warn ? pill(o.warn, 'warn') : pill('ok', 'ok')) : o.status === 'dup' ? pill(o.why, '') : o.status === 'skip' ? pill('ignorada', '') : pill(o.why, 'bad');
  $('#ti-box').innerHTML = `<div class="panel" style="box-shadow:none"><div class="panel-h"><h3>Colunas do arquivo</h3><span class="small muted">${esc(TIMP.file)} · cabeçalho na linha ${TIMP.hi + 1}</span></div><div class="panel-b form-grid three">${TOLL_FIELDS.map(([k, l, r]) => sel(k, l, r)).join('')}</div></div>
    <div class="kpis">${kpi('Para importar', ok.length, 'check', 'c-green', '', money(sum(ok, o => o.value)))}${kpi('Já importadas', n('dup'), 'toll')}${kpi('Ignoradas', n('skip'), 'alert', '', '', 'estacionamento, taxas')}${kpi('Com erro', n('err'), 'alert', n('err') ? 'c-red' : '')}</div>
    ${ok.length ? `<div class="small">Por obra: ${[...byObra.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<b>${k === '_' ? 'sem obra' : esc(prj(k)?.code || '—')}</b> ${money(v)}`).join(' · ')}</div>` : ''}
    <div style="max-height:300px;overflow:auto">${tbl(['Linha', 'Placa', 'Data e hora', 'Local', '>Valor', 'Obra', 'Situação'], TIMP.list.slice(0, 400).map(o => `<tr><td class="num small">${o.line}</td><td>${o.plate ? plate(o.plate) : '—'}</td><td class="nowrap small">${o.at ? (o.noTime ? fmtDate(o.at) + ' <span class="tiny muted">sem hora</span>' : fmtShort(o.at)) : '—'}</td><td class="small">${esc(o.place || '')}</td><td class="r">${o.value != null ? money(o.value) : '—'}</td><td>${o.m?.projectId ? esc(prj(o.m.projectId)?.code || '—') : '<span class="muted">—</span>'}</td><td>${st(o)}</td></tr>`), 'Nenhuma linha.')}</div>`;
  $('#ti-box').querySelectorAll('[data-tmap]').forEach(s => s.addEventListener('change', e => { TIMP.map[e.target.dataset.tmap] = +e.target.value; tollPreview(); }));
  $('#ti-ok').disabled = !ok.length; $('#ti-ok').textContent = ok.length ? `Importar ${ok.length} passagem(ns)` : 'Importar';
  $('#ti-err').textContent = TOLL_FIELDS.filter(([k, , r]) => r && !(TIMP.map[k] >= 0)).map(([, l]) => `Escolha a coluna "${l}".`).join(' ');
}
ACTIONS['toll-import-ok'] = () => {
  const ok = (TIMP?.list || []).filter(o => o.status === 'ok'); if (!ok.length) return;
  const ref = $('#ti-ref').value || monthKey(nowTs()); const no = $('#ti-no').value.trim();
  const imp = { id: uid('tim'), month: ref, ref: `Sem Parar ${monthName(ref)}${no ? ' · nº ' + no : ''}`, file: TIMP.file, at: nowTs(), by: CUR.id, n: ok.length, total: Math.round(sum(ok, o => o.value) * 100) / 100 };
  ok.forEach(o => S.tolls.push({ id: uid('tol'), plate: o.plate, at: o.at, place: o.place || 'Sem Parar', value: Math.round(o.value * 100) / 100, invoice: imp.ref, manual: null, source: 'semparar', noTime: o.noTime, tag: o.tag || null, importId: imp.id, refMonth: ref }));
  (S.settings.tollImports = S.settings.tollImports || []).push(imp);
  const un = ok.filter(o => !o.m?.projectId).length;
  log('pedagio', `Fatura ${imp.ref} importada por ${CUR.name}: ${ok.length} passagem(ns), ${money(imp.total)}${un ? `, ${un} sem obra identificada` : ''}`, {});
  TOLL_M = ref; save(); closeModal(); toast(`${ok.length} passagem(ns) importada(s)${un ? ` · ${un} sem obra para ajustar` : ''}.`); go('pedagios', un ? { f: 'sem' } : {});
};
ACTIONS['toll-undo'] = a => {
  const x = (S.settings.tollImports || []).find(i => i.id === a.dataset.id); if (!x) return;
  const n = S.tolls.filter(t => t.importId === x.id).length;
  openModal({ title: 'Desfazer importação', body: `<p>${esc(x.ref)} · ${n} passagem(ns).</p><p class="small muted">As passagens desta importação serão excluídas (por exemplo, para importar o arquivo certo). Ajustes manuais feitos nelas também saem.</p><p class="err" id="tu-err"></p>`,
    foot: `<button class="btn" data-act="modal-close">Voltar</button><button class="btn danger" data-act="toll-undo-ok" data-id="${x.id}">Excluir ${n} passagem(ns)</button>` });
};
ACTIONS['toll-undo-ok'] = a => {
  const x = (S.settings.tollImports || []).find(i => i.id === a.dataset.id); const n = S.tolls.filter(t => t.importId === x.id).length;
  const lk = S.tolls.find(t => t.importId === x.id && tollLockedAt(t.at)); if (lk) { closeModal(); return toast(tollLockMsg(lk.at)); }
  S.tolls = S.tolls.filter(t => t.importId !== x.id); x.undoneAt = nowTs(); x.undoneBy = CUR.id;
  log('pedagio', `Importação ${x.ref} desfeita por ${CUR.name}: ${n} passagem(ns) excluída(s)`, {});
  save(); closeModal(); toast('Importação desfeita.'); render();
};

/* ----- lançamento manual (veículos sem TAG) ----- */
ACTIONS['toll-manual'] = () => {
  if (!isManager()) return;
  const vs = S.vehicles.filter(v => v.active !== false).sort((a, b) => ((a.tollTag !== false) - (b.tollTag !== false)) || a.plate.localeCompare(b.plate));
  openModal({ title: 'Lançar pedágio manual', body: `<p class="small muted">Para veículos sem TAG. A obra vem da posse do veículo no dia; se precisar, escolha outra.</p><form id="tm-form" class="form-grid">
      <label class="field"><span>Veículo</span><select class="inp" name="vid" id="tm-v">${vs.map(v => `<option value="${v.id}">${v.plate} · ${esc(v.model || '')}${v.tollTag === false ? ' · sem TAG' : ' · com TAG'}</option>`).join('')}</select></label>
      <label class="field"><span>Valor (R$)</span><input class="inp num" name="value" inputmode="decimal" placeholder="0,00"></label>
      <label class="field"><span>Data</span><input class="inp" type="date" name="date" id="tm-d" value="${dateInput(nowTs())}" max="${dateInput(nowTs())}"></label>
      <label class="field"><span>Hora <span class="muted">(se souber)</span></span><input class="inp" type="time" name="time" id="tm-t"></label>
      <label class="field full"><span>Praça / local</span><input class="inp" name="place" placeholder="Ex.: Praça Valinhos – SP-330 km 82"></label>
      <label class="field"><span>Quantidade de passagens</span><input class="inp num" name="qty" type="number" min="1" max="60" value="1"><small>Mesma praça e valor no dia (ida e volta = 2)</small></label>
      <label class="field"><span>Comprovante / observação</span><input class="inp" name="note" placeholder="Ex.: recibo nº 4521"></label>
      <label class="field full"><span>Obra</span><select class="inp" name="projectId" id="tm-p"><option value="">Automática (posse do veículo no dia)</option>${obraOpts('')}</select><small id="tm-info"></small></label>
      <p class="err full" id="tm-err"></p></form>`,
    foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-manual-ok">Lançar</button>' });
  const upd = () => {
    const v = veh($('#tm-v').value); const d = $('#tm-d').value; const t = $('#tm-t').value; if (!v || !d) return;
    const at = new Date(d + 'T' + (t || '12:00')).getTime(); const m = tollMatch({ plate: v.plate, at, noTime: !t });
    $('#tm-info').innerHTML = v.tollTag !== false ? '<span style="color:var(--yellow)">Este veículo tem TAG: a passagem já deve vir na fatura do Sem Parar.</span> ' : '';
    $('#tm-info').innerHTML += m.projectId ? `Posse do dia: <b>${esc(prj(m.projectId)?.code || '—')}</b>${m.driverId ? ` · ${esc(drv(m.driverId)?.name || '')}` : ''}` : 'Sem posse do veículo neste dia: escolha a obra.';
  };
  ['#tm-v', '#tm-d', '#tm-t'].forEach(s => $(s).addEventListener('change', upd)); upd();
};
ACTIONS['toll-manual-ok'] = () => {
  const d = formData($('#tm-form')); const err = t => $('#tm-err').textContent = t;
  const v = veh(d.vid); const val = tollParseValue(d.value); const qty = Math.max(1, Math.min(60, parseInt(d.qty, 10) || 1));
  if (!v) return err('Escolha o veículo.');
  if (!val || val <= 0) return err('Informe o valor.');
  if (!d.date) return err('Informe a data.');
  if ((d.place || '').length < 3) return err('Informe a praça ou o local.');
  const at = new Date(d.date + 'T' + (d.time || '12:00')).getTime(); if (at > nowTs() + 10 * MIN) return err('A data não pode ser no futuro.');
  if (tollLockedAt(at)) return err(tollLockMsg(at));
  const auto = tollMatch({ plate: v.plate, at, noTime: !d.time });
  if (!d.projectId && !auto.projectId) return err('Não há posse do veículo neste dia: escolha a obra.');
  const manual = d.projectId && d.projectId !== auto.projectId ? { driverId: auto.driverId || null, projectId: d.projectId, ccId: null, reason: 'Obra escolhida no lançamento manual', by: CUR.id, at: nowTs(), vehicleId: v.id } : null;
  for (let i = 0; i < qty; i++) S.tolls.push({ id: uid('tol'), plate: v.plate, at: at + i * MIN, place: d.place, value: Math.round(val * 100) / 100, invoice: 'Lançamento manual', manual, source: 'manual', noTime: !d.time, note: d.note || '', enteredBy: CUR.id, refMonth: monthKey(at) });
  const pj = prj(d.projectId || auto.projectId);
  log('pedagio', `Pedágio manual lançado por ${CUR.name}: ${v.plate}, ${qty}× ${money(val)} em ${fmtDate(at)} (${d.place}) · obra ${pj?.code || '—'}`, { vehicleId: v.id, driverId: auto.driverId || null });
  TOLL_M = monthKey(at); save(); closeModal(); toast(`${qty} passagem(ns) lançada(s).`); go('pedagios', { f: 'manual' });
};
ACTIONS['toll-del'] = a => {
  const t = byId(S.tolls, a.dataset.id); if (t && tollLockedAt(t.at)) return toast(tollLockMsg(t.at)); if (!t) return;
  openModal({ title: 'Excluir lançamento de pedágio', body: `<p>${plate(t.plate)} · ${fmtShort(t.at)} · ${esc(t.place)} · <b>${money(t.value)}</b></p>`, foot: `<button class="btn" data-act="modal-close">Voltar</button><button class="btn danger" data-act="toll-del-ok" data-id="${t.id}">Excluir</button>` });
};
ACTIONS['toll-del-ok'] = a => {
  const t = byId(S.tolls, a.dataset.id); S.tolls = S.tolls.filter(x => x !== t);
  log('pedagio', `Pedágio excluído por ${CUR.name}: ${t.plate}, ${fmtShort(t.at)}, ${money(t.value)} (${t.place})`, { vehicleId: vehicleByPlate(t.plate)?.id || null });
  save(); closeModal(); toast('Lançamento excluído.'); render();
};

/* ----- ajuste manual (obra/condutor) de qualquer passagem ----- */
ACTIONS['toll-adj'] = a => {
  const t = byId(S.tolls, a.dataset.id); if (t && tollLockedAt(t.at)) return toast(tollLockMsg(t.at)); const v = vehicleByPlate(t.plate); const m = tollMatch({ ...t, manual: null });
  const near = v ? S.custody.filter(c => c.vehicleId === v.id).sort((x, y) => Math.abs(x.start - t.at) - Math.abs(y.start - t.at)).slice(0, 2) : [];
  openModal({
    title: 'Ajustar pedágio', body: `<p>${plate(t.plate)} · ${t.noTime ? fmtDate(t.at) : fmtDT(t.at)} · ${esc(t.place)} · <b>${money(t.value)}</b></p>
      <div class="note ${m.projectId ? '' : 'warn'}">${m.projectId ? `Pela posse: <b>${esc(prj(m.projectId)?.code || '—')}</b>${m.driverId ? ` · ${esc(drv(m.driverId)?.name || '')}` : ''}.` : !v ? 'Placa não cadastrada no sistema.' : 'Não há posse registrada neste dia.'} ${near.length ? `Posses mais próximas: ${near.map(c => `${esc(drv(c.driverId)?.name || '—')} (${fmtShort(c.start)} a ${c.end ? fmtShort(c.end) : 'agora'})`).join('; ')}.` : ''}</div>
      <form id="adjform" class="form-grid"><label class="field"><span>Condutor</span><select class="inp" name="driverId"><option value="">—</option>${driverOptions(t.manual?.driverId || m.driverId || near[0]?.driverId)}</select></label>
      <label class="field"><span>Obra</span><select class="inp" name="projectId">${obraOpts(t.manual?.projectId || m.projectId || currentSegment(near[0])?.projectId)}</select></label>
      <label class="field full"><span>Motivo do ajuste</span><input class="inp" name="reason" value="${esc(t.manual?.reason || '')}" placeholder="Ex.: veículo usado sem registro de posse"></label><p class="err full" id="adj-err"></p></form>`,
    foot: `${t.manual ? `<button class="btn" data-act="toll-adj-clear" data-id="${t.id}" style="margin-right:auto">Voltar ao automático</button>` : ''}<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-adj-ok" data-id="${t.id}">Salvar ajuste</button>`
  });
};
ACTIONS['toll-adj-ok'] = a => {
  const t = byId(S.tolls, a.dataset.id); const d = formData($('#adjform'));
  if (!d.projectId) return $('#adj-err').textContent = 'Escolha a obra.';
  if ((d.reason || '').length < 5) return $('#adj-err').textContent = 'Informe o motivo do ajuste.';
  t.manual = { driverId: d.driverId || null, projectId: d.projectId, ccId: null, reason: d.reason, by: CUR.id, at: nowTs(), vehicleId: vehicleByPlate(t.plate)?.id || null };
  log('pedagio', `Pedágio de ${fmtShort(t.at)} (${money(t.value)}) atribuído manualmente a ${d.driverId ? drv(d.driverId).name + ' / ' : ''}${prj(d.projectId).code}: ${d.reason}`, { vehicleId: t.manual.vehicleId, driverId: d.driverId || null });
  save(); closeModal(); toast('Ajuste registrado na auditoria.'); render();
};
ACTIONS['toll-adj-clear'] = a => {
  const t = byId(S.tolls, a.dataset.id); if (tollLockedAt(t.at)) { closeModal(); return toast(tollLockMsg(t.at)); } t.manual = null;
  log('pedagio', `Ajuste manual do pedágio de ${fmtShort(t.at)} (${money(t.value)}) removido por ${CUR.name}`, { vehicleId: vehicleByPlate(t.plate)?.id || null });
  save(); closeModal(); toast('Pedágio volta a seguir a posse.'); render();
};

/* ----- Excel do mês ----- */
ACTIONS['toll-xlsx'] = async () => {
  try {
    await needXlsx(); const T = tollMonthView(TOLL_M || monthKey(nowTs()));
    const ob = [['Obra', 'Descrição', 'Passagens', 'Sem Parar (R$)', 'Manual (R$)', 'Total (R$)'], ...T.obras.map(o => [o.k === '_' ? 'Sem obra' : o.code || prj(o.k)?.code || '—', o.k === '_' ? '' : o.name || prj(o.k)?.name || '', o.n, o.sp, o.man, o.total]), ['Total', '', sum(T.obras, o => o.n), T.sp, T.man, T.total]];
    const HOW = { auto: 'Posse no horário', dia: 'Posse do dia', manual: 'Ajuste manual', sem: 'Sem correspondência' };
    if (T.closed) ob.push([], [`Fechado em ${fmtDT(T.closed.closedAt)} por ${userName(T.closed.closedBy)}`]);
    const ps = T.closed ? [['Data', 'Hora', 'Placa', 'Local', 'Valor (R$)', 'Origem', 'Fatura', 'Condutor', 'Obra', 'Correspondência'], ...(T.closed.rows?.passagens || []).map(r => [fmtDate(r.at), r.noTime ? '' : fmtTime(r.at), r.plate, r.place, r.value, TOLL_SRC[r.src], r.invoice, r.driver, r.obra, HOW[r.how]])]
      : [['Data', 'Hora', 'Placa', 'Local', 'Valor (R$)', 'Origem', 'Fatura', 'Condutor', 'Obra', 'Correspondência'], ...T.rows.sort((a, b) => a.t.at - b.t.at).map(({ t, m, src }) => [fmtDate(t.at), t.noTime ? '' : fmtTime(t.at), t.plate, t.place || '', +t.value || 0, TOLL_SRC[src], t.invoice || '', m.driverId ? drv(m.driverId)?.name || '' : '', m.projectId ? prj(m.projectId)?.code || '' : '', { auto: 'Posse no horário', dia: 'Posse do dia', manual: 'Ajuste manual', sem: 'Sem correspondência' }[m.how]])];
    const wb = XLSX.utils.book_new(); const s1 = XLSX.utils.aoa_to_sheet(ob); const s2 = XLSX.utils.aoa_to_sheet(ps);
    s1['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]; s2['!cols'] = [{ wch: 11 }, { wch: 7 }, { wch: 9 }, { wch: 38 }, { wch: 11 }, { wch: 10 }, { wch: 26 }, { wch: 24 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, s1, 'Por obra'); XLSX.utils.book_append_sheet(wb, s2, 'Passagens');
    await offerFile(`GestaoVia_pedagios_${T.key}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } catch (e) { toast('Não foi possível gerar o Excel: ' + (e.message || e)); }
};
