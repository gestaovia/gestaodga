/* ===================== Consulta por data (v1.6) =====================
   Em Veículos e Condutores: escolha um dia (ou um período) e veja quem estava com qual veículo,
   em qual obra, de que horas a que horas, e quem ficou sem uso. A fonte é o histórico de posses. */
let DQ = { from: '', to: '' };
let DQ_SEARCH = '';
const dqActive = () => !!DQ.from;
function dqRange() {
  const a = parseDate(DQ.from), b = parseDate(DQ.to || DQ.from);
  return [Math.min(a, b), Math.max(a, b) + DAY - 1];
}
function dqLabel() {
  const [a, b] = dqRange();
  return startOfDay(a) === startOfDay(b) ? fmtDate(a) : `${fmtDate(a)} a ${fmtDate(b)}`;
}
// posses que tocaram o período, com o trecho, as obras e os registros feitos nele
function dqUses() {
  const [from, to] = dqRange();
  return S.custody.filter(c => c.start <= to && (!c.end || c.end >= from)).map(c => {
    const a = Math.max(c.start, from), b = Math.min(c.end || nowTs(), to);
    const segs = c.segments || [];
    const projs = [...new Set(segs.filter((s, i) => s.at <= b && (!segs[i + 1] || segs[i + 1].at >= a)).map(s => s.projectId))].map(prj).filter(Boolean);
    const inRange = x => x.custodyId === c.id && x.at >= from && x.at <= to;
    return { c, v: veh(c.vehicleId), d: drv(c.driverId), a, b, open: !c.end && b >= nowTs() - MIN, projs, cks: S.checklists.filter(inRange).length, fuel: S.fuel.filter(inRange).length };
  }).filter(u => u.v && u.d).sort((x, y) => x.a - y.a);
}
const dqWhen = u => `${fmtShort(u.a)} – ${u.open ? 'agora' : fmtShort(u.b)}`;
const dqExtra = u => [u.projs.length ? u.projs.map(p => esc(p.code)).join(', ') : 'Sem obra', dqWhen(u), u.cks ? `${u.cks} checklist${u.cks > 1 ? 's' : ''}` : '', u.fuel ? `${u.fuel} abastec.` : ''].filter(Boolean).join(' · ');
const dqMatch = (u, q) => !q || `${u.v.plate} ${u.v.model} ${u.v.brand} ${u.d.name}`.toLowerCase().includes(q.toLowerCase());

function dqBar(page) {
  const today = dateInput(nowTs()), yest = dateInput(nowTs() - DAY);
  const is = (f, t) => DQ.from === f && (DQ.to || DQ.from) === t;
  return `<div class="dq-bar" role="search" aria-label="Consultar por data">
    <span class="dq-t">${ic('cal')}Consultar por data</span>
    <div class="dq-in"><input class="inp" type="date" id="dq-from" value="${esc(DQ.from)}" max="${today}" aria-label="Data inicial"><span class="muted small">até</span><input class="inp" type="date" id="dq-to" value="${esc(DQ.to)}" max="${today}" aria-label="Data final (opcional)"></div>
    <div class="dq-q"><button class="chip ${is(today, today) ? 'on' : ''}" data-act="dq-set" data-f="${today}">Hoje</button><button class="chip ${is(yest, yest) ? 'on' : ''}" data-act="dq-set" data-f="${yest}">Ontem</button><button class="chip ${DQ.from === dateInput(nowTs() - 6 * DAY) && DQ.to === today ? 'on' : ''}" data-act="dq-set" data-f="${dateInput(nowTs() - 6 * DAY)}" data-t="${today}">7 dias</button>${dqActive() ? `<button class="chip" data-act="dq-clear">${ic('back')}Limpar</button>` : ''}</div>
  </div>`;
}
function dqMountBar() {
  const upd = () => { const f = $('#dq-from')?.value || '', t = $('#dq-to')?.value || ''; DQ = { from: f || t, to: f ? t : '' }; render(); };
  $('#dq-from')?.addEventListener('change', upd);
  $('#dq-to')?.addEventListener('change', upd);
}
ACTIONS['dq-set'] = a => { DQ = { from: a.dataset.f, to: a.dataset.t || '' }; render(); };
ACTIONS['dq-clear'] = () => { DQ = { from: '', to: '' }; DQ_SEARCH = ''; render(); };

function dqVehiclesHTML() {
  const uses = dqUses().filter(u => dqMatch(u, DQ_SEARCH));
  const act = S.vehicles.filter(v => v.active);
  const used = new Set(uses.map(u => u.v.id));
  const idle = act.filter(v => !used.has(v.id) && (!DQ_SEARCH || `${v.plate} ${v.model} ${v.brand}`.toLowerCase().includes(DQ_SEARCH.toLowerCase())));
  const byV = act.filter(v => used.has(v.id)).map(v => ({ v, us: uses.filter(u => u.v.id === v.id) }));
  return `<div class="kpis">${kpi('Veículos usados', used.size, 'car', 'vs-drv')}${kpi('Sem uso', idle.length, 'car', 'vs-free')}${kpi('Condutores', new Set(uses.map(u => u.d.id)).size, 'user')}${kpi('Checklists', sum(uses, u => u.cks), 'check')}</div>
    <div class="panel"><div class="panel-h"><h2>Quem usou cada veículo · ${dqLabel()}</h2></div>
      <div class="vlist">${byV.map(({ v, us }) => us.map((u, i) => `<div class="vrow" data-go="veiculo" data-id="${v.id}">${i ? '<span class="dq-same"></span>' : plate(v.plate)}<div class="who2"><b>${esc(u.d.name)}</b><small>${dqExtra(u)}</small></div><span class="dot ${u.open ? 'vs-drv' : 'gray'}" title="${u.open ? 'Ainda com o condutor' : 'Posse encerrada'}"></span></div>`).join('')).join('') || '<div class="panel-b muted">Nenhum veículo com condutor neste período.</div>'}</div></div>
    ${idle.length ? `<div class="panel"><div class="panel-h"><h2>Sem uso no período</h2><span class="pill vs-free">${idle.length}</span></div><div class="panel-b dq-idle">${idle.map(v => `<button class="link" data-go="veiculo" data-id="${v.id}" style="text-decoration:none">${plate(v.plate)}</button>`).join('')}</div></div>` : ''}`;
}
function dqDriversHTML() {
  const uses = dqUses().filter(u => dqMatch(u, DQ_SEARCH));
  const ids = new Set(uses.map(u => u.d.id));
  const byD = [...ids].map(id => ({ d: drv(id), us: uses.filter(u => u.d.id === id) })).sort((x, y) => x.d.name.localeCompare(y.d.name));
  const idle = S.drivers.filter(d => !d._ro && driverActive(d) && !ids.has(d.id) && (!DQ_SEARCH || d.name.toLowerCase().includes(DQ_SEARCH.toLowerCase())));
  return `<div class="kpis">${kpi('Condutores com veículo', ids.size, 'user', 'vs-drv')}${kpi('Sem veículo', idle.length, 'user')}${kpi('Veículos', new Set(uses.map(u => u.v.id)).size, 'car')}${kpi('Checklists', sum(uses, u => u.cks), 'check')}</div>
    <div class="panel"><div class="panel-h"><h2>Com qual veículo cada condutor estava · ${dqLabel()}</h2></div>
      <div class="vlist">${byD.map(({ d, us }) => us.map((u, i) => `<div class="vrow" data-go="condutor" data-id="${d.id}">${i ? '<span class="dq-same av"></span>' : av(d)}<div class="who2"><b>${i ? '' : esc(d.name) + ' · '}${esc(u.v.plate)}</b><small>${dqExtra(u)}</small></div><span class="dot ${u.open ? 'vs-drv' : 'gray'}" title="${u.open ? 'Ainda com o veículo' : 'Posse encerrada'}"></span></div>`).join('')).join('') || '<div class="panel-b muted">Nenhum condutor com veículo neste período.</div>'}</div></div>
    ${idle.length ? `<div class="panel"><div class="panel-h"><h2>Sem veículo no período</h2><span class="pill">${idle.length}</span></div><div class="panel-b dq-idle">${idle.map(d => `<button class="chip" data-go="condutor" data-id="${d.id}">${esc(d.name)}</button>`).join('')}</div></div>` : ''}`;
}

// liga a consulta às telas de Veículos e Condutores
['veiculos', 'condutores'].forEach(k => {
  const pg = PAGES[k]; const r0 = pg.render, m0 = pg.mount;
  pg.render = p => {
    if (!dqActive()) { const h = r0(p); const i = h.indexOf('<div class="cards"'); return i < 0 ? h + dqBar(k) : h.slice(0, i) + dqBar(k) + h.slice(i); }
    return `<div class="page-head"><div class="filters"><span class="pill vs-drv">${ic('cal')}${dqLabel()}</span></div><div class="row"><input class="inp" id="dq-search" placeholder="${k === 'veiculos' ? 'Buscar placa, modelo ou condutor' : 'Buscar condutor ou placa'}" value="${esc(DQ_SEARCH)}" style="width:240px;min-height:36px" aria-label="Buscar"></div></div>
      ${dqBar(k)}<div class="stack" id="dq-res">${k === 'veiculos' ? dqVehiclesHTML() : dqDriversHTML()}</div>`;
  };
  pg.mount = p => {
    dqMountBar();
    if (!dqActive()) return m0?.(p);
    $('#dq-search')?.addEventListener('input', e => { DQ_SEARCH = e.target.value; $('#dq-res').innerHTML = k === 'veiculos' ? dqVehiclesHTML() : dqDriversHTML(); });
  };
});
