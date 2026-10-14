/* ===================== Abastecimento lançado pela gestão (v1.7.0) =====================
   Administrador, gestor de frota e supervisor (assistente administrativo) lançam o abastecimento
   de qualquer veículo, inclusive com data passada (ex.: conferência do extrato do cartão).
   O registro do condutor passa a ser opcional. O banco grava quem lançou (entered_by) e a origem
   (source = 'gestao' | 'condutor') e recusa registros duplicados. */

const fuelSource = f => f.source || 'condutor';
const fuelByStaff = f => fuelSource(f) === 'gestao';
const dtLocal = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const parseDtLocal = s => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN; };
const numBR = s => parseFloat(String(s ?? '').replace(/\./g, '').replace(',', '.'));
const intKm = s => parseInt(String(s ?? '').replace(/\D/g, ''), 10);

// abastecimentos parecidos (mesmo veículo, até 24 h de diferença): "igual" bloqueia, "parecido" pede confirmação
function fuelDuplicates(vid, ts, k, l, ignoreId) {
  const near = S.fuel.filter(f => f.vehicleId === vid && f.id !== ignoreId && Math.abs(f.at - ts) <= DAY);
  const same = near.filter(f => k && l && Math.abs(f.km - k) <= 5 && Math.abs(f.liters - l) <= 0.5);
  const similar = near.filter(f => !same.includes(f) && ((k && Math.abs(f.km - k) <= 50) || (l && Math.abs(f.liters - l) <= 1)));
  return { same, similar };
}
const fuelLine = f => `${fmtDT(f.at)} · ${km(f.km)} · ${nf(f.liters, 1)} L · ${money(f.total)}${f.station ? ' · ' + esc(f.station) : ''} · ${fuelByStaff(f) ? 'lançado pela gestão' : 'registrado pelo condutor'}`;

// quilometragem registrada antes e depois de um horário (para lançamentos com data passada)
function kmAround(vid, ts) {
  const pts = [...S.checklists.filter(k => k.vehicleId === vid && k.km).map(k => [k.at, k.km]), ...S.fuel.filter(f => f.vehicleId === vid).map(f => [f.at, f.km]),
    ...S.custody.filter(c => c.vehicleId === vid).flatMap(c => [[c.start, c.startKm], ...(c.end && c.endKm ? [[c.end, c.endKm]] : [])])].filter(p => p[1]);
  const before = pts.filter(p => p[0] <= ts).map(p => p[1]); const after = pts.filter(p => p[0] > ts).map(p => p[1]);
  return { prev: before.length ? Math.max(...before) : 0, next: after.length ? Math.min(...after) : null };
}

PAGES.lancar_abastecimento = {
  title: 'Lançar abastecimento',
  render({ vid }) {
    if (!isStaff()) return empty('Seu perfil não pode lançar abastecimentos.');
    if (!DRAFT || DRAFT.kind !== 'fuel_staff') DRAFT = { kind: 'fuel_staff', vid: vid || '', when: dtLocal(nowTs()), driverId: '', projectId: '', auto: true, km: '', liters: '', total: '', fuelType: '', station: '', notes: '', photos: {}, dupOk: false };
    const D = DRAFT; const v = D.vid ? veh(D.vid) : null; const ts = parseDtLocal(D.when);
    const c = v && !isNaN(ts) ? custodyAt(v.id, ts) : null; const seg = c ? segmentAt(c, ts) : null;
    if (D.auto) { D.driverId = c?.driverId || ''; D.projectId = seg?.projectId || ''; }
    const types = !v ? [] : (v.fuelType || '').startsWith('Diesel') ? ['Diesel S10', 'Diesel S500'] : ['Gasolina', 'Etanol'];
    if (v && !types.includes(D.fuelType)) D.fuelType = types.includes(v.fuelType) ? v.fuelType : types[0];
    const stations = [...new Set(S.fuel.map(f => f.station).filter(Boolean))];
    const vehs = S.vehicles.slice().sort((a, b) => a.plate.localeCompare(b.plate));
    const drvs = S.drivers.filter(d => !d._ro || d.id === D.driverId).slice().sort((a, b) => a.name.localeCompare(b.name));
    const ar = v && !isNaN(ts) ? kmAround(v.id, ts) : null;
    const k = intKm(D.km), l = numBR(D.liters);
    const dup = v && !isNaN(ts) ? fuelDuplicates(v.id, ts, k, l) : { same: [], similar: [] };
    return `<form class="stack" id="fsform" novalidate style="max-width:640px">
      <div class="note neu">${ic('fuel')}<div>Lance aqui o abastecimento que o condutor não registrou (ex.: conferência do extrato do cartão). O registro fica ligado ao veículo, ao condutor e ao seu usuário (<b>${esc(CUR.name)}</b>).</div></div>
      <div class="panel"><div class="panel-h"><h3>Veículo e data</h3></div><div class="panel-b form-grid">
        <label class="field full"><span>Veículo</span><select class="inp" name="vid" data-rerender="1"><option value="">Selecione o veículo</option>${vehs.map(x => `<option value="${x.id}" ${x.id === D.vid ? 'selected' : ''}>${esc(x.plate)} · ${esc(x.brand || '')} ${esc(x.model || '')}</option>`).join('')}</select></label>
        <label class="field"><span>Data e hora do abastecimento</span><input class="inp" type="datetime-local" name="when" value="${esc(D.when)}" max="${dtLocal(nowTs())}" data-rerender="1"></label>
        <div class="field"><span>Posse nesse horário</span><b style="font-weight:600">${!v ? '<span class="muted">Escolha o veículo</span>' : c ? esc(drv(c.driverId)?.name || '—') : '<span class="muted">Sem condutor com o veículo</span>'}</b><small>${c && seg ? `Obra ${esc(prj(seg.projectId)?.code || '')}` : ''}</small></div>
        <label class="field"><span>Condutor</span><select class="inp" name="driverId"><option value="">Sem condutor</option>${drvs.map(d => `<option value="${d.id}" ${d.id === D.driverId ? 'selected' : ''}>${esc(d.name)}${d.active === false ? ' (inativo)' : ''}</option>`).join('')}</select><small>Preenchido pela posse; altere se necessário.</small></label>
        <label class="field"><span>Obra</span><select class="inp" name="projectId"><option value="">Sem obra</option>${S.projects.filter(p => p.active !== false || p.id === D.projectId).map(p => `<option value="${p.id}" ${p.id === D.projectId ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name || '')}</option>`).join('')}</select></label>
      </div></div>
      ${v ? `<div class="panel"><div class="panel-h"><h3>Abastecimento</h3></div><div class="panel-b form-grid">
        <label class="field full"><span>Quilometragem no abastecimento</span><input class="inp big num" name="km" inputmode="numeric" value="${esc(D.km)}" placeholder="${nf(v.odometer)}"><small>${ar ? `Registro anterior: ${km(ar.prev)}${ar.next != null ? ` · registro seguinte: ${km(ar.next)}` : ''}` : ''}</small></label>
        <label class="field"><span>Litros</span><input class="inp num" name="liters" inputmode="decimal" value="${esc(D.liters)}" placeholder="0,00"></label>
        <label class="field"><span>Valor total (R$)</span><input class="inp num" name="total" inputmode="decimal" value="${esc(D.total)}" placeholder="0,00"></label>
        <div class="field full"><span>Combustível</span><div class="seg">${types.map(t => `<label><input type="radio" name="fuelType" value="${t}" ${D.fuelType === t ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
        <label class="field full"><span>Posto</span><input class="inp" name="station" list="stations-g" value="${esc(D.station)}" placeholder="Nome do posto"><datalist id="stations-g">${stations.map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
        <label class="field full"><span>Observação (opcional)</span><input class="inp" name="notes" value="${esc(D.notes)}" placeholder="Ex.: conferido no extrato do cartão"></label>
        <div class="full stack" style="gap:8px">${singlePhoto('cupom', 'Foto do cupom ou nota fiscal (opcional)')}${singlePhoto('hodometro', 'Foto do hodômetro (opcional)')}</div>
      </div></div>
      <div id="fs-dup">${dupHTML(dup)}</div>` : ''}
      <div class="note bad" id="ck-err" hidden role="alert"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-go="abastecimento">Cancelar</button><button class="btn ok lg" ${v ? '' : 'disabled'}>Lançar abastecimento</button></div>
    </form>`;
  },
  mount() {
    const f = $('#fsform'); if (!f) return; bindDraft(f);
    f.addEventListener('change', e => {
      const n = e.target.name;
      if (n === 'driverId' || n === 'projectId') DRAFT.auto = false;
      if (n === 'vid' || n === 'when') { if (n === 'vid') { DRAFT.auto = true; DRAFT.fuelType = ''; } FORM_DIRTY = true; render(); }
    });
    DRAFT._onChange = () => {
      const v = veh(DRAFT.vid); const ts = parseDtLocal(DRAFT.when); const el = $('#fs-dup'); if (!v || !el || isNaN(ts)) return;
      el.innerHTML = dupHTML(fuelDuplicates(v.id, ts, intKm(DRAFT.km), numBR(DRAFT.liters)));
    };
    f.addEventListener('submit', e => {
      e.preventDefault();
      const D = DRAFT; const v = veh(D.vid); const errs = [];
      if (!v) return showErrors(['Escolha o veículo.']);
      const ts = parseDtLocal(D.when); const k = intKm(D.km); const l = numBR(D.liters); const t = numBR(D.total);
      if (isNaN(ts)) errs.push('Informe a data e a hora do abastecimento.'); else if (ts > nowTs() + 5 * MIN) errs.push('A data do abastecimento não pode ser no futuro.');
      if (!k) errs.push('Informe a quilometragem.');
      else if (!isNaN(ts)) { const ar = kmAround(v.id, ts); if (k < ar.prev) errs.push(`A quilometragem não pode ser menor que o registro anterior a essa data (${km(ar.prev)}).`); if (ar.next != null && k > ar.next) errs.push(`A quilometragem não pode ser maior que o registro seguinte a essa data (${km(ar.next)}).`); }
      if (!l || l <= 0) errs.push('Informe os litros.'); if (!t || t <= 0) errs.push('Informe o valor total.');
      if (!isNaN(ts) && k && l) {
        const dup = fuelDuplicates(v.id, ts, k, l);
        if (dup.same.length) errs.push('Este abastecimento já está registrado (mesmo veículo, quilometragem e litros). Não é preciso lançar de novo.');
        else if (dup.similar.length && !D.dupOk) errs.push('Há um abastecimento parecido nas 24 horas próximas. Confira e marque "É outro abastecimento" para continuar.');
      }
      if (errs.length) return showErrors(errs);
      const c = custodyAt(v.id, ts);
      const rec = { id: uid('fuel'), vehicleId: v.id, driverId: D.driverId || null, custodyId: c && c.driverId === D.driverId ? c.id : null, projectId: D.projectId || null, at: ts, km: k, liters: l, total: t, fuelType: D.fuelType, station: (D.station || '').trim(), receipt: D.photos.cupom || null, odoPhoto: D.photos.hodometro || null, notes: (D.notes || '').trim(), location: null, source: 'gestao', enteredBy: CUR.id };
      S.fuel.push(rec); if (k > (v.odometer || 0)) v.odometer = k; // no banco a quilometragem também sobe pelo próprio registro
      log('abastecimento', `Abastecimento lançado pela gestão (${CUR.name}): ${nf(l, 1)} L, ${money(t)}${rec.station ? ' em ' + rec.station : ''} · ${fmtDT(ts)}`, { vehicleId: v.id, driverId: rec.driverId });
      const m = fuelOutlier(rec);
      if (m && isManager()) notify('gestao', `Consumo fora do padrão no ${v.plate}: ${nf(m.kmL, 1)} km/l (${m.delta > 0 ? '+' : ''}${nf(m.delta, 0)}% da média).`, { level: 'warn', link: { page: 'abastecimento' } });
      FORM_DIRTY = false; save(); toast('Abastecimento lançado.'); go('abastecimento');
    });
  }
};
function dupHTML(dup) {
  if (dup.same.length) return `<div class="note bad">${ic('alert')}<div><b>Já registrado:</b><div class="small">${dup.same.map(fuelLine).join('<br>')}</div></div></div>`;
  if (dup.similar.length) return `<div class="note warn stack" style="gap:8px"><div><b>Abastecimento parecido nas 24 horas próximas:</b><div class="small">${dup.similar.map(fuelLine).join('<br>')}</div></div><label class="row small" style="gap:8px"><input type="checkbox" name="dupOk" ${DRAFT?.dupOk ? 'checked' : ''}> É outro abastecimento (não é o mesmo)</label></div>`;
  return '';
}

// exclusão de um abastecimento lançado em duplicidade (gestor de frota e administrador)
ACTIONS['fuel-del'] = a => {
  if (!isManager()) return;
  const f = byId(S.fuel, a.dataset.id); if (!f) return;
  openModal({
    title: 'Excluir abastecimento',
    body: `<p>${vehLink(f.vehicleId)} · ${fuelLine(f)}</p><p class="muted small">Use para remover um lançamento em duplicidade. A exclusão fica registrada no histórico do veículo.</p>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn danger" data-act="fuel-del-ok" data-id="${f.id}">${ic('trash')}Excluir</button>`
  });
};
ACTIONS['fuel-del-ok'] = a => {
  const f = byId(S.fuel, a.dataset.id); if (!f || !isManager()) return;
  S.fuel = S.fuel.filter(x => x.id !== f.id);
  log('abastecimento', `Abastecimento excluído por ${CUR.name}: ${nf(f.liters, 1)} L, ${money(f.total)} de ${fmtDT(f.at)}`, { vehicleId: f.vehicleId, driverId: f.driverId });
  save(); closeModal(); toast('Abastecimento excluído.'); render();
};
