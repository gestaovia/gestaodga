/* ===================== Lavagem dos veículos (v1.19.0) =====================
   A gestão lança só: placa, dia, km e valor (sem checklist). Cada lavagem fica no próprio veículo
   (v.washes, gravado no campo extra de vehicles — sem tabela nova no banco).
   Lembrete para levar ao lavador:
   - pelo prazo: S.settings.wash.everyDays depois da última lavagem (aviso warnDays antes);
   - pela limpeza: o checklist completo mais recente depois da última lavagem marcou Limpeza = Ruim.
   Aparece em Atenção necessária, no calendário, no cartão do veículo, na tela Lavagens e como notificação
   para a gestão (uma por prazo vencido e uma por checklist com limpeza ruim). Veículo inativo ou na oficina
   não gera lembrete. Veículo sem nenhuma lavagem lançada só entra no lembrete pela limpeza ruim. */
const WASH_DEF = () => ({ everyDays: 30, warnDays: 5 });
const washCfg = () => ({ ...WASH_DEF(), ...(S.settings.wash || {}) });
const washesOf = v => (v?.washes || []).slice().sort((a, b) => b.at - a.at);
const allWashes = () => S.vehicles.flatMap(v => (v.washes || []).map(w => ({ ...w, vehicleId: v.id })));
const W_LEVEL = {
  ruim: { l: 'Limpeza ruim no checklist', c: 'urg', r: 4 }, vencido: { l: 'Lavagem vencida', c: 'bad', r: 3 }, hoje: { l: 'Levar hoje', c: 'urg', r: 2 },
  atencao: { l: 'Levar em breve', c: 'warn', r: 1 }, normal: { l: 'Em dia', c: 'ok', r: 0 }, sem: { l: 'Sem lavagem registrada', c: 'gray', r: -1 }
};
function washState(v) {
  const W = washCfg(); const every = Math.max(1, +W.everyDays || 30); const warn = Math.max(0, +W.warnDays || 0);
  const last = washesOf(v)[0] || null;
  // checklist completo mais recente que avaliou a limpeza depois da última lavagem
  const ck = S.checklists.filter(k => k.vehicleId === v.id && k.items?.limpeza && (!last || k.at > last.at)).sort((a, b) => b.at - a.at)[0] || null;
  const dirty = ck && ck.items.limpeza === 'ruim' ? ck : null;
  const today = startOfDay(nowTs());
  const due = last ? startOfDay(last.at) + every * DAY : null;
  const days = due == null ? null : Math.round((due - today) / DAY);
  const lvl = dirty ? 'ruim' : days == null ? 'sem' : days < 0 ? 'vencido' : days === 0 ? 'hoje' : days <= warn ? 'atencao' : 'normal';
  const remind = !!v.active && !v.maintenance && ['ruim', 'vencido', 'hoje', 'atencao'].includes(lvl);
  return { last, due, days, dirty, lvl, remind, every };
}
const washText = s => s.lvl === 'ruim' ? `Limpeza ruim no checklist de ${CK_TYPES[s.dirty.type]?.toLowerCase() || 'veículo'} (${fmtShort(s.dirty.at)})`
  : s.lvl === 'vencido' ? `Lavagem vencida há ${-s.days} ${-s.days === 1 ? 'dia' : 'dias'}` : s.lvl === 'hoje' ? 'Levar ao lavador hoje'
  : s.lvl === 'atencao' ? `Levar ao lavador em ${s.days} ${s.days === 1 ? 'dia' : 'dias'} (${fmtDate(s.due)})` : s.lvl === 'normal' ? `Próxima em ${fmtDate(s.due)}` : 'Nenhuma lavagem lançada';
const washTag = s => `<span class="st"><span class="dot ${W_LEVEL[s.lvl].c}"></span>${W_LEVEL[s.lvl].l}</span>`;

/* ----- lembretes ----- */
function washAttention() {
  return S.vehicles.filter(v => v.active).map(v => [v, washState(v)]).filter(([, s]) => s.remind).map(([v, s]) => ({
    c: W_LEVEL[s.lvl].c === 'bad' ? 'urg' : W_LEVEL[s.lvl].c, r: W_LEVEL[s.lvl].r, icon: 'wash', title: `${v.plate} · lavagem`, sub: washText(s),
    text: `Veículo ${v.plate}: ${washText(s).toLowerCase()}.`, at: s.dirty?.at || null, go: { page: 'lavagens' }
  }));
}
// notificação para a gestão quando o prazo chega (uma vez por prazo; a chave fica na própria notificação)
function washRemind() {
  if (!isManager()) return;
  let n = 0;
  S.vehicles.filter(v => v.active && !v.maintenance).forEach(v => {
    const s = washState(v); if (s.due == null || s.days > 0) return;
    const key = `wash:${v.id}:${s.due}`;
    if (S.notifications.some(x => x.link?.key === key)) return;
    notify('gestao', `${v.plate}: lavagem ${s.days < 0 ? `vencida desde ${fmtDate(s.due)}` : 'vence hoje'} (última em ${fmtDate(s.last.at)}). Leve o veículo ao lavador.`, { level: 'warn', link: { page: 'lavagens', key } });
    n++;
  });
  if (n) save();
}
// chamada ao salvar checklist completo: limpeza marcada como ruim avisa a gestão
function washCheckNotify(v, ck) {
  if (ck?.items?.limpeza !== 'ruim') return;
  notify('gestao', `${v.plate}: limpeza marcada como RUIM no checklist de ${CK_TYPES[ck.type]?.toLowerCase() || 'veículo'}${ck.driverId && drv(ck.driverId) ? ` de ${drv(ck.driverId).name}` : ''}. Leve o veículo ao lavador.`, { level: 'warn', link: { page: 'lavagens', key: `washck:${ck.id}` } });
}
function washCalEvents(from, to, vid) {
  const today = startOfDay(nowTs()); const ev = [];
  S.vehicles.filter(v => v.active && !v.maintenance && (!vid || v.id === vid)).forEach(v => {
    const s = washState(v); if (s.lvl === 'sem' && !s.dirty) return;
    const date = s.dirty ? today : Math.max(s.due, today);
    if (date >= from && date < to) ev.push({ date, kind: 'wash', c: s.lvl === 'normal' ? 'neu' : W_LEVEL[s.lvl].c === 'bad' ? 'bad' : W_LEVEL[s.lvl].c, lvl: 'wash', label: s.dirty ? 'Lavar (limpeza ruim)' : 'Lavagem', plate: v.plate, vid: v.id });
  });
  return ev;
}
function washCosts(from, to) {
  return allWashes().filter(w => w.at >= from && w.at < to).map(w => { const c = custodyAt(w.vehicleId, w.at); return { kind: 'Lavagem', value: +w.value || 0, vehicleId: w.vehicleId, driverId: null, projectId: c ? segmentAt(c, w.at)?.projectId : null }; });
}

/* ----- tela Lavagens ----- */
let WASH_F = '';
PAGES.lavagens = {
  title: 'Lavagens',
  render({ f = WASH_F }) {
    WASH_F = f; const M = isManager();
    const act = S.vehicles.filter(v => v.active);
    const st = act.map(v => ({ v, s: washState(v) })).sort((a, b) => (+b.s.remind - +a.s.remind) || W_LEVEL[b.s.lvl].r - W_LEVEL[a.s.lvl].r || (a.s.due ?? Infinity) - (b.s.due ?? Infinity) || a.v.plate.localeCompare(b.v.plate));
    const toWash = st.filter(x => x.s.remind);
    const list = f === 'lavar' ? toWash : st;
    const from = startOfMonth(nowTs()); const month = allWashes().filter(w => w.at >= from);
    const recs = allWashes().sort((a, b) => b.at - a.at); const n = +(ROUTE.p.n || 50);
    return `<div class="page-head"><div class="filters"><button class="chip ${!f ? 'on' : ''}" data-go="lavagens" data-f="">Todos<span class="n">${st.length}</span></button><button class="chip ${f === 'lavar' ? 'on' : ''}" data-go="lavagens" data-f="lavar"><span class="dot urg"></span>Levar ao lavador<span class="n">${toWash.length}</span></button></div>
      <div class="row">${M ? `<button class="btn" data-go="configuracoes" data-tab="regras">${ic('gear')}Prazo da lavagem</button><button class="btn pri" data-act="wash-new">${ic('plus')}Registrar lavagem</button>` : ''}</div></div>
      <div class="stack urg-scope">
      <div class="kpis">${kpi('Levar ao lavador', toWash.length, 'wash', toWash.length ? 'c-orange' : '', 'data-go="lavagens" data-f="lavar"')}${kpi('Limpeza ruim', st.filter(x => x.s.dirty && x.s.remind).length, 'alert', st.some(x => x.s.dirty && x.s.remind) ? 'c-red' : '')}${kpi('Lavagens no mês', month.length, 'check', 'c-green')}${kpi('Gasto no mês', money(sum(month, w => w.value)), 'report')}</div>
      <div class="panel"><div class="panel-h"><h3>Situação da frota</h3><span class="small muted">Lavar a cada ${washCfg().everyDays} dias ou quando o checklist apontar limpeza ruim</span></div>
        ${tbl(['Veículo', 'Última lavagem', '>Km', 'Situação', '', ...(M ? [''] : [])], list.map(({ v, s }) => `<tr><td>${vehLink(v.id)}${v.maintenance ? ' <span class="small muted">na oficina</span>' : ''}</td><td class="nowrap">${s.last ? fmtDate(s.last.at) : '<span class="muted">—</span>'}</td><td class="r">${s.last ? nf(s.last.km) : '—'}</td><td class="nowrap">${washTag(s)}</td><td class="small">${esc(washText(s))}</td>${M ? `<td class="r nowrap"><button class="btn sm" data-act="wash-new" data-vid="${v.id}">${ic('plus')}Registrar</button></td>` : ''}</tr>`), f === 'lavar' ? 'Nenhum veículo para levar ao lavador.' : 'Nenhum veículo ativo.')}</div>
      <div class="panel"><div class="panel-h"><h3>Lavagens registradas</h3><span class="small muted">${recs.length} no total · ${money(sum(recs, w => w.value))}</span></div>${washTable(recs.slice(0, n))}${recs.length > n ? `<div class="panel-b"><button class="btn sm" data-go="lavagens" data-n="${n + 100}">Mostrar mais (${recs.length - n})</button></div>` : ''}</div>
      </div>`;
  }
};
function washTable(list, opts = {}) {
  const M = isManager();
  return tbl(['Data', ...(opts.noVeh ? [] : ['Veículo']), '>Km', '>Valor', 'Registrada por', ...(M ? [''] : [])], list.map(w => `<tr><td class="nowrap">${fmtDate(w.at)}</td>${opts.noVeh ? '' : `<td>${vehLink(w.vehicleId)}</td>`}<td class="r">${nf(w.km)}</td><td class="r">${money(w.value)}</td><td class="small">${esc(userName(w.by))}</td>${M ? `<td class="r nowrap"><button class="btn sm" data-act="wash-edit" data-vid="${w.vehicleId}" data-id="${w.id}">${ic('edit')}Editar</button></td>` : ''}</tr>`), 'Nenhuma lavagem registrada.');
}
// aba Lavagem na tela do veículo
function washTab(v) {
  const s = washState(v);
  return `<div class="panel-h"><h3>Lavagens</h3>${isManager() ? `<button class="btn sm" data-act="wash-new" data-vid="${v.id}">${ic('plus')}Registrar lavagem</button>` : ''}</div>
    <div class="panel-b" style="padding-bottom:0"><div class="note ${s.remind ? W_LEVEL[s.lvl].c : ''}">${ic('wash')}<div>${washTag(s)} — ${esc(washText(s))}${s.last ? `<div class="small">Última: ${fmtDate(s.last.at)} · ${nf(s.last.km)} km · ${money(s.last.value)}</div>` : ''}</div></div></div>
    ${washTable(washesOf(v).map(w => ({ ...w, vehicleId: v.id })), { noVeh: true })}`;
}
// nota no cartão do veículo (lista Veículos)
const washCardNote = v => { const s = washState(v); return s.remind ? `<div class="note ${W_LEVEL[s.lvl].c === 'bad' ? 'bad' : W_LEVEL[s.lvl].c}" style="padding:7px 10px;font-size:.78rem">${ic('wash')}<div>${esc(washText(s))}</div></div>` : ''; };

/* ----- lançar, editar e excluir ----- */
const parseMoneyBR = s => { s = String(s || '').replace(/[^\d,.-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? n : 0; };
function washForm(w, vid) {
  const vs = S.vehicles.filter(v => v.active || v.id === vid).sort((a, b) => a.plate.localeCompare(b.plate));
  return `<form id="wash-form" class="form-grid" onsubmit="return false">
    ${w.id ? `<input type="hidden" name="vid" value="${vid}"><div class="field"><span>Placa</span><div>${plate(veh(vid).plate)}</div></div>`
      : `<label class="field"><span>Placa</span><select class="inp" name="vid"><option value="">Selecione</option>${vs.map(v => `<option value="${v.id}" ${v.id === vid ? 'selected' : ''}>${v.plate} — ${esc(v.brand || '')} ${esc(v.model || '')}</option>`).join('')}</select></label>`}
    <label class="field"><span>Dia da lavagem</span><input class="inp" type="date" name="date" value="${dateInput(w.at || nowTs())}" max="${dateInput(nowTs())}"></label>
    <label class="field"><span>Quilometragem</span><input class="inp num" name="km" inputmode="numeric" value="${w.km ?? ''}" placeholder="${vid ? nf(veh(vid).odometer) : ''}"></label>
    <label class="field"><span>Valor (R$)</span><input class="inp num" name="value" inputmode="decimal" value="${w.value ? nf(w.value, 2) : ''}" placeholder="0,00"></label>
    <p class="err full" id="wash-err"></p></form>`;
}
ACTIONS['wash-new'] = a => {
  if (!isManager()) return toast('Exclusivo para a gestão.');
  const vid = a.dataset.vid || '';
  openModal({ title: vid ? `Registrar lavagem · ${veh(vid).plate}` : 'Registrar lavagem', body: washForm({}, vid),
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="wash-save">Registrar</button>`,
    onMount: el => { const sel = el.querySelector('select[name=vid]'); sel?.addEventListener('change', () => { const v = veh(sel.value); el.querySelector('[name=km]').placeholder = v ? nf(v.odometer) : ''; }); } });
};
ACTIONS['wash-edit'] = a => {
  if (!isManager()) return toast('Exclusivo para a gestão.');
  const v = veh(a.dataset.vid); const w = (v?.washes || []).find(x => x.id === a.dataset.id); if (!w) return;
  openModal({ title: `Lavagem · ${v.plate} · ${fmtDate(w.at)}`, body: washForm(w, v.id),
    foot: `<button class="btn danger" data-act="wash-del" data-vid="${v.id}" data-id="${w.id}">Excluir</button><button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="wash-save" data-id="${w.id}">Salvar alterações</button>` });
};
ACTIONS['wash-save'] = a => {
  if (!isManager()) return toast('Exclusivo para a gestão.');
  const f = $('#wash-form'); const d = formData(f); const err = t => { $('#wash-err').textContent = t; };
  const v = veh(d.vid); if (!v) return err('Escolha a placa.');
  const day = parseDate(d.date); const kmv = parseInt(onlyDigits(d.km), 10); const value = Math.round(parseMoneyBR(d.value) * 100) / 100;
  if (!day || day > nowTs()) return err('Informe o dia da lavagem (hoje ou antes).');
  if (!kmv) return err('Informe a quilometragem.');
  const old = a.dataset.id ? (v.washes || []).find(x => x.id === a.dataset.id) : null;
  if (kmv > Math.max(v.odometer, old?.km || 0)) return err(`A quilometragem não pode passar do km atual do veículo (${nf(v.odometer)}). Se o km atual estiver errado, use Corrigir km no veículo.`);
  if (!(value > 0)) return err('Informe o valor da lavagem.');
  // lavagem de hoje fica com a hora do lançamento (o checklist feito antes dela continua valendo como anterior)
  const at = old && startOfDay(old.at) === day ? old.at : day === startOfDay(nowTs()) ? nowTs() : day + 12 * 36e5;
  v.washes = v.washes || [];
  if (old) {
    const before = { at: old.at, km: old.km, value: old.value };
    const ch = [['Dia', fmtDate(old.at), fmtDate(at)], ['Km', nf(old.km), nf(kmv)], ['Valor', money(old.value), money(value)]].filter(x => x[1] !== x[2]);
    if (!ch.length) { closeModal(); return; }
    Object.assign(old, { at, km: kmv, value, editedBy: CUR.id, editedAt: nowTs() });
    log('lavagem', `Lavagem alterada por ${CUR.name}: ${ch.map(([l, x, y]) => `${l} ${x} → ${y}`).join('; ')}`, { vehicleId: v.id, data: { washId: old.id, before } });
    save(); closeModal(); toast('Lavagem atualizada.'); return render();
  }
  if (v.washes.some(w => startOfDay(w.at) === day)) return err(`Já existe lavagem do ${v.plate} em ${fmtDate(day)}. Para corrigir, use Editar na lista.`);
  const w = { id: uid('wash'), at, km: kmv, value, by: CUR.id, createdAt: nowTs() };
  v.washes.push(w);
  log('lavagem', `Lavagem registrada por ${CUR.name}: ${fmtDate(at)} · ${nf(kmv)} km · ${money(value)}`, { vehicleId: v.id, data: { washId: w.id } });
  save(); closeModal(); toast(`Lavagem do ${v.plate} registrada.`); render();
};
ACTIONS['wash-del'] = a => {
  const v = veh(a.dataset.vid); const w = (v?.washes || []).find(x => x.id === a.dataset.id); if (!w) return;
  openModal({ title: 'Excluir lavagem', body: `<p><b>${v.plate}</b> · ${fmtDate(w.at)} · ${nf(w.km)} km · ${money(w.value)}</p><p class="small muted">Uma cópia do registro fica no histórico do veículo.</p><label class="field"><span>Motivo da exclusão</span><textarea class="inp" id="wash-why"></textarea></label><p class="err" id="wash-err2"></p>`,
    foot: `<button class="btn" data-act="modal-close">Voltar</button><button class="btn danger" data-act="wash-del-ok" data-vid="${v.id}" data-id="${w.id}">Excluir</button>` });
};
ACTIONS['wash-del-ok'] = a => {
  if (!isManager()) return toast('Exclusivo para a gestão.');
  const v = veh(a.dataset.vid); const w = (v?.washes || []).find(x => x.id === a.dataset.id); if (!w) return;
  const why = $('#wash-why').value.trim(); if (why.length < 5) return $('#wash-err2').textContent = 'Informe o motivo.';
  v.washes = v.washes.filter(x => x !== w);
  log('lavagem', `Lavagem excluída por ${CUR.name} (${fmtDate(w.at)} · ${nf(w.km)} km · ${money(w.value)}): ${why}`, { vehicleId: v.id, data: { deleted: { ...w } } });
  save(); closeModal(); toast('Lavagem excluída.'); render();
};
