/* ===================== Calendário de manutenção e locação ===================== */
const LVL_CLASS = { normal: 'neu', atencao: 'warn', urgente: 'urg', vencido: 'bad' };
function calEvents(from, to, vid) {
  const today = startOfDay(nowTs()); const ev = [];
  S.vehicles.filter(v => v.active && (!vid || v.id === vid)).forEach(v => {
    S.plans.filter(p => p.vehicleId === v.id).forEach(p => {
      const d = planDue(p); if (d.date == null) return;
      const date = Math.max(d.date, today);
      if (date >= from && date < to) ev.push({ date, kind: 'mnt', c: LVL_CLASS[d.lvl], lvl: d.lvl, label: p.item, plate: v.plate, vid: v.id, planId: p.id, d });
    });
    if (v.ownership === 'locada' && v.rental?.status === 'ativa') {
      const date = Math.max(startOfDay(v.rental.dueDate), today); const rs = rentalState(v);
      if (date >= from && date < to) ev.push({ date, kind: 'rent', c: rs.lvl === 'normal' ? 'rent' : LVL_CLASS[rs.lvl], lvl: rs.lvl, label: 'Devolver ou renovar', plate: v.plate, vid: v.id, rs });
    }
  });
  S.maintRecords.filter(r => (!vid || r.vehicleId === vid) && r.at >= from && r.at < to).forEach(r => ev.push({ date: startOfDay(r.at), kind: 'done', c: 'ok', lvl: 'ok', label: r.items.join(', '), plate: veh(r.vehicleId).plate, vid: r.vehicleId, rec: r }));
  ev.push(...docCalEvents(from, to, vid));
  return ev.sort((a, b) => a.date - b.date || (M_LEVEL[b.lvl]?.r || 0) - (M_LEVEL[a.lvl]?.r || 0));
}
function upcomingEvents(days) { const t = startOfDay(nowTs()); return calEvents(t, t + days * DAY).filter(e => e.kind !== 'done'); }

let CAL_M = 0;
PAGES.calendario = {
  title: 'Calendário',
  render({ vid = '' }) {
    const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0); base.setMonth(base.getMonth() + CAL_M);
    const first = base.getTime(); const next = new Date(base); next.setMonth(next.getMonth() + 1);
    const start = first - base.getDay() * DAY; const days = Math.ceil((next.getTime() - start) / DAY / 7) * 7;
    const ev = calEvents(start, start + days * DAY, vid);
    const byDay = {}; ev.forEach(e => (byDay[e.date] = byDay[e.date] || []).push(e));
    const today = startOfDay(nowTs());
    const cell = t => { const d = new Date(t); const es = byDay[t] || [];
      return `<div class="cal-day ${d.getMonth() !== base.getMonth() ? 'other' : ''} ${t === today ? 'today' : ''}"><div class="d"><span>${d.getDate()}</span>${es.length > 3 ? `<span class="cal-more">+${es.length - 3}</span>` : ''}</div>${es.slice(0, 3).map(e => `<button class="cal-ev ${e.c}" data-act="cal-ev" data-k="${e.kind}" data-id="${e.planId || e.rec?.id || e.vid}" title="${e.plate} · ${esc(e.label)}">${e.plate} · ${esc(e.label)}</button>`).join('')}</div>`; };
    const cells = []; for (let i = 0; i < days; i++) cells.push(cell(start + i * DAY));
    const monthEv = ev.filter(e => e.date >= first && e.date < next.getTime());
    const list = Object.entries(byDay).filter(([t]) => +t >= first && +t < next.getTime()).map(([t, es]) => `<div class="panel"><div class="panel-h"><h3>${new Date(+t).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</h3></div><div class="panel-b" style="display:flex;flex-direction:column;gap:5px">${es.map(e => `<button class="cal-ev ${e.c}" style="font-size:.8rem;padding:6px 8px" data-act="cal-ev" data-k="${e.kind}" data-id="${e.planId || e.rec?.id || e.vid}">${e.plate} · ${esc(e.label)}</button>`).join('')}</div></div>`).join('') || empty('Nada neste mês.');
    const cnt = k => monthEv.filter(e => e.lvl === k).length;
    return `<div class="stack urg-scope">
      <div class="page-head" style="margin:0"><div class="row"><button class="icon-btn" data-act="cal-nav" data-d="-1" aria-label="Mês anterior">${ic('back')}</button><h2 style="min-width:170px;text-align:center">${cap(base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2><button class="icon-btn" data-act="cal-nav" data-d="1" aria-label="Próximo mês" style="transform:scaleX(-1)">${ic('back')}</button><button class="btn sm" data-act="cal-nav" data-d="0">Hoje</button></div>
        <div class="row"><select class="inp" id="cal-v" style="width:auto;min-height:36px" aria-label="Filtrar veículo"><option value="">Todos os veículos</option>${S.vehicles.filter(v => v.active).map(v => `<option value="${v.id}" ${v.id === vid ? 'selected' : ''}>${v.plate} · ${esc(v.model)}</option>`).join('')}</select></div></div>
      <div class="kpis">${kpi('Vencidas', cnt('vencido'), 'alert', cnt('vencido') ? 'c-red' : '')}${kpi('Urgentes', cnt('urgente'), 'wrench', cnt('urgente') ? 'c-orange' : '')}${kpi('Atenção', cnt('atencao'), 'wrench', cnt('atencao') ? 'c-yellow' : '')}${kpi('Previstas', cnt('normal'), 'cal', 'c-blue')}${kpi('Locações', monthEv.filter(e => e.kind === 'rent').length, 'key')}${kpi('Realizadas', monthEv.filter(e => e.kind === 'done').length, 'check', 'c-green')}</div>
      <div class="panel"><div class="panel-b" style="padding-top:14px">
        <div class="cal-grid month">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-head">${d}</div>`).join('')}${cells.join('')}</div>
        <div class="cal-list">${list}</div>
        <div class="map-legend"><span class="st"><span class="dot bad"></span>Vencida</span><span class="st"><span class="dot urg"></span>Urgente</span><span class="st"><span class="dot warn"></span>Atenção</span><span class="st"><span class="dot neu"></span>Prevista</span><span class="st"><span class="dot" style="background:var(--violet)"></span>Locação e documentos</span><span class="st"><span class="dot ok"></span>Realizada</span><span class="muted">Datas por km são estimadas pelo uso médio de cada veículo.</span></div>
      </div></div>
      ${vid ? `<div class="panel"><div class="panel-h"><h2>Plano de manutenção · ${veh(vid).plate}</h2><span class="muted small">${esc(veh(vid).model)} · ${km(veh(vid).odometer)} · ${nf(avgDailyKm(vid))} km/dia</span></div>${planEditor(veh(vid))}</div>`
        : `<div class="panel"><div class="panel-h"><h2>Planos de manutenção</h2><span class="muted small">Escolha o veículo para definir os intervalos</span></div><div class="panel-b"><div class="cards">${S.vehicles.filter(v => v.active).map(v => { const mt = vehicleMaint(v.id); return `<div class="vcard" data-go="calendario" data-vid="${v.id}" style="gap:8px"><div class="h">${plate(v.plate)}${mLvl(mt.worst)}</div><div class="small muted">${S.plans.filter(p => p.vehicleId === v.id).length} itens no plano${mt.next ? ` · ${esc(mt.next.p.item)} ${mt.next.s.remKm > 0 ? `em ${nf(mt.next.s.remKm)} km` : `vencida há ${nf(-mt.next.s.remKm)} km`}` : ''}</div></div>`; }).join('')}</div></div></div>`}
    </div>`;
  },
  mount({ vid }) { $('#cal-v')?.addEventListener('change', e => go('calendario', { vid: e.target.value })); mountPlanEditor(vid); }
};
ACTIONS['cal-nav'] = a => { const d = +a.dataset.d; CAL_M = d === 0 ? 0 : CAL_M + d; render(); };
ACTIONS['cal-ev'] = a => {
  const k = a.dataset.k, id = a.dataset.id;
  if (k === 'doc') { closeModal(); return go('veiculo', { id, tab: 'docs' }); }
  if (k === 'rent') { const v = veh(id); const rs = rentalState(v); return openModal({ title: `Locação · ${v.plate}`, body: `<div class="pairs"><div><dt>Locadora</dt><dd>${esc(v.rental.company)}</dd></div><div><dt>Contrato</dt><dd>${esc(v.rental.contract || '—')}</dd></div><div><dt>Retirada</dt><dd>${fmtDate(v.rental.pickupDate)}</dd></div><div><dt>Prazo</dt><dd>${fmtDate(v.rental.dueDate)} ${rs ? `(${rs.days < 0 ? 'vencida' : rs.days + ' dias'})` : ''}</dd></div></div>`, foot: `<button class="btn" data-go="veiculo" data-id="${v.id}">Abrir veículo</button>${isManager() ? `<button class="btn pri" data-act="rent-renew" data-id="${v.id}">Renovar</button>` : ''}` }); }
  if (k === 'done') { const r = byId(S.maintRecords, id); return openModal({ title: `Manutenção realizada · ${veh(r.vehicleId).plate}`, body: `<div class="pairs"><div><dt>Data</dt><dd>${fmtDate(r.at)}</dd></div><div><dt>Km</dt><dd>${nf(r.km)}</dd></div><div><dt>Serviços</dt><dd>${esc(r.items.join(', '))}</dd></div><div><dt>Custo</dt><dd>${money(r.cost)}</dd></div><div><dt>Oficina</dt><dd>${esc(recShop(r))}</dd></div></div>${r.notes ? `<p class="small muted">${esc(r.notes)}</p>` : ''}`, foot: isManager() ? `<button class="btn" data-act="mr-edit" data-id="${r.id}">${ic('edit')}Editar ou excluir</button>` : '' }); }
  const p = byId(S.plans, id); const v = veh(p.vehicleId); const d = planDue(p);
  openModal({
    title: `${p.item} · ${v.plate}`, body: `<div class="row">${mLvl(d.lvl)}<span class="muted small">${d.basis === 'km' ? `Estimada pelo uso médio de ${nf(avgDailyKm(v.id))} km/dia` : 'Pela data definida no plano'}</span></div>
      <div class="pairs">${p.everyKm ? `<div><dt>Intervalo</dt><dd>${nf(p.everyKm)} km</dd></div><div><dt>Última troca</dt><dd>${nf(p.lastKm)} km</dd></div><div><dt>Próxima</dt><dd>${nf(d.nextKm)} km</dd></div><div><dt>Restante</dt><dd style="color:${d.remKm <= 0 ? 'var(--red)' : 'inherit'}">${nf(d.remKm)} km</dd></div>` : ''}${p.everyDays ? `<div><dt>Intervalo</dt><dd>${p.everyDays} dias</dd></div><div><dt>Data limite</dt><dd>${fmtDate(d.nextDate)}</dd></div>` : ''}<div><dt>Previsão</dt><dd>${fmtDate(d.date)}</dd></div><div><dt>Km atual</dt><dd>${nf(v.odometer)}</dd></div></div>`,
    foot: `<button class="btn" data-go="calendario" data-vid="${v.id}">Plano do veículo</button>${isManager() ? `<button class="btn pri" data-act="mp-done" data-id="${p.id}">Registrar como feita</button>` : ''}`
  });
};
ACTIONS['mp-done'] = a => {
  const p = byId(S.plans, a.dataset.id); const v = veh(p.vehicleId);
  openModal({
    title: `Registrar ${p.item.toLowerCase()} · ${v.plate}`, body: `<div class="form-grid"><label class="field"><span>Data</span><input class="inp" type="date" id="md-date" value="${dateInput(nowTs())}"></label><label class="field"><span>Quilometragem</span><input class="inp num" id="md-km" value="${v.odometer}"></label><label class="field"><span>Custo (R$)</span><input class="inp num" id="md-cost" inputmode="decimal"></label><label class="field"><span>Oficina credenciada</span>${shopSelect('md-shop', '', p.item)}</label></div>${activeShops().length ? '' : noShopsNote()}<p class="err" id="md-err"></p>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="mp-done-ok" data-id="${p.id}">Registrar</button>`
  });
};
ACTIONS['mp-done-ok'] = a => {
  const p = byId(S.plans, a.dataset.id); const v = veh(p.vehicleId); const kmv = +$('#md-km').value.replace(/\D/g, ''); const dt = parseDate($('#md-date').value);
  if (!kmv || !dt) return $('#md-err').textContent = 'Informe data e quilometragem.';
  const ws = $('#md-shop').value; if (!shopOk(ws)) return $('#md-err').textContent = 'Escolha a oficina credenciada onde o serviço foi feito.';
  if (dt > nowTs()) return $('#md-err').textContent = 'A data não pode ser futura.';
  const cost = parseFloat($('#md-cost').value.replace(/\./g, '').replace(',', '.')) || 0;
  const prev = planSnapshot(v.id, [p.item]);
  p.lastKm = kmv; p.lastDate = dt; v.odometer = Math.max(v.odometer, kmv);
  S.maintRecords.push({ id: uid('mr'), vehicleId: v.id, at: dt + 12 * 36e5, items: [p.item], cost, shop: shopName(ws), workshopId: ws, km: kmv, type: 'preventiva', planPrev: prev });
  log('manutencao', `${p.item} realizada (${nf(kmv)} km)${cost ? ' · ' + money(cost) : ''}`, { vehicleId: v.id });
  save(); closeModal(); toast(`${p.item} registrada. Próxima recalculada.`); render();
};

/* ---------- editor do plano por veículo ---------- */
const PLAN_ITEMS = ['Troca de óleo', 'Filtros', 'Alinhamento', 'Balanceamento', 'Pneus', 'Revisão', 'Correia dentada', 'Freios', 'Bateria'];
function planEditor(v) {
  const M = isManager(); const items = [...new Set([...PLAN_ITEMS, ...S.plans.filter(p => p.vehicleId === v.id).map(p => p.item)])];
  const rows = items.map(it => {
    const p = S.plans.find(x => x.vehicleId === v.id && x.item === it); const d = p ? planDue(p) : null;
    const dis = M ? '' : 'disabled';
    return `<tr data-item="${esc(it)}" class="${p ? 'sev ' + (M_LEVEL[d.lvl].c === 'gray' ? '' : M_LEVEL[d.lvl].c) : ''}">
      <td><label class="toggle"><input type="checkbox" class="pe-on" ${p ? 'checked' : ''} ${dis} aria-label="Controlar ${esc(it)}"><i></i></label></td><td class="nowrap"><b>${esc(it)}</b></td>
      <td><input class="inp num pe-km" value="${p?.everyKm ?? ''}" placeholder="km" inputmode="numeric" style="width:96px;min-height:34px" ${dis}></td>
      <td><input class="inp num pe-days" value="${p?.everyDays ?? ''}" placeholder="dias" inputmode="numeric" style="width:76px;min-height:34px" ${dis}></td>
      <td><input class="inp num pe-lkm" value="${p?.lastKm ?? ''}" placeholder="${v.odometer}" inputmode="numeric" style="width:96px;min-height:34px" ${dis}></td>
      <td><input class="inp pe-ldate" type="date" value="${p?.lastDate ? dateInput(p.lastDate) : ''}" style="width:142px;min-height:34px" ${dis}></td>
      <td class="nowrap small">${d ? `${d.remKm != null ? `<b class="num">${d.remKm > 0 ? nf(d.remKm) + ' km' : 'vencida'}</b><br>` : ''}<span class="muted">${fmtDate(d.date)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${d ? mLvl(d.lvl) : ''}</td></tr>`;
  });
  return `<div class="tbl-wrap"><table class="tbl" id="plan-tbl"><thead><tr><th></th><th>Item</th><th>A cada (km)</th><th>A cada (dias)</th><th>Última troca (km)</th><th>Última troca (data)</th><th>Próxima</th><th>Situação</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    ${M ? `<div class="panel-b row" style="justify-content:space-between;padding-top:12px"><span class="small muted">Em branco, a última troca assume o km atual e a data de hoje. Vence no que ocorrer primeiro.</span><div class="row"><span class="err" id="pe-err"></span><button class="btn ok" data-act="plan-save" data-id="${v.id}">Salvar plano</button></div></div>` : ''}`;
}
function mountPlanEditor() {
  $$('#plan-tbl tr[data-item]').forEach(tr => tr.querySelectorAll('.pe-km,.pe-days').forEach(i => i.addEventListener('input', () => { if (i.value) tr.querySelector('.pe-on').checked = true; })));
}
PAGES.veiculo._mountPlan = () => mountPlanEditor();
ACTIONS['plan-save'] = a => {
  const v = veh(a.dataset.id); const n = x => x ? parseInt(String(x).replace(/\D/g, ''), 10) : null; let changed = 0;
  for (const tr of $$('#plan-tbl tr[data-item]')) {
    const it = tr.dataset.item; const on = tr.querySelector('.pe-on').checked; const p = S.plans.find(x => x.vehicleId === v.id && x.item === it);
    const everyKm = n(tr.querySelector('.pe-km').value), everyDays = n(tr.querySelector('.pe-days').value);
    if (!on) { if (p) { S.plans = S.plans.filter(x => x !== p); changed++; } continue; }
    if (!everyKm && !everyDays) { $('#pe-err').textContent = `${it}: informe km, dias ou ambos.`; return; }
    const lastKm = n(tr.querySelector('.pe-lkm').value) ?? (p?.lastKm ?? v.odometer);
    const lastDate = parseDate(tr.querySelector('.pe-ldate').value) || p?.lastDate || startOfDay(nowTs());
    if (lastKm > v.odometer) { $('#pe-err').textContent = `${it}: última troca acima do km atual.`; return; }
    const vals = { everyKm, everyDays, lastKm, lastDate };
    if (p) { if (JSON.stringify([p.everyKm, p.everyDays, p.lastKm, p.lastDate]) !== JSON.stringify([everyKm, everyDays, lastKm, lastDate])) { Object.assign(p, vals); changed++; } }
    else { S.plans.push({ id: uid('mp'), vehicleId: v.id, item: it, ...vals }); changed++; }
  }
  log('manutencao', `Plano de manutenção atualizado por ${CUR.name} (${changed} item(ns))`, { vehicleId: v.id });
  save(); toast('Plano salvo. Calendário atualizado.'); render();
};

