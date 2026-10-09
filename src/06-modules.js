/* ===================== Módulos: abastecimento, manutenção, pedágios, multas, bonificação, relatórios, configurações ===================== */

/* ---------- Abastecimento (gestão) ---------- */
function fuelTable(list, emptyTxt = 'Nenhum abastecimento.') {
  return tbl(['Data', 'Veículo', 'Condutor', 'Obra', '>Km', '>Litros', '>Valor', '>km/l', '>Custo/km', '>Variação', 'Cupom'], list.sort((a, b) => b.at - a.at).slice(0, 150).map(f => {
    const m = fuelMetrics(f); const out = m.delta != null && Math.abs(m.delta) > S.settings.fuelDeviationPct;
    return `<tr><td class="nowrap">${fmtShort(f.at)}</td><td>${vehLink(f.vehicleId)}</td><td>${drvLink(f.driverId)}</td><td>${projLabel(f.projectId)}</td><td class="r">${nf(f.km)}</td><td class="r">${nf(f.liters, 2)}</td><td class="r">${money(f.total)}</td>
      <td class="r">${m.kmL ? nf(m.kmL, 1) : '—'}</td><td class="r">${m.costKm ? money(m.costKm) : '—'}</td><td class="r nowrap">${m.delta != null ? (out ? pill(`${m.delta > 0 ? '+' : ''}${nf(m.delta, 0)}%`, m.delta < 0 ? 'urg' : 'warn') : `<span class="muted">${m.delta > 0 ? '+' : ''}${nf(m.delta, 0)}%</span>`) : '—'}</td>
      <td>${f.receipt ? `<img src="${photoSrc(f.receipt)}" alt="Cupom" data-act="photo" style="width:34px;height:26px;object-fit:cover;border:1px solid var(--line);border-radius:2px;cursor:pointer">` : '<span class="muted">—</span>'}</td></tr>`;
  }), emptyTxt);
}
let FUEL_M = 0; const FUEL_F = { v: '', d: '', p: '' };
PAGES.abastecimento = {
  title: 'Abastecimento',
  render() {
    const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0); base.setMonth(base.getMonth() + FUEL_M);
    const from = base.getTime(); const nx = new Date(base); nx.setMonth(nx.getMonth() + 1); const to = Math.min(nx.getTime(), nowTs() + 1);
    const F = FUEL_F;
    const pass = f => (!F.v || f.vehicleId === F.v) && (!F.d || f.driverId === F.d) && (!F.p || f.projectId === F.p);
    const fs = S.fuel.filter(f => f.at >= from && f.at < to && pass(f));
    // consumo pelos próprios registros: km desde o abastecimento anterior ÷ litros (vale para qualquer filtro)
    const cons = list => { const ok = list.map(f => ({ f, d: fuelMetrics(f).dist })).filter(x => x.d > 0); const l = sum(ok, x => x.f.liters); return l ? sum(ok, x => x.d) / l : null; };
    const L = sum(fs, f => f.liters); const V = sum(fs, f => f.total); const avgAll = cons(fs);
    const outs = fs.filter(f => fuelOutlier(f));
    const perV = S.vehicles.map(v => { const x = fs.filter(f => f.vehicleId === v.id); const lv = sum(x, f => f.liters); return { v, L: lv, V: sum(x, f => f.total), n: x.length, avg: cons(x) }; }).filter(x => x.L);
    const mxL = Math.max(...perV.map(x => x.V), 1);
    const first = Math.min(...S.fuel.map(f => f.at)); const canBack = from > first; const label = cap(base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
    const nFil = [F.v, F.d, F.p].filter(Boolean).length;
    const sel = (id, all, opts) => `<select class="inp" id="${id}" style="width:auto;min-height:36px;max-width:230px">${`<option value="">${all}</option>`}${opts}</select>`;
    return `<div class="stack">
      <div class="page-head" style="margin:0"><div class="row"><button class="icon-btn" data-act="fuel-m" data-d="-1" aria-label="Mês anterior" ${canBack ? '' : 'disabled'}>${ic('back')}</button><h2 style="min-width:170px;text-align:center">${label}</h2><button class="icon-btn" data-act="fuel-m" data-d="1" aria-label="Próximo mês" style="transform:scaleX(-1)" ${FUEL_M >= 0 ? 'disabled' : ''}>${ic('back')}</button>${FUEL_M ? '<button class="btn sm" data-act="fuel-m" data-d="0">Mês atual</button>' : '<span class="pill blue">mês atual · parcial</span>'}</div>
        <div class="filters">${sel('ff-v', 'Todos os veículos', S.vehicles.map(v => `<option value="${v.id}" ${F.v === v.id ? 'selected' : ''}>${v.plate} · ${esc(v.model)}</option>`).join(''))}${sel('ff-d', 'Todos os condutores', S.drivers.map(d => `<option value="${d.id}" ${F.d === d.id ? 'selected' : ''}>${esc(d.name)}${d.active === false ? ' (inativo)' : ''}</option>`).join(''))}${sel('ff-p', 'Todas as obras', S.projects.map(p => `<option value="${p.id}" ${F.p === p.id ? 'selected' : ''}>${esc(p.code)}</option>`).join(''))}${nFil ? '<button class="btn sm" data-act="fuel-clear">Limpar filtros</button>' : ''}</div></div>
      <div class="kpis">${kpi('Abastecimentos', fs.length, 'fuel', 'c-blue')}${kpi('Litros', nf(L), 'fuel')}${kpi('Custo', money(V), 'report')}${kpi('Consumo médio', avgAll ? nf(avgAll, 1) : '—', 'gauge', '', '', 'km/l')}${kpi('Fora do padrão', outs.length, 'alert', outs.length ? 'c-yellow' : '', '', `acima de ${S.settings.fuelDeviationPct}%`)}</div>
      ${outs.length ? `<div class="panel sev warn"><div class="panel-h"><h3>Consumo fora do padrão</h3><span class="pill warn">acima de ${S.settings.fuelDeviationPct}%</span></div>${fuelTable(outs)}</div>` : ''}
      <div class="panel"><div class="panel-h"><h3>Por veículo · ${label}</h3></div>${tbl(['Veículo', '>Abast.', '>Litros', 'Custo', '>Média km/l', '>Referência'], perV.sort((a, b) => b.V - a.V).map(x => `<tr><td>${vehLink(x.v.id)} <span class="muted small">${esc(x.v.model)}</span></td><td class="r">${x.n}</td><td class="r">${nf(x.L, 1)}</td><td style="min-width:180px"><div class="row" style="flex-wrap:nowrap">${barCell(x.V, mxL)}<span class="num nowrap small">${money(x.V)}</span></div></td><td class="r">${x.avg ? nf(x.avg, 1) : '—'}</td><td class="r muted">${nf(x.v.avgKmL, 1)}</td></tr>`), 'Nenhum abastecimento com estes filtros.')}</div>
      <div class="panel"><div class="panel-h"><h3>Registros · ${label}</h3><span class="muted small">${fs.length}${nFil ? ' · filtrado' : ''}</span></div>${fuelTable(fs.slice(), 'Nenhum abastecimento com estes filtros.')}</div></div>`;
  },
  mount() { [['ff-v', 'v'], ['ff-d', 'd'], ['ff-p', 'p']].forEach(([id, k]) => $('#' + id)?.addEventListener('change', e => { FUEL_F[k] = e.target.value; render(); })); }
};
ACTIONS['fuel-m'] = a => { const d = +a.dataset.d; FUEL_M = d === 0 ? 0 : Math.min(0, FUEL_M + d); render(); };
ACTIONS['fuel-clear'] = () => { FUEL_F.v = FUEL_F.d = FUEL_F.p = ''; render(); };

/* ---------- Manutenção ---------- */
function maintTable(vehicles, lvlFilter) {
  const rows = [];
  vehicles.forEach(v => vehicleMaint(v.id).items.filter(x => !lvlFilter || x.s.lvl === lvlFilter).forEach(({ p, s }) => {
    rows.push({ r: M_LEVEL[s.lvl].r, rem: s.remKm ?? 1e9, html: `<tr class="sev ${M_LEVEL[s.lvl].c === 'gray' ? '' : M_LEVEL[s.lvl].c}"><td>${vehLink(v.id)}</td><td>${esc(p.item)}</td>
      <td class="small">${[p.everyKm ? `a cada ${nf(p.everyKm)} km` : '', p.everyDays ? `a cada ${p.everyDays >= 365 && p.everyDays % 365 === 0 ? p.everyDays / 365 + (p.everyDays / 365 > 1 ? ' anos' : ' ano') : p.everyDays + ' dias'}` : ''].filter(Boolean).join(' ou ')}</td>
      <td class="r">${nf(v.odometer)}</td><td class="r small">${p.lastKm != null ? nf(p.lastKm) + ' km' : ''}${p.lastDate ? `<div class="muted">${fmtDate(p.lastDate)}</div>` : ''}</td>
      <td class="r small">${s.nextKm != null ? nf(s.nextKm) + ' km' : ''}${s.nextDate ? `<div class="muted">${fmtDate(s.nextDate)}</div>` : ''}</td>
      <td class="r nowrap">${s.remKm != null ? `<b>${nf(s.remKm)} km</b>` : ''}${s.remDays != null ? `<div class="small muted">${s.remDays} dias</div>` : ''}</td><td>${mLvl(s.lvl)}</td>
      ${isManager() ? `<td><button class="btn sm" data-act="mp-edit" data-id="${p.id}">Editar</button></td>` : ''}</tr>` });
  }));
  rows.sort((a, b) => b.r - a.r || a.rem - b.rem);
  return tbl(['Veículo', 'Item', 'Controle', '>Km atual', '>Última troca', '>Próxima', '>Restante', 'Situação', ...(isManager() ? [''] : [])], rows.map(r => r.html), 'Nenhum item neste filtro.');
}
PAGES.manutencao = {
  title: 'Manutenção',
  render({ id, l = '' }) {
    const vs = id ? [veh(id)] : S.vehicles;
    const all = S.vehicles.flatMap(v => vehicleMaint(v.id).items);
    const cnt = k => all.filter(x => x.s.lvl === k).length;
    const inShop = S.vehicles.filter(v => v.maintenance);
    return `<div class="page-head"><div class="filters">${id ? `<button class="chip on" data-go="manutencao">${veh(id).plate} ×</button>` : ''}<button class="chip ${!l ? 'on' : ''}" data-go="manutencao" ${id ? `data-id="${id}"` : ''}>Todos</button>${['vencido', 'urgente', 'atencao', 'normal'].map(k => `<button class="chip ${l === k ? 'on' : ''}" data-go="manutencao" data-l="${k}" ${id ? `data-id="${id}"` : ''}><span class="dot ${M_LEVEL[k].c}"></span>${M_LEVEL[k].l}<span class="n">${cnt(k)}</span></button>`).join('')}</div>
      <div class="row"><button class="btn" data-go="calendario">${ic('cal')}Calendário</button>${isManager() ? `<button class="btn pri" data-act="mp-new">${ic('plus')}Item no plano</button>` : ''}</div></div>
      <div class="stack">
      ${inShop.length ? `<div class="panel"><div class="panel-h"><h3>Em manutenção agora</h3></div>${tbl(['Veículo', 'Desde', 'Oficina e motivo', ''], inShop.map(v => `<tr><td>${vehLink(v.id)}</td><td>${fmtDT(v.maintenanceSince)}</td><td>${esc(v.maintenanceNote || '—')}</td><td class="r">${isManager() ? `<button class="btn sm pri" data-go="checklist_full" data-vid="${v.id}" data-type="manut_saida">Registrar saída</button>` : ''}</td></tr>`))}</div>` : ''}
      <div class="panel">${maintTable(vs, l)}</div>
      <div class="panel"><div class="panel-h"><h3>Serviços realizados</h3></div>${tbl(['Data', 'Veículo', 'Serviços', 'Oficina', '>Km', '>Custo'], S.maintRecords.filter(r => !id || r.vehicleId === id).sort((a, b) => b.at - a.at).map(r => `<tr><td>${fmtDate(r.at)}</td><td>${vehLink(r.vehicleId)}</td><td>${r.items.join(', ')}</td><td>${esc(r.shop || '')}</td><td class="r">${nf(r.km)}</td><td class="r">${money(r.cost)}</td></tr>`))}</div>
      </div>`;
  }
};
function mpForm(p = {}) {
  return `<form id="mpform" class="form-grid">
    ${p.id ? `<div class="full"><b>${veh(p.vehicleId).plate}</b> · ${esc(p.item)}</div>` : `<label class="field"><span>Veículo</span><select class="inp" name="vehicleId">${S.vehicles.map(v => `<option value="${v.id}">${v.plate} – ${esc(v.model)}</option>`).join('')}</select></label>
    <label class="field"><span>Item</span><select class="inp" name="item">${MAINT_ITEMS.map(i => `<option>${i}</option>`).join('')}</select></label>`}
    <label class="field"><span>Intervalo em km</span><input class="inp num" name="everyKm" inputmode="numeric" value="${p.everyKm ?? ''}" placeholder="Ex.: 10000"></label>
    <label class="field"><span>Intervalo em dias</span><input class="inp num" name="everyDays" inputmode="numeric" value="${p.everyDays ?? ''}" placeholder="Ex.: 180"></label>
    <label class="field"><span>Km da última troca</span><input class="inp num" name="lastKm" inputmode="numeric" value="${p.lastKm ?? ''}"></label>
    <label class="field"><span>Data da última troca</span><input class="inp" type="date" name="lastDate" value="${p.lastDate ? dateInput(p.lastDate) : ''}"></label>
    <p class="small muted full">Preencha km, dias ou ambos. O item vence no que ocorrer primeiro.</p><p class="err full" id="mp-err"></p></form>`;
}
ACTIONS['mp-new'] = () => openModal({ title: 'Adicionar item ao plano', body: mpForm(), foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="mp-save">Salvar</button>' });
ACTIONS['mp-edit'] = a => openModal({ title: 'Editar item do plano', body: mpForm(byId(S.plans, a.dataset.id)), foot: `<button class="btn danger" data-act="mp-del" data-id="${a.dataset.id}">Remover</button><button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="mp-save" data-id="${a.dataset.id}">Salvar</button>` });
ACTIONS['mp-save'] = a => {
  const d = formData($('#mpform')); const n = s => s ? parseInt(String(s).replace(/\D/g, ''), 10) : null;
  const vals = { everyKm: n(d.everyKm), everyDays: n(d.everyDays), lastKm: n(d.lastKm), lastDate: d.lastDate ? new Date(d.lastDate + 'T12:00').getTime() : null };
  if (!vals.everyKm && !vals.everyDays) return $('#mp-err').textContent = 'Informe o intervalo em km, em dias ou ambos.';
  if (vals.everyKm && vals.lastKm == null) return $('#mp-err').textContent = 'Informe o km da última troca.';
  if (vals.everyDays && !vals.lastDate) return $('#mp-err').textContent = 'Informe a data da última troca.';
  if (a.dataset.id) Object.assign(byId(S.plans, a.dataset.id), vals);
  else S.plans.push({ id: uid('mp'), vehicleId: d.vehicleId, item: d.item, ...vals });
  save(); closeModal(); toast('Plano de manutenção atualizado.'); render();
};
ACTIONS['mp-del'] = a => { S.plans = S.plans.filter(p => p.id !== a.dataset.id); save(); closeModal(); render(); };

/* ---------- Pedágios ---------- */
function tollTable(list) {
  return tbl(['Data e hora', 'Placa', 'Local', '>Valor', 'Condutor no horário', 'Obra', 'Centro de custo', 'Correspondência', ...(isManager() ? [''] : [])], list.sort((a, b) => b.at - a.at).slice(0, 200).map(t => {
    const m = tollMatch(t);
    return `<tr><td class="nowrap">${fmtShort(t.at)}</td><td>${plate(t.plate)}</td><td class="small">${esc(t.place)}</td><td class="r">${money(t.value)}</td>
      <td>${m.driverId ? drvLink(m.driverId) : '<span class="muted">—</span>'}</td><td>${m.projectId ? esc(prj(m.projectId).code) : '<span class="muted">—</span>'}</td><td class="small">${m.ccId ? ccOf(m.ccId).code : '—'}</td>
      <td>${m.how === 'auto' ? pill('Automática', 'ok') : m.how === 'manual' ? pill('Ajuste manual', '') : pill('Sem correspondência', 'warn')}</td>
      ${isManager() ? `<td>${m.how !== 'auto' ? `<button class="btn sm" data-act="toll-adj" data-id="${t.id}">Ajustar</button>` : ''}</td>` : ''}</tr>`;
  }), 'Nenhuma passagem.');
}
PAGES.pedagios = {
  title: 'Pedágios',
  render({ f = '' }) {
    const from = startOfMonth(nowTs()); const ms = S.tolls.filter(t => t.at >= from);
    const un = S.tolls.filter(t => tollMatch(t).how === 'sem');
    const list = f === 'sem' ? un : S.tolls.slice();
    return `<div class="page-head"><div class="filters"><button class="chip ${!f ? 'on' : ''}" data-go="pedagios">Todas</button><button class="chip ${f === 'sem' ? 'on' : ''}" data-go="pedagios" data-f="sem">Sem condutor<span class="n">${un.length}</span></button></div>${isManager() ? '<div class="row"><button class="btn" data-act="toll-import">Importar fatura</button><button class="btn pri" data-act="toll-new">Registrar passagem</button></div>' : ''}</div>
      <div class="stack"><div class="kpis">${kpi('Passagens no mês', ms.length, 'toll', 'c-blue')}${kpi('Valor no mês', money(sum(ms, t => t.value)), 'report')}${kpi('Identificadas', S.tolls.length ? nf(S.tolls.filter(t => tollMatch(t).how === 'auto').length / S.tolls.length * 100, 0) + '%' : '—', 'check', 'c-green', '', 'pela posse')}${kpi('Sem condutor', un.length, 'alert', un.length ? 'c-yellow' : '', 'data-go="pedagios" data-f="sem"')}</div>
      <div class="panel">${tollTable(list)}</div></div>`;
  }
};
function importTolls(text) {
  let ok = 0; const errs = [];
  text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((line, i) => {
    const c = line.split(/[;\t]/).map(x => x.trim());
    if (/placa/i.test(c[0])) return;
    const [pl, dt, hr, place, val] = c; const m = dt?.match(/(\d{2})\/(\d{2})\/(\d{4})/); const h = hr?.match(/(\d{1,2}):(\d{2})/);
    const v = parseFloat(String(val || '').replace('R$', '').replace(/\./g, '').replace(',', '.'));
    if (!pl || !m || !h || !place || !v) { errs.push(`Linha ${i + 1}: formato inválido`); return; }
    const at = new Date(+m[3], +m[2] - 1, +m[1], +h[1], +h[2]).getTime();
    S.tolls.push({ id: uid('tol'), plate: pl.toUpperCase().replace(/[^A-Z0-9]/g, ''), at, place, value: v, invoice: 'Importação ' + fmtDate(nowTs()), manual: null }); ok++;
  });
  return { ok, errs };
}
ACTIONS['toll-import'] = () => {
  openModal({
    title: 'Importar fatura de pedágio', wide: true,
    body: `<p class="small muted">Cole as linhas da fatura (CSV ou planilha) no formato: <span class="mono">placa;data;hora;local;valor</span>. O sistema identifica o condutor e a obra de cada passagem.</p><textarea class="inp mono" id="toll-csv" style="min-height:160px" placeholder="ABC1D23;09/10/2026;09:15;Praça Valinhos – SP-330 km 82;11,60"></textarea><p class="err" id="toll-err"></p>`,
    foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-import-ok">Importar</button>'
  });
};
ACTIONS['toll-import-ok'] = () => {
  const r = importTolls($('#toll-csv').value);
  if (!r.ok) return $('#toll-err').textContent = r.errs.join('. ') || 'Nada para importar.';
  log('pedagio', `${r.ok} passagem(ns) de pedágio importada(s) por ${CUR.name}`, {}); save(); closeModal(); toast(`${r.ok} passagem(ns) importada(s)${r.errs.length ? `, ${r.errs.length} com erro` : ''}.`); render();
};
ACTIONS['toll-new'] = () => openModal({
  title: 'Registrar passagem', body: `<form id="tform" class="form-grid"><label class="field"><span>Placa</span><select class="inp" name="plate">${S.vehicles.map(v => `<option>${v.plate}</option>`).join('')}</select></label><label class="field"><span>Valor (R$)</span><input class="inp num" name="value" inputmode="decimal"></label><label class="field"><span>Data</span><input class="inp" type="date" name="date" value="${dateInput(nowTs())}"></label><label class="field"><span>Hora</span><input class="inp" type="time" name="time" value="08:00"></label><label class="field full"><span>Local</span><input class="inp" name="place" placeholder="Praça / rodovia / km"></label><p class="err full" id="tf-err"></p></form>`,
  foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-save">Registrar</button>'
});
ACTIONS['toll-save'] = () => {
  const d = formData($('#tform')); const v = parseFloat(d.value.replace(/\./g, '').replace(',', '.'));
  if (!v || !d.place || !d.date || !d.time) return $('#tf-err').textContent = 'Preencha todos os campos.';
  S.tolls.push({ id: uid('tol'), plate: d.plate, at: new Date(d.date + 'T' + d.time).getTime(), place: d.place, value: v, invoice: 'Registro manual', manual: null });
  save(); closeModal(); toast('Passagem registrada e cruzada com a posse.'); render();
};
ACTIONS['toll-adj'] = a => {
  const t = byId(S.tolls, a.dataset.id); const v = vehicleByPlate(t.plate);
  const near = v ? S.custody.filter(c => c.vehicleId === v.id).sort((x, y) => Math.abs(x.start - t.at) - Math.abs(y.start - t.at)).slice(0, 2) : [];
  openModal({
    title: 'Ajuste manual de pedágio', body: `<p>${plate(t.plate)} · ${fmtDT(t.at)} · ${esc(t.place)} · <b>${money(t.value)}</b></p>
      <div class="note warn">Não há posse registrada neste horário. ${near.length ? `Posses mais próximas: ${near.map(c => `${esc(drv(c.driverId).name)} (${fmtShort(c.start)} a ${c.end ? fmtShort(c.end) : 'agora'})`).join('; ')}.` : ''}</div>
      <form id="adjform" class="form-grid"><label class="field"><span>Condutor</span><select class="inp" name="driverId">${driverOptions(t.manual?.driverId || near[0]?.driverId)}</select></label>
      <label class="field"><span>Obra</span><select class="inp" name="projectId">${projectOptions(t.manual?.projectId || currentSegment(near[0])?.projectId)}</select></label>
      <label class="field full"><span>Motivo do ajuste</span><input class="inp" name="reason" value="${esc(t.manual?.reason || '')}" placeholder="Ex.: veículo usado sem registro de posse"></label><p class="err full" id="adj-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="toll-adj-ok" data-id="${t.id}">Salvar ajuste</button>`
  });
};
ACTIONS['toll-adj-ok'] = a => {
  const t = byId(S.tolls, a.dataset.id); const d = formData($('#adjform'));
  if (d.reason.length < 5) return $('#adj-err').textContent = 'Informe o motivo do ajuste.';
  t.manual = { driverId: d.driverId, projectId: d.projectId, ccId: prj(d.projectId).ccId, reason: d.reason, by: CUR.id, at: nowTs(), vehicleId: vehicleByPlate(t.plate)?.id };
  log('pedagio', `Pedágio de ${fmtShort(t.at)} (${money(t.value)}) atribuído manualmente a ${drv(d.driverId).name} / ${prj(d.projectId).code}: ${d.reason}`, { vehicleId: t.manual.vehicleId, driverId: d.driverId });
  save(); closeModal(); toast('Ajuste registrado na auditoria.'); render();
};

/* ---------- Multas ---------- */
function fineTable(list) {
  return tbl(['Data e hora', 'Placa', 'Infração', '>Valor', 'Notificação', 'Condutor no momento', 'Obra', 'Identificação'], list.sort((a, b) => b.at - a.at).map(f => {
    const m = fineMatch(f);
    return `<tr class="click" data-act="fine-view" data-id="${f.id}"><td class="nowrap">${fmtShort(f.at)}</td><td>${plate(f.plate)}</td><td class="small">${esc(f.infraction)} ${pill(f.gravity === 'gravissima' ? 'Gravíssima' : f.gravity[0].toUpperCase() + f.gravity.slice(1), '')}</td>
      <td class="r">${money(f.value)}</td><td class="mono small">${esc(f.notice)}</td><td>${m.driverId ? esc(drv(m.driverId).name) : '<span class="muted">—</span>'}</td><td>${m.projectId ? esc(prj(m.projectId).code) : '—'}</td>
      <td>${m.how === 'auto' ? pill('Automática', 'ok') : m.how === 'manual' ? pill('Manual', '') : pill('Sem posse no horário', 'warn')}</td></tr>`;
  }), 'Nenhuma multa.');
}
PAGES.multas = {
  title: 'Multas',
  render() {
    const un = S.fines.filter(f => fineMatch(f).how === 'sem');
    return `<div class="page-head"><span></span>${isManager() ? `<button class="btn pri" data-act="fine-new">${ic('plus')}Registrar multa</button>` : ''}</div>
      <div class="stack"><div class="kpis">${kpi('Multas', S.fines.length, 'fine', 'c-red')}${kpi('Valor total', money(sum(S.fines, f => f.value)), 'report')}${kpi('Pontos na CNH', sum(S.fines, f => f.points), 'alert')}${kpi('Sem condutor', un.length, 'user', un.length ? 'c-yellow' : '')}</div>
      <div class="panel">${fineTable(S.fines.slice())}</div></div>`;
  }
};
ACTIONS['fine-view'] = a => {
  const f = byId(S.fines, a.dataset.id); const m = fineMatch(f); const c = m.custody || (m.custodyId && byId(S.custody, m.custodyId));
  const hist = m.vehicleId ? S.audit.filter(x => x.vehicleId === m.vehicleId && Math.abs(x.at - f.at) < 18 * 36e5).sort((x, y) => y.at - x.at) : [];
  openModal({
    title: `Multa ${f.notice}`, wide: true,
    body: `<dl class="dl"><dt>Placa</dt><dd>${plate(f.plate)}</dd><dt>Data e hora</dt><dd>${fmtDT(f.at)}</dd><dt>Local</dt><dd>${esc(f.place)}</dd><dt>Infração</dt><dd>${esc(f.infraction)}</dd><dt>Valor</dt><dd>${money(f.value)} · ${f.points} pontos</dd></dl>
      <div class="panel"><div class="panel-h"><h3>Responsável no momento da infração</h3>${m.how === 'auto' ? pill('Identificado pela posse', 'ok') : m.how === 'manual' ? pill('Indicado manualmente', '') : pill('Sem posse no horário', 'warn')}</div><div class="panel-b">
        ${m.driverId ? `<dl class="dl"><dt>Condutor</dt><dd><b>${esc(drv(m.driverId).name)}</b> · CNH ${drv(m.driverId).cnhCat}</dd><dt>Obra associada</dt><dd>${projFull(m.projectId)}</dd>${c ? `<dt>Período de posse</dt><dd>${fmtDT(c.start)} até ${c.end ? fmtDT(c.end) : 'agora'}</dd>` : ''}</dl>`
        : `<p>Não havia posse registrada para ${f.plate} neste horário. ${isManager() ? 'Indique o condutor manualmente:' : ''}</p>${isManager() ? `<div class="row" style="margin-top:8px"><select class="inp" id="fine-drv" style="max-width:260px">${driverOptions('')}</select><button class="btn" data-act="fine-assign" data-id="${f.id}">Indicar condutor</button></div>` : ''}`}</div></div>
      <div><p class="label" style="margin-bottom:6px">Anexos</p>${f.attachments.length ? f.attachments.map((x, i) => typeof x === 'string' ? `<div class="row small">${ic('fine')} ${esc(x)}</div>` : `<div class="row small">${ic('fine')} <button class="link" data-act="fine-file-open" data-id="${f.id}" data-i="${i}">${esc(x.name)}</button>${x.size ? ` <span class="muted">${nf(x.size / 1024)} KB</span>` : ''}</div>`).join('') : '<span class="muted small">Nenhum documento anexado.</span>'}
        ${isManager() ? `<label class="btn sm" style="position:relative;margin-top:8px">Anexar documento<input type="file" id="fine-file" data-id="${f.id}" style="position:absolute;inset:0;opacity:0"></label>` : ''}</div>
      <div><p class="label" style="margin-bottom:4px">Histórico do veículo próximo ao horário</p>${timelineHTML(hist)}</div>`,
    onMount: el => { el.querySelector('#fine-file')?.addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return; const doc = await readDocFile(file); if (doc.tooBig) return toast('Arquivo acima de 10 MB. Envie um arquivo menor.'); f.attachments.push(doc); log('multa', `Documento anexado à multa ${f.notice}: ${file.name}`, { vehicleId: m.vehicleId }); save(); ACTIONS['fine-view']({ dataset: { id: f.id } }); }); }
  });
};
ACTIONS['fine-assign'] = a => { const f = byId(S.fines, a.dataset.id); f.manualDriverId = $('#fine-drv').value; log('multa', `Multa ${f.notice} indicada manualmente para ${drv(f.manualDriverId).name}`, { vehicleId: vehicleByPlate(f.plate)?.id, driverId: f.manualDriverId }); save(); closeModal(); render(); };
ACTIONS['fine-new'] = () => openModal({
  title: 'Registrar multa', wide: true, body: `<form id="fnform" class="form-grid">
    <label class="field"><span>Placa</span><select class="inp" name="plate">${S.vehicles.map(v => `<option>${v.plate}</option>`).join('')}</select></label>
    <label class="field"><span>Número da notificação</span><input class="inp mono" name="notice"></label>
    <label class="field"><span>Data</span><input class="inp" type="date" name="date"></label><label class="field"><span>Hora</span><input class="inp" type="time" name="time"></label>
    <label class="field full"><span>Local</span><input class="inp" name="place"></label>
    <label class="field full"><span>Tipo de infração</span><input class="inp" name="infraction" placeholder="Ex.: Transitar em velocidade superior à máxima permitida em até 20%"></label>
    <label class="field"><span>Gravidade</span><select class="inp" name="gravity" id="fn-grav"><option value="leve">Leve</option><option value="media" selected>Média</option><option value="grave">Grave</option><option value="gravissima">Gravíssima</option></select></label>
    <label class="field"><span>Valor (R$)</span><input class="inp num" name="value" id="fn-val" value="130,16"></label>
    <label class="field full"><span>Documento da multa</span><input class="inp" type="file" name="file"></label><p class="err full" id="fn-err"></p></form>`,
  foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="fine-save">Registrar e identificar condutor</button>',
  onMount: el => el.querySelector('#fn-grav').addEventListener('change', e => { el.querySelector('#fn-val').value = nf(FINE_TYPES[e.target.value], 2); })
});
ACTIONS['fine-save'] = async () => {
  const form = $('#fnform'); const d = formData(form); const v = parseFloat(d.value.replace(/\./g, '').replace(',', '.'));
  if (!d.notice || !d.date || !d.time || !d.place || !d.infraction || !v) return $('#fn-err').textContent = 'Preencha todos os campos.';
  const file = form.querySelector('[name=file]').files[0]; const doc = file ? await readDocFile(file) : null;
  if (doc?.tooBig) return $('#fn-err').textContent = 'Arquivo acima de 10 MB. Envie um arquivo menor.';
  const f = { id: uid('fin'), plate: d.plate, at: new Date(d.date + 'T' + d.time).getTime(), place: d.place, infraction: d.infraction, gravity: d.gravity, value: v, notice: d.notice, points: { leve: 3, media: 4, grave: 5, gravissima: 7 }[d.gravity], attachments: doc ? [doc] : [], manualDriverId: null };
  S.fines.push(f); const m = fineMatch(f);
  log('multa', `Multa ${f.notice} registrada (${money(v)})${m.driverId ? ` · condutor identificado: ${drv(m.driverId).name}` : ' · sem posse no horário'}`, { vehicleId: m.vehicleId, driverId: m.driverId });
  save(); closeModal(); toast(m.driverId ? `Condutor identificado: ${drv(m.driverId).name}.` : 'Sem posse no horário: indique o condutor manualmente.'); render();
};


ACTIONS['fine-file-open'] = a => {
  const x = byId(S.fines, a.dataset.id)?.attachments[+a.dataset.i]; if (!x) return;
  const url = String(x.data || '').startsWith('sb:') ? CLOUD.fileUrl(x.data) : x.data;
  if (!url) return toast('O link do arquivo expirou. Recarregue a página.');
  if (x.type?.startsWith('image/')) return openModal({ title: x.name, body: `<img src="${url}" alt="" style="width:100%">`, wide: true });
  window.open(url, '_blank', 'noopener');
};

/* ---------- Relatórios ---------- */
let REP_CACHE = null;
PAGES.relatorios = {
  title: 'Relatórios',
  render({ per = 'mes' }) {
    const n = nowTs(); const ranges = { mes: [startOfMonth(n), n + 1, 'Este mês'], ant: [startOfMonth(startOfMonth(n) - DAY), startOfMonth(n), 'Mês anterior'], d60: [n - 60 * DAY, n + 1, 'Últimos 60 dias'] };
    const [from, to] = ranges[per]; const rows = periodCosts(from, to);
    const kinds = ['Combustível', 'Pedágios', 'Multas', 'Manutenção', 'Documentação'];
    const pivot = (key, label, kmFn) => {
      const ids = [...new Set(rows.map(r => r[key] || '_'))];
      const data = ids.map(id => { const rs = rows.filter(r => (r[key] || '_') === id); const o = { id, label: label(id) }; kinds.forEach(k => o[k] = sum(rs.filter(r => r.kind === k), r => r.value)); o.total = sum(rs, r => r.value); o.km = kmFn ? kmFn(id) : null; return o; }).sort((a, b) => b.total - a.total);
      return data;
    };
    const byV = pivot('vehicleId', id => veh(id)?.plate || 'Não identificado', id => kmInPeriod(from, to, c => c.vehicleId === id));
    const byP = pivot('projectId', id => prj(id)?.code || 'Sem obra');
    const byD = pivot('driverId', id => drv(id)?.name || 'Sem condutor (manutenção e não identificados)', id => kmInPeriod(from, to, c => c.driverId === id));
    REP_CACHE = { byV, byP, byD, kinds };
    const table = (data, first, withKm, key) => `<div class="panel"><div class="panel-h"><h3>Custo por ${first.toLowerCase()}</h3><button class="btn sm" data-act="rep-copy" data-k="${key}">Copiar tabela</button></div>${tbl([first, ...kinds.map(k => '>' + k), ...(withKm ? ['>Km', '>Custo/km'] : []), '>Total'], data.map(o => `<tr><td class="nowrap">${esc(o.label)}</td>${kinds.map(k => `<td class="r">${o[k] ? money(o[k]) : '<span class="muted">—</span>'}</td>`).join('')}${withKm ? `<td class="r">${nf(o.km)}</td><td class="r">${o.km > 0 ? money(o.total / o.km) : '—'}</td>` : ''}<td class="r"><b>${money(o.total)}</b></td></tr>`).concat([`<tr><td><b>Total</b></td>${kinds.map(k => `<td class="r"><b>${money(sum(data, o => o[k]))}</b></td>`).join('')}${withKm ? `<td class="r"><b>${nf(sum(data, o => o.km))}</b></td><td></td>` : ''}<td class="r"><b>${money(sum(data, o => o.total))}</b></td></tr>`]))}</div>`;
    return `<div class="page-head">      <div class="filters">${Object.entries(ranges).map(([k, r]) => `<button class="chip ${per === k ? 'on' : ''}" data-go="relatorios" data-per="${k}">${r[2]}</button>`).join('')}</div></div>
      <div class="stack">${table(byP, 'Obra', false, 'byP')}${table(byV, 'Veículo', true, 'byV')}${table(byD, 'Condutor', true, 'byD')}</div>`;
  }
};
ACTIONS['rep-copy'] = async a => {
  const data = REP_CACHE[a.dataset.k]; const k = REP_CACHE.kinds;
  const csv = ['Item;' + k.join(';') + ';Total', ...data.map(o => [o.label, ...k.map(x => nf(o[x], 2)), nf(o.total, 2)].join(';'))].join('\n');
  try { await navigator.clipboard.writeText(csv); toast('Tabela copiada. Cole no Excel.'); }
  catch (e) { openModal({ title: 'Copiar tabela', body: `<textarea class="inp mono" style="min-height:220px" readonly onfocus="this.select()">${esc(csv)}</textarea>` }); }
};

/* ---------- Configurações ---------- */
const DB_ENTITIES = [
  ['profiles', 'Usuários e perfil de acesso', () => S.users], ['drivers', 'Condutores: CNH, categoria, validade, contato', () => S.drivers.filter(x => !x._ro)],
  ['vehicles', 'Veículos, locação, CRLV e IPVA', () => S.vehicles], ['qr_codes', 'QR Codes dos veículos (ativos e revogados)', () => S.qrcodes],
  ['custody', 'Posse: quem responde pelo veículo, início, fim, km e obras', () => S.custody], ['transfers', 'Transferências e seus estados', () => S.transfers],
  ['cost_centers', 'Centros de custo', () => S.costCenters], ['projects', 'Obras', () => S.projects],
  ['checklists', 'Checklists diários e completos com fotos', () => S.checklists], ['issues', 'Problemas informados e resolução', () => S.issues],
  ['fuel_records', 'Abastecimentos', () => S.fuel], ['maintenance_plans', 'Plano preventivo por veículo', () => S.plans], ['maintenance_records', 'Serviços realizados e custos', () => S.maintRecords],
  ['tolls', 'Pedágios', () => S.tolls], ['fines', 'Multas e anexos', () => S.fines],
  ['vehicle_last_location', 'Última posição de cada veículo (GPS do condutor)', () => Object.keys(S.locations)], ['tracker_events', 'Alertas de velocidade', () => S.trackerEvents],
  ['notifications', 'Alertas para condutores e gestão', () => S.notifications], ['audit_logs', 'Auditoria de todas as ações', () => S.audit]
];
PAGES.configuracoes = {
  title: 'Configurações',
  render({ tab = 'regras' }) {
    const st = S.settings; const tabs = [['regras', 'Regras da frota'], ['obras', 'Obras e centros de custo'], ['usuarios', 'Usuários e perfis'], ['localizacao', 'Localização'], ['dados', 'Banco de dados']].filter(([k]) => CUR.role === 'admin' || ['regras', 'obras'].includes(k));
    if (!tabs.some(([k]) => k === tab)) tab = tabs[0][0];
    let body = '';
    if (tab === 'regras') body = `<form class="panel-b form-grid" id="cfg-form" data-sec="regras">
      <label class="field"><span>Prazo do checklist diário</span><input class="inp" type="time" name="dailyDeadline" value="${st.dailyDeadline}"></label>
      <label class="field"><span>Alertar transferência incompleta após (horas)</span><input class="inp num" name="transferAlertHours" value="${st.transferAlertHours}"></label>
      <label class="field"><span>Condutor com mais de um veículo</span><select class="inp" name="oneVehiclePerDriver"><option value="1" ${st.oneVehiclePerDriver ? 'selected' : ''}>Não permitir</option><option value="0" ${!st.oneVehiclePerDriver ? 'selected' : ''}>Permitir</option></select></label>
      <label class="field"><span>Fotos no checklist completo</span><select class="inp" name="requirePhotos"><option value="1" ${st.requirePhotos ? 'selected' : ''}>Obrigatórias (5 fotos)</option><option value="0" ${!st.requirePhotos ? 'selected' : ''}>Opcionais</option></select></label>
      <label class="field"><span>Manutenção: atenção a (km)</span><input class="inp num" name="attentionKm" value="${st.maint.attentionKm}"></label><label class="field"><span>Manutenção: urgente a (km)</span><input class="inp num" name="urgentKm" value="${st.maint.urgentKm}"></label>
      <label class="field"><span>Manutenção: atenção a (dias)</span><input class="inp num" name="attentionDays" value="${st.maint.attentionDays}"></label><label class="field"><span>Manutenção: urgente a (dias)</span><input class="inp num" name="urgentDays" value="${st.maint.urgentDays}"></label>
      <label class="field"><span>Consumo fora do padrão acima de (%)</span><input class="inp num" name="fuelDeviationPct" value="${st.fuelDeviationPct}"></label>
      <label class="field"><span>Locação: avisar com (dias)</span><input class="inp num" name="rentWarn" value="${st.rental.warnDays}"></label><label class="field"><span>Locação: urgente com (dias)</span><input class="inp num" name="rentUrg" value="${st.rental.urgentDays}"></label>
      <div class="full"><button class="btn ok">Salvar regras</button></div></form>`;
    if (tab === 'usuarios') body = cloudUsersTab();
    if (tab === 'obras') body = projectsTab();
    if (tab === 'localizacao') body = gpsSettings();
    if (tab === 'dados') body = `<div class="panel-b stack">${syncBadge()}<p class="muted">Os dados ficam no Supabase (PostgreSQL) com regras de acesso por perfil (RLS). Fotos e documentos ficam num armazenamento privado; os links abertos no aplicativo expiram em 1 hora.</p>
      ${tbl(['Tabela', 'Conteúdo', '>Registros visíveis'], DB_ENTITIES.map(([t, d, f]) => `<tr><td class="mono small">${t}</td><td class="small">${d}</td><td class="r">${nf(f().length)}</td></tr>`))}
      </div>`;
    return `<div class="panel"><div class="panel-h"><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-go="configuracoes" data-tab="${k}">${l}</button>`).join('')}</div></div>${body}</div>`;
  },
  mount() {
    mountGpsSettings();
    const f = $('#cfg-form');
    f?.addEventListener('submit', e => {
      e.preventDefault(); const d = formData(f); const st = S.settings; const n = x => parseFloat(String(x).replace(',', '.'));
      if (f.dataset.sec === 'regras') { st.dailyDeadline = d.dailyDeadline; st.transferAlertHours = n(d.transferAlertHours); st.oneVehiclePerDriver = d.oneVehiclePerDriver === '1'; st.requirePhotos = d.requirePhotos === '1'; Object.assign(st.maint, { attentionKm: n(d.attentionKm), urgentKm: n(d.urgentKm), attentionDays: n(d.attentionDays), urgentDays: n(d.urgentDays) }); st.fuelDeviationPct = n(d.fuelDeviationPct); st.rental = { warnDays: n(d.rentWarn), urgentDays: n(d.rentUrg) }; }
      log('config', `Configurações alteradas (${f.dataset.sec}) por ${CUR.name}`, {}); save(); toast('Configurações salvas.');
    });
  }
};

/* ---------- Obras e centros de custo ---------- */
const coordTxt = p => p.lat != null && p.lng != null ? `${nf(p.lat, 5)}, ${nf(p.lng, 5)}` : '<span class="muted">sem local</span>';
function projectsTab() {
  const man = isManager();
  const ccRows = S.costCenters.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true })).map(c => `<tr style="${c.active === false ? 'opacity:.6' : ''}"><td class="mono"><b>${esc(c.code)}</b></td><td>${esc(c.name)}</td><td class="r">${S.projects.filter(p => p.ccId === c.id).length}</td><td>${c.active === false ? pill('Inativo') : pill('Ativo', 'ok')}</td><td class="r">${man ? `<button class="btn sm" data-act="cc-edit" data-id="${c.id}">${ic('edit')}Editar</button>` : ''}</td></tr>`);
  const pRows = S.projects.slice().sort((a, b) => (b.active - a.active) || String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true })).map(p => `<tr style="${p.active ? '' : 'opacity:.6'}"><td><b>${esc(p.code)}</b></td><td>${esc(p.name)}</td><td class="small">${ccLabel(p.ccId)}</td><td class="small mono">${coordTxt(p)}</td><td>${S.vehicles.filter(v => currentSegment(activeCustody(v.id))?.projectId === p.id).map(v => plate(v.plate)).join(' ') || '<span class="muted">—</span>'}</td><td>${p.active ? pill('Ativa', 'ok') : pill('Encerrada')}</td><td class="r">${man ? `<button class="btn sm" data-act="prj-edit" data-id="${p.id}">${ic('edit')}Editar</button>` : ''}</td></tr>`);
  return `<div class="panel-b row" style="justify-content:space-between"><h3>Centros de custo</h3>${man ? `<button class="btn pri" data-act="cc-edit">${ic('plus')}Novo centro de custo</button>` : ''}</div>
    ${tbl(['Código', 'Descrição', '>Obras', 'Situação', ''], ccRows, 'Nenhum centro de custo. Cadastre o primeiro para depois criar as obras.')}
    <div class="panel-b row" style="justify-content:space-between;border-top:1px solid var(--line)"><h3>Obras</h3>${man ? `<button class="btn pri" data-act="prj-edit" ${S.costCenters.some(c => c.active !== false) ? '' : 'disabled title="Cadastre antes um centro de custo"'}>${ic('plus')}Nova obra</button>` : ''}</div>
    ${tbl(['Obra', 'Descrição', 'Centro de custo', 'Local (lat, long)', 'Veículos agora', 'Situação', ''], pRows, 'Nenhuma obra cadastrada.')}
    <p class="panel-b small muted">O local da obra (latitude e longitude) aparece no mapa e serve para identificar quando o veículo está no canteiro. No Google Maps, clique com o botão direito no local e copie as coordenadas.</p>`;
}
ACTIONS['cc-edit'] = a => {
  const c = a.dataset.id ? byId(S.costCenters, a.dataset.id) : null;
  openModal({
    title: c ? 'Editar centro de custo' : 'Novo centro de custo',
    body: `<form id="cc-form" class="form-grid"><label class="field"><span>Código</span><input class="inp" name="code" value="${esc(c?.code || '')}" placeholder="1015"></label><label class="field"><span>Descrição</span><input class="inp" name="name" value="${esc(c?.name || '')}" placeholder="Obras de Subestação"></label>
      ${c ? `<label class="field"><span>Situação</span><select class="inp" name="active"><option value="1" ${c.active !== false ? 'selected' : ''}>Ativo</option><option value="0" ${c.active === false ? 'selected' : ''}>Inativo</option></select></label>` : ''}<p class="err full" id="cc-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="cc-save" data-id="${c?.id || ''}">Salvar</button>`
  });
};
ACTIONS['cc-save'] = a => {
  const d = formData($('#cc-form')); const err = t => $('#cc-err').textContent = t;
  if (!d.code || !d.name) return err('Informe código e descrição.');
  if (S.costCenters.some(x => x.id !== a.dataset.id && String(x.code).toLowerCase() === d.code.toLowerCase())) return err('Já existe um centro de custo com este código.');
  let c = a.dataset.id ? byId(S.costCenters, a.dataset.id) : null;
  if (c) Object.assign(c, { code: d.code, name: d.name, active: d.active !== '0' });
  else { c = { id: uid(), code: d.code, name: d.name, active: true }; S.costCenters.push(c); }
  log('config', `Centro de custo ${d.code} – ${d.name} ${a.dataset.id ? 'alterado' : 'cadastrado'} por ${CUR.name}`, {}); save(); closeModal(); toast('Centro de custo salvo.'); render();
};
ACTIONS['prj-edit'] = a => {
  const p = a.dataset.id ? byId(S.projects, a.dataset.id) : null;
  openModal({
    title: p ? 'Editar obra' : 'Nova obra',
    body: `<form id="prj-form" class="form-grid"><label class="field"><span>Código</span><input class="inp" name="code" value="${esc(p?.code || '')}" placeholder="Obra 40"></label>
      <label class="field"><span>Centro de custo</span><select class="inp" name="ccId">${S.costCenters.filter(c => c.active !== false || c.id === p?.ccId).map(c => `<option value="${c.id}" ${c.id === p?.ccId ? 'selected' : ''}>${esc(c.code)} – ${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field full"><span>Descrição</span><input class="inp" name="name" value="${esc(p?.name || '')}" placeholder="Cliente, local ou escopo"></label>
      <label class="field full"><span>Local: latitude, longitude (opcional)</span><input class="inp mono" name="coords" value="${p && p.lat != null ? `${p.lat}, ${p.lng}` : ''}" placeholder="-22.90561, -47.06070" inputmode="text"><small><button type="button" class="link small" data-act="prj-here">Usar a minha localização atual</button></small></label>
      ${p ? `<label class="field"><span>Situação</span><select class="inp" name="active"><option value="1" ${p.active ? 'selected' : ''}>Ativa</option><option value="0" ${!p.active ? 'selected' : ''}>Encerrada</option></select></label>` : ''}
      <p class="err full" id="prj-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="prj-save" data-id="${p?.id || ''}">Salvar</button>`
  });
};
ACTIONS['prj-here'] = () => {
  if (!navigator.geolocation) return toast('Localização indisponível neste navegador.');
  navigator.geolocation.getCurrentPosition(pos => { const i = $('#prj-form [name=coords]'); if (i) i.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`; }, () => toast('Não foi possível obter a localização. Verifique a permissão.'), { enableHighAccuracy: true, timeout: 10000 });
};
ACTIONS['prj-save'] = a => {
  const d = formData($('#prj-form')); const err = t => $('#prj-err').textContent = t;
  if (!d.code || !d.name) return err('Informe código e descrição.');
  if (!d.ccId) return err('Escolha o centro de custo.');
  if (S.projects.some(x => x.id !== a.dataset.id && String(x.code).toLowerCase() === d.code.toLowerCase())) return err('Já existe uma obra com este código.');
  let lat = null, lng = null;
  if (d.coords) {
    const m = d.coords.replace(/[()]/g, '').match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (!m) return err('Coordenadas inválidas. Use o formato -22.90561, -47.06070.');
    lat = parseFloat(m[1].replace(',', '.')); lng = parseFloat(m[2].replace(',', '.'));
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return err('Coordenadas fora do intervalo válido.');
  }
  let p = a.dataset.id ? byId(S.projects, a.dataset.id) : null;
  if (p) Object.assign(p, { code: d.code, name: d.name, ccId: d.ccId, lat, lng, active: d.active !== '0' });
  else { p = { id: uid(), code: d.code, name: d.name, ccId: d.ccId, lat, lng, active: true }; S.projects.push(p); }
  log('config', `Obra ${d.code} ${a.dataset.id ? 'alterada' : 'cadastrada'} por ${CUR.name}`, {}); save(); closeModal(); toast('Obra salva.'); render();
};

/* ---------- Login ---------- */
PAGES.login = { render: () => cloudLoginPage(), mount: () => mountCloudLogin() };

/* ---------- Inicialização ---------- */
function boot() {
  if (!cloudConfigured()) { $('#app').innerHTML = '<div class="login"><div class="login-l"><h1>gestaovia</h1><p class="err">Configuração do servidor ausente. Gere o site com o build.py a partir do config.json.</p></div></div>'; return; }
  try { history.replaceState({ page: 'login', p: {} }, ''); } catch (e) { }
  CLOUD.boot();
}
boot();
