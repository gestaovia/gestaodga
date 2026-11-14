/* ===================== v1.20.0 · Edição de registros pelo administrador e atribuição de veículo =====================
   1) Editar abastecimento e checklist: muitos condutores digitam um km diferente do que aparece na foto do painel.
      O administrador abre o registro, vê a foto ao lado do campo e corrige (km e demais dados). Motivo obrigatório.
      O valor original fica em r.edits (e, para o km, também em r.kmFix, como na "Corrigir km"); a correção vai para a
      linha do tempo do veículo e o condutor recebe um aviso. Se o registro era o mais alto, o hodômetro acompanha.
      Recebimento/entrega: o km inicial/final da posse ligada ao checklist acompanha a correção.
   2) Atribuir veículo a um condutor (controle administrativo): quando alguém sai com o veículo sem fazer o checklist
      de recebimento, o administrador marca com quem ele está. Não cria posse, não conta na premiação e não bloqueia
      ninguém: termina sozinha quando qualquer condutor fizer o checklist de recebimento (ou o administrador remove).
      Fica em vehicles.extra.assign = { driverId, at, by, note }. */
const adminCtl = () => isAdmin(); // quem edita registros e atribui veículos (somente administrador)
const ckCanEdit = k => !!k && adminCtl();
const fuelCanEdit = f => !!f && adminCtl();
const EDIT_LABEL = { km: 'Km', liters: 'Litros', total: 'Valor', at: 'Data e hora', fuelType: 'Combustível', station: 'Posto', fuelLevel: 'Nível de combustível', notes: 'Observações', nbPurpose: 'Finalidade' };
const editVal = (f, x) => x == null || x === '' ? '—' : f === 'km' ? nf(x) + ' km' : f === 'liters' ? nf(x, 2) + ' L' : f === 'total' ? money(x) : f === 'at' ? fmtDT(x) : f === 'nbPurpose' ? nbPurposeTxt({ nbPurpose: x }) : String(x);
const editsHTML = list => (list || []).map(e => `${fmtShort(e.at)} · ${esc(userName(e.by))}: ${Object.entries(e.changes).map(([f, [a, b]]) => `${esc(EDIT_LABEL[f] || f)} ${esc(editVal(f, a))} → ${esc(editVal(f, b))}`).join('; ')}${e.reason ? ` <span class="muted">(${esc(e.reason)})</span>` : ''}`).join('<br>');
const editsTxt = ch => Object.entries(ch).map(([f, [a, b]]) => `${(EDIT_LABEL[f] || f).toLowerCase()} ${editVal(f, a)} → ${editVal(f, b)}`).join('; ');

// km anterior e seguinte a um horário, sem contar o próprio registro (e a posse ligada a ele)
function kmNeighbors(vid, ts, skip = () => false) {
  const pts = [
    ...S.checklists.filter(k => k.vehicleId === vid && k.km && !skip(k)).map(k => [k.at, +k.km]),
    ...S.fuel.filter(f => f.vehicleId === vid && !skip(f)).map(f => [f.at, +f.km]),
    ...S.custody.filter(c => c.vehicleId === vid).flatMap(c => [...(skip(c, 'startKm') ? [] : [[c.start, +c.startKm]]), ...(c.end && c.endKm && !skip(c, 'endKm') ? [[c.end, +c.endKm]] : [])])
  ].filter(p => p[1]);
  const b = pts.filter(p => p[0] < ts).map(p => p[1]); const a = pts.filter(p => p[0] > ts).map(p => p[1]);
  return { prev: b.length ? Math.max(...b) : 0, next: a.length ? Math.min(...a) : null };
}
// maior km entre os registros do veículo (sem o hodômetro)
function kmMaxRecords(vid) {
  const ks = [...S.checklists.filter(k => k.vehicleId === vid && k.km).map(k => +k.km), ...S.fuel.filter(f => f.vehicleId === vid).map(f => +f.km),
    ...S.custody.filter(c => c.vehicleId === vid).flatMap(c => [+c.startKm || 0, +c.endKm || 0]), ...(S.maintRecords || []).filter(r => r.vehicleId === vid).map(r => +r.km || 0)];
  return ks.length ? Math.max(...ks) : 0;
}
// hodômetro depois de corrigir o km de um registro: sobe se ficou maior; desce se o registro corrigido era o mais alto
function odoAfterEdit(v, from, to, reason) {
  const before = +v.odometer || 0; let next = before;
  if (to > before) next = to;
  else if (to < from && from >= before) next = Math.max(to, kmMaxRecords(v.id));
  if (next === before) return null;
  v.kmFix = [...(v.kmFix || []), { field: 'odometer', from: before, to: next, by: CUR.id, at: nowTs(), reason }]; v.odometer = next;
  if (S.locations[v.id]) S.locations[v.id].km = next;
  return [before, next];
}
const recPhotos = list => { const ok = list.filter(([, p]) => p && !String(p).startsWith('removida')); return ok.length ? `<div class="thumbs" style="margin:4px 0 2px">${ok.map(([l, p]) => `<img src="${esc(photoSrc(p, l))}" alt="${esc(l)}" title="${esc(l)} (toque para ampliar)" data-act="photo" style="width:150px;height:112px">`).join('')}</div>` : '<p class="small muted">Sem foto neste registro.</p>'; };
let RECEDIT = null; // { kind, id, kmConf }

/* ---------- editar checklist ---------- */
ACTIONS['ck-edit'] = a => {
  const k = byId(S.checklists, a.dataset.id); if (!ckCanEdit(k)) return toast('Somente o administrador edita checklists.');
  RECEDIT = { kind: 'ck', id: k.id, kmConf: null };
  const v = veh(k.vehicleId); const full = !!k.items || !!k.fuelLevel; const nbAsk = k.type === 'diario' && (k.nbPurpose || !isBizDay(k.at));
  const np = k.nbPurpose || {};
  openModal({ title: `Editar checklist ${CK_TYPES[k.type].toLowerCase()} · ${v.plate}`, wide: true,
    body: `<p>${esc(drv(k.driverId)?.name || userName(k.userId))} · ${fmtDT(k.at)}</p>
      <div><p class="label" style="margin-bottom:4px">Foto do painel</p>${recPhotos([['Painel com hodômetro', k.photos?.painel]])}</div>
      <form id="re-form" class="form-grid" novalidate>
        <label class="field"><span>Quilometragem</span><input class="inp big num" name="km" inputmode="numeric" value="${esc(k.km ?? '')}"><small>Registrado: ${km(k.km)}. Confira com a foto.</small></label>
        ${full ? `<label class="field"><span>Nível de combustível</span><select class="inp" name="fuelLevel"><option value="">—</option>${FUEL_LEVELS.map(f => `<option ${f === k.fuelLevel ? 'selected' : ''}>${f}</option>`).join('')}</select></label>` : ''}
        ${nbAsk ? `<label class="field"><span>Finalidade (dia não útil)</span><select class="inp" name="nbType"><option value="">—</option>${[...PURPOSES, 'Outra finalidade'].map(x => `<option ${x === np.type ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="field"><span>Descrição do uso</span><input class="inp" name="nbDesc" value="${esc(np.desc || '')}" maxlength="300"></label>` : ''}
        <label class="field full"><span>Observações</span><textarea class="inp" name="notes">${esc(k.notes || '')}</textarea></label>
        <label class="field full"><span>Motivo da edição</span><input class="inp" name="reason" placeholder="Ex.: km digitado diferente da foto do painel"></label>
        <p class="err full" id="re-err" role="alert"></p></form>
      ${k.edits?.length ? `<p class="small muted">Edições anteriores:<br>${editsHTML(k.edits)}</p>` : ''}`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="ck-edit-ok" data-id="${k.id}">Salvar edição</button>` });
};
ACTIONS['ck-edit-ok'] = a => {
  const k = byId(S.checklists, a.dataset.id); if (!ckCanEdit(k)) return;
  const d = formData($('#re-form')); const err = t => { $('#re-err').textContent = t; };
  const v = veh(k.vehicleId); const kmv = intKm(d.km); const reason = (d.reason || '').trim();
  if (!kmv) return err('Informe a quilometragem.');
  const ch = {};
  if (kmv !== +k.km) ch.km = [k.km ?? null, kmv];
  if ('fuelLevel' in d && (d.fuelLevel || '') !== (k.fuelLevel || '')) ch.fuelLevel = [k.fuelLevel || '', d.fuelLevel || ''];
  if ((d.notes || '') !== (k.notes || '')) ch.notes = [k.notes || '', d.notes || ''];
  if ('nbType' in d) { const np = { type: d.nbType || '', desc: (d.nbDesc || '').trim() }; const op = k.nbPurpose || { type: '', desc: '' }; if (np.type !== (op.type || '') || np.desc !== (op.desc || '')) ch.nbPurpose = [k.nbPurpose || null, np.type || np.desc ? np : null]; }
  if (!Object.keys(ch).length) return err('Nenhum dado foi alterado.');
  if (reason.length < 5) return err('Informe o motivo da edição (mínimo 5 caracteres).');
  // posse ligada ao checklist (recebimento → km inicial; entrega → km final)
  const cs = k.type === 'recebimento' ? S.custody.find(c => c.receiveChecklistId === k.id) : ['entrega', 'devolucao'].includes(k.type) ? S.custody.find(c => c.deliverChecklistId === k.id) : null;
  const cf = cs ? (cs.receiveChecklistId === k.id ? 'startKm' : 'endKm') : null;
  if (ch.km) {
    const nb = kmNeighbors(v.id, k.at, (r, f) => r === k || (r === cs && f === cf));
    const out = kmv < nb.prev || (nb.next != null && kmv > nb.next);
    if (out && RECEDIT?.kmConf !== kmv) { RECEDIT = { ...(RECEDIT || {}), kmConf: kmv }; return err(`Fora da sequência: o registro anterior tem ${km(nb.prev)}${nb.next != null ? ` e o seguinte ${km(nb.next)}` : ''}. Se algum deles também estiver errado, corrija-o depois. Toque em Salvar de novo para confirmar.`); }
  }
  const at = nowTs();
  if (ch.km) {
    k.kmFix = [...(k.kmFix || []), { field: 'km', from: k.km, to: kmv, by: CUR.id, at, reason }]; k.km = kmv;
    if (cs && cs[cf] !== kmv) { cs.kmFix = [...(cs.kmFix || []), { field: cf, from: cs[cf], to: kmv, by: CUR.id, at, reason }]; cs[cf] = kmv; }
  }
  if (ch.fuelLevel) k.fuelLevel = d.fuelLevel || null;
  if (ch.notes) k.notes = d.notes || '';
  if (ch.nbPurpose) k.nbPurpose = ch.nbPurpose[1];
  k.edits = [...(k.edits || []), { at, by: CUR.id, reason, changes: ch }];
  const odo = ch.km ? odoAfterEdit(v, ch.km[0] || 0, kmv, reason) : null;
  log(ch.km ? 'km' : 'checklist', `Checklist ${CK_TYPES[k.type].toLowerCase()} de ${fmtShort(k.at)} editado por ${CUR.name}: ${editsTxt(ch)}${odo ? ` · hodômetro ${nf(odo[0])} → ${nf(odo[1])} km` : ''}. Motivo: ${reason}`, { vehicleId: v.id, driverId: k.driverId, data: { checklistId: k.id } });
  if (k.driverId) notify(k.driverId, `A gestão corrigiu o seu checklist ${CK_TYPES[k.type].toLowerCase()} do ${v.plate} de ${fmtShort(k.at)}: ${editsTxt(ch)}.`, { link: { page: 'meus_checklists' } });
  RECEDIT = null; save(); toast('Checklist editado.'); showChecklist(k.id); render();
};

/* ---------- editar abastecimento ---------- */
ACTIONS['fuel-edit'] = a => {
  const f = byId(S.fuel, a.dataset.id); if (!fuelCanEdit(f)) return toast('Somente o administrador edita abastecimentos.');
  RECEDIT = { kind: 'fuel', id: f.id, kmConf: null };
  const v = veh(f.vehicleId);
  const types = [...new Set([...((v?.fuelType || '').startsWith('Diesel') ? ['Diesel S10', 'Diesel S500'] : ['Gasolina', 'Etanol']), f.fuelType].filter(Boolean))];
  openModal({ title: `Editar abastecimento · ${v.plate}`, wide: true,
    body: `<p>${esc(drv(f.driverId)?.name || 'Sem condutor')} · ${fuelByStaff(f) ? 'lançado pela gestão' : 'registrado pelo condutor'}${f.atManual ? ` · registrado depois (${fmtDT(f.registeredAt)})` : ''}</p>
      <div><p class="label" style="margin-bottom:4px">Fotos</p>${recPhotos([['Hodômetro', f.odoPhoto], ['Cupom', f.receipt]])}</div>
      <form id="re-form" class="form-grid" novalidate>
        <label class="field"><span>Data e hora</span><input class="inp" type="datetime-local" name="when" value="${dtLocal(f.at)}" max="${dtLocal(nowTs())}"></label>
        <label class="field"><span>Quilometragem</span><input class="inp big num" name="km" inputmode="numeric" value="${esc(f.km ?? '')}"><small>Registrado: ${km(f.km)}. Confira com a foto do hodômetro.</small></label>
        <label class="field"><span>Litros</span><input class="inp num" name="liters" inputmode="decimal" value="${esc(nf(f.liters, 2))}"></label>
        <label class="field"><span>Valor total (R$)</span><input class="inp num" name="total" inputmode="decimal" value="${esc(nf(f.total, 2))}"></label>
        <label class="field"><span>Combustível</span><select class="inp" name="fuelType">${types.map(t => `<option ${t === f.fuelType ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="field"><span>Posto</span><input class="inp" name="station" value="${esc(f.station || '')}"></label>
        <label class="field full"><span>Motivo da edição</span><input class="inp" name="reason" placeholder="Ex.: km digitado diferente da foto do hodômetro"></label>
        <p class="err full" id="re-err" role="alert"></p></form>
      ${f.edits?.length ? `<p class="small muted">Edições anteriores:<br>${editsHTML(f.edits)}</p>` : ''}`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="fuel-edit-ok" data-id="${f.id}">Salvar edição</button>` });
};
ACTIONS['fuel-edit-ok'] = a => {
  const f = byId(S.fuel, a.dataset.id); if (!fuelCanEdit(f)) return;
  const d = formData($('#re-form')); const err = t => { $('#re-err').textContent = t; };
  const v = veh(f.vehicleId); const reason = (d.reason || '').trim();
  const ts = parseDtLocal(d.when); const k = intKm(d.km); const l = numBR(d.liters); const t = numBR(d.total);
  if (isNaN(ts)) return err('Informe a data e a hora.');
  if (ts > nowTs() + 5 * MIN) return err('A data do abastecimento não pode ser no futuro.');
  if (!k) return err('Informe a quilometragem.');
  if (!l || l <= 0) return err('Informe os litros.');
  if (!t || t <= 0) return err('Informe o valor total.');
  const lim = fuelLimitErrs(l, t); if (lim.length) return err(lim.join(' '));
  const ch = {};
  // a data só muda se o minuto mudou (o campo não tem segundos)
  if (Math.floor(ts / MIN) !== Math.floor(f.at / MIN)) ch.at = [f.at, ts];
  if (k !== +f.km) ch.km = [f.km, k];
  if (Math.abs(l - f.liters) > 0.004) ch.liters = [f.liters, l];
  if (Math.abs(t - f.total) > 0.004) ch.total = [f.total, t];
  if ((d.fuelType || '') !== (f.fuelType || '')) ch.fuelType = [f.fuelType || '', d.fuelType || ''];
  if ((d.station || '') !== (f.station || '')) ch.station = [f.station || '', d.station || ''];
  if (!Object.keys(ch).length) return err('Nenhum dado foi alterado.');
  if (reason.length < 5) return err('Informe o motivo da edição (mínimo 5 caracteres).');
  const nts = ch.at ? ts : f.at;
  const dup = fuelDuplicates(v.id, nts, k, l, f.id);
  if (dup.same.length) return err('Já existe um abastecimento igual (mesmo veículo, km e litros em até 24 h). Confira os dados.');
  if (ch.km || ch.at) {
    const nb = kmNeighbors(v.id, nts, r => r === f);
    const out = k < nb.prev || (nb.next != null && k > nb.next); const key = `${k}|${nts}`;
    if (out && RECEDIT?.kmConf !== key) { RECEDIT = { ...(RECEDIT || {}), kmConf: key }; return err(`Fora da sequência: o registro anterior a esse horário tem ${km(nb.prev)}${nb.next != null ? ` e o seguinte ${km(nb.next)}` : ''}. Se algum deles também estiver errado, corrija-o depois. Toque em Salvar de novo para confirmar.`); }
  }
  const at = nowTs();
  if (ch.km) f.kmFix = [...(f.kmFix || []), { field: 'km', from: f.km, to: k, by: CUR.id, at, reason }];
  f.km = k; f.liters = l; f.total = t; f.fuelType = d.fuelType || f.fuelType; f.station = (d.station || '').trim();
  if (ch.at) {
    f.at = ts;
    const c2 = custodyAt(v.id, ts); // a obra acompanha a posse no novo horário
    if (c2 && (!f.driverId || c2.driverId === f.driverId)) { f.custodyId = c2.id; f.projectId = segmentAt(c2, ts)?.projectId || f.projectId; }
  }
  f.edits = [...(f.edits || []), { at, by: CUR.id, reason, changes: ch }];
  const odo = ch.km ? odoAfterEdit(v, ch.km[0] || 0, k, reason) : null;
  log(ch.km ? 'km' : 'abastecimento', `Abastecimento de ${fmtShort(ch.at ? ch.at[0] : f.at)} editado por ${CUR.name}: ${editsTxt(ch)}${odo ? ` · hodômetro ${nf(odo[0])} → ${nf(odo[1])} km` : ''}. Motivo: ${reason}`, { vehicleId: v.id, driverId: f.driverId });
  if (f.driverId && !fuelByStaff(f)) notify(f.driverId, `A gestão corrigiu o seu abastecimento do ${v.plate} de ${fmtShort(f.at)}: ${editsTxt(ch)}.`, { link: { page: 'inicio' } });
  RECEDIT = null; save(); closeModal(); toast('Abastecimento editado.'); render();
};

/* ---------- atribuição administrativa do veículo ---------- */
// vale enquanto ninguém fez o checklist de recebimento depois dela
const vAssign = v => { const a = v?.assign; if (!a || !a.driverId || !v.active || v.maintenance || activeCustody(v.id)) return null; if (S.custody.some(c => c.vehicleId === v.id && c.start >= a.at)) return null; return a; };
const driverAssigned = did => S.vehicles.filter(v => vAssign(v)?.driverId === did);
const assignLine = a => `Atribuído por ${esc(userName(a.by))} em ${fmtDT(a.at)}${a.note ? ` · ${esc(a.note)}` : ''}`;
function assignPanel(v) {
  const a = vAssign(v); const M = adminCtl();
  if (a) return `<div class="person" style="margin-bottom:10px">${av(drv(a.driverId), 'lg')}<div><b>${drvLink(a.driverId)}</b><small>Atribuído · sem checklist de recebimento</small></div></div>
    <div class="note warn" style="margin:0">${ic('user')}<div><b>Controle administrativo.</b> ${assignLine(a)}.<br><span class="small">A posse começa quando ele fizer o checklist de recebimento (ou outro condutor receber o veículo). Não conta na premiação.</span></div></div>
    ${M ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="veh-assign" data-id="${v.id}">${ic('swap')}Trocar condutor</button><button class="btn sm danger" data-act="veh-unassign" data-id="${v.id}">Remover atribuição</button></div>` : ''}`;
  return M && !v.maintenance && v.active ? `<div style="margin-top:10px;text-align:center"><button class="btn sm" data-act="veh-assign" data-id="${v.id}" title="Marcar com quem o veículo está, quando o condutor não fez o checklist">${ic('user')}Atribuir a um condutor</button></div>` : '';
}
ACTIONS['veh-assign'] = a => {
  if (!adminCtl()) return toast('Somente o administrador atribui veículos.');
  const v = veh(a.dataset.id); if (!v) return;
  if (activeCustody(v.id)) return toast('O veículo já está com um condutor (posse ativa).');
  if (v.maintenance) return toast('O veículo está em manutenção.');
  const cur = vAssign(v);
  const ds = S.drivers.filter(d => driverActive(d)).sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
  openModal({ title: `Atribuir veículo · ${v.plate}`,
    body: `<p class="small muted">Use quando o condutor saiu com o veículo sem fazer o checklist de recebimento. É só um controle administrativo: não inicia a posse e não conta na premiação. O condutor recebe um aviso para fazer o checklist; quando ele fizer, a atribuição termina sozinha.</p>
      <form id="as-form" class="form-grid" novalidate>
        <label class="field full"><span>Condutor que está com o veículo</span><select class="inp" name="driverId" id="as-drv"><option value="">Selecione o condutor</option>${ds.map(d => `<option value="${d.id}" ${d.id === cur?.driverId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select><small id="as-warn"></small></label>
        <label class="field full"><span>Observação (opcional)</span><input class="inp" name="note" maxlength="200" value="${esc(cur?.note || '')}" placeholder="Ex.: saiu cedo para a obra sem fazer o checklist"></label>
        <p class="err full" id="as-err" role="alert"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="veh-assign-ok" data-id="${v.id}">Atribuir</button>`,
    onMount: el => { const s = el.querySelector('#as-drv'); const w = el.querySelector('#as-warn'); const upd = () => { const did = s.value; const cs = did ? driverCustodies(did) : []; const as = did ? driverAssigned(did).filter(x => x.id !== v.id) : []; w.textContent = cs.length ? `Atenção: este condutor está com o ${veh(cs[0].vehicleId)?.plate} (posse ativa).` : as.length ? `Atenção: o ${as[0].plate} também está atribuído a ele.` : ''; }; s.addEventListener('change', upd); upd(); } });
};
ACTIONS['veh-assign-ok'] = a => {
  const v = veh(a.dataset.id); if (!v || !adminCtl()) return;
  const d = formData($('#as-form')); const err = t => { $('#as-err').textContent = t; };
  if (!d.driverId) return err('Selecione o condutor.');
  if (activeCustody(v.id)) return err('O veículo já está com um condutor (posse ativa).');
  const prev = vAssign(v); if (prev && prev.driverId === d.driverId && (prev.note || '') === (d.note || '')) return err('Nada foi alterado.');
  v.assign = { driverId: d.driverId, at: nowTs(), by: CUR.id, note: (d.note || '').trim() };
  log('atribuicao', `Veículo atribuído a ${drv(d.driverId).name} por ${CUR.name} (controle administrativo, sem checklist)${prev && prev.driverId !== d.driverId ? `; antes estava atribuído a ${drv(prev.driverId)?.name || '—'}` : ''}${v.assign.note ? `. Obs.: ${v.assign.note}` : ''}`, { vehicleId: v.id, driverId: d.driverId });
  if (!prev || prev.driverId !== d.driverId) notify(d.driverId, `A gestão registrou que o veículo ${v.plate} está com você. Faça o checklist de recebimento (escaneie o QR Code do carro) assim que possível.`, { level: 'warn', link: { page: 'scanner' } });
  save(); closeModal(); toast(`${v.plate} atribuído a ${drv(d.driverId).name}.`); render();
};
ACTIONS['veh-unassign'] = a => {
  const v = veh(a.dataset.id); const as = vAssign(v); if (!as || !adminCtl()) return;
  openModal({ title: `Remover atribuição · ${v.plate}`, body: `<p>O veículo deixa de constar com <b>${esc(drv(as.driverId)?.name || '')}</b> e volta para o pátio.</p><label class="field"><span>Motivo (opcional)</span><input class="inp" id="ua-why" maxlength="200" placeholder="Ex.: veículo devolvido ao pátio"></label>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn danger" data-act="veh-unassign-ok" data-id="${v.id}">Remover</button>` });
};
ACTIONS['veh-unassign-ok'] = a => {
  const v = veh(a.dataset.id); const as = vAssign(v); if (!as || !adminCtl()) return;
  const why = ($('#ua-why')?.value || '').trim();
  v.assign = null;
  log('atribuicao', `Atribuição a ${drv(as.driverId)?.name || '—'} removida por ${CUR.name}${why ? `. Motivo: ${why}` : ''}`, { vehicleId: v.id, driverId: as.driverId });
  save(); closeModal(); toast('Atribuição removida.'); render();
};
// lista "Atenção necessária"
const assignAttention = () => S.vehicles.filter(v => v.active && vAssign(v)).map(v => { const a = vAssign(v); return { c: 'warn', r: 3, icon: 'user', title: `${v.plate} atribuído sem checklist`, sub: `${drv(a.driverId)?.name || '—'} · desde ${fmtShort(a.at)}`, text: `Veículo ${v.plate} atribuído a ${drv(a.driverId)?.name || ''} sem checklist de recebimento.`, at: a.at, go: { page: 'veiculo', id: v.id } }; });
