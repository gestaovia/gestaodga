/* ===================== Oficinas credenciadas, manutenções (editar/excluir) e seguro do veículo ===================== */
const shopOf = id => byId(S.workshops || [], id);
const activeShops = () => (S.workshops || []).filter(w => w.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
const shopName = (id, fallback = '') => shopOf(id)?.name || fallback || '—';
const recShop = r => r.workshopId ? shopName(r.workshopId, r.shop) : (r.shop || '—');
function shopSelect(name, sel, item) {
  const list = activeShops(); const cur = sel && shopOf(sel) && shopOf(sel).active === false ? [shopOf(sel)] : [];
  const fits = w => !item || !(w.services || []).length || (w.services || []).includes(item);
  return `<select class="inp" name="${name}" id="${name}"><option value="">Selecione a oficina credenciada</option>${[...list.filter(fits), ...list.filter(w => !fits(w)), ...cur].map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)}${w.city ? ` · ${esc(w.city)}` : ''}${w.active === false ? ' (descredenciada)' : ''}</option>`).join('')}</select>`;
}
const noShopsNote = () => `<div class="note warn">${ic('wrench')}<div>Nenhuma oficina credenciada. Os veículos só podem ir para manutenção em oficinas cadastradas. ${isManager() ? '<button type="button" class="link" data-go="oficinas">Cadastrar oficina</button>' : ''}</div></div>`;
const shopOk = id => !!id && shopOf(id)?.active !== false && !!shopOf(id);

/* ---------- página Oficinas ---------- */
PAGES.oficinas = {
  title: 'Oficinas credenciadas',
  render({ f = 'ativas' }) {
    const M = isManager(); const all = (S.workshops || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const list = all.filter(w => f === 'todas' || (f === 'ativas' ? w.active !== false : w.active === false));
    const stats = id => { const rs = S.maintRecords.filter(r => r.workshopId === id); return { n: rs.length, cost: sum(rs, r => r.cost), last: rs.sort((a, b) => b.at - a.at)[0], now: S.vehicles.filter(v => v.maintenance && v.maintenanceWorkshopId === id) }; };
    const card = w => { const st = stats(w.id); return `<div class="vcard" style="cursor:default;gap:8px">
      <div class="h"><div><b>${esc(w.name)}</b><div class="model">${esc([w.city, w.cnpj ? 'CNPJ ' + cnpjFmt(w.cnpj) : ''].filter(Boolean).join(' · '))}</div></div>${w.active === false ? pill('Descredenciada') : pill('Credenciada', 'ok')}</div>
      <div class="small">${w.phone ? `<a href="tel:${esc(onlyDigits(w.phone))}">${ic('phone')} ${esc(w.phone)}</a>` : ''}${w.contact ? ` · ${esc(w.contact)}` : ''}</div>
      ${w.address ? `<div class="small muted">${esc(w.address)}</div>` : ''}
      ${(w.services || []).length ? `<div class="row" style="gap:4px">${w.services.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>` : '<div class="tiny muted">Todos os serviços</div>'}
      <div class="foot"><span class="small muted">${st.n} serviço(s) · ${money(st.cost)}${st.now.length ? ` · <b>${st.now.map(v => v.plate).join(', ')} na oficina</b>` : ''}</span>${M ? `<button class="btn sm" data-act="ws-edit" data-id="${w.id}">${ic('edit')}Editar</button>` : ''}</div></div>`; };
    const n = k => all.filter(w => k === 'todas' || (k === 'ativas' ? w.active !== false : w.active === false)).length;
    return `<div class="page-head"><div class="filters">${[['ativas', 'Credenciadas'], ['inativas', 'Descredenciadas'], ['todas', 'Todas']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-go="oficinas" data-f="${k}">${l}<span class="n">${n(k)}</span></button>`).join('')}</div>
      ${M ? `<button class="btn pri" data-act="ws-new">${ic('plus')}Cadastrar oficina</button>` : ''}</div>
      <div class="note">${ic('wrench')}<div>Os veículos só podem ser enviados para manutenção nas oficinas credenciadas desta lista. Se a oficina tiver serviços marcados, ela aparece primeiro para esses serviços.</div></div>
      <div class="cards" style="margin-top:12px">${list.map(card).join('') || empty('Nenhuma oficina neste filtro.')}</div>`;
  }
};
function wsForm(w = {}) {
  return `<form id="ws-form" class="form-grid">
    <label class="field full"><span>Nome da oficina</span><input class="inp" name="name" value="${esc(w.name || '')}"></label>
    <label class="field"><span>CNPJ</span><input class="inp num" name="cnpj" value="${esc(w.cnpj ? cnpjFmt(w.cnpj) : '')}" inputmode="numeric"></label>
    <label class="field"><span>Telefone</span><input class="inp" name="phone" value="${esc(w.phone || '')}" inputmode="tel"></label>
    <label class="field"><span>Contato (pessoa)</span><input class="inp" name="contact" value="${esc(w.contact || '')}"></label>
    <label class="field"><span>E-mail</span><input class="inp" name="email" type="email" value="${esc(w.email || '')}"></label>
    <label class="field full"><span>Endereço</span><input class="inp" name="address" value="${esc(w.address || '')}"></label>
    <label class="field"><span>Cidade</span><input class="inp" name="city" value="${esc(w.city || '')}"></label>
    <div class="field full"><span>Serviços credenciados <small class="muted">(nenhum marcado = todos)</small></span><div class="seg">${MAINT_ITEMS.map(i => `<label><input type="checkbox" name="sv" value="${i}" ${(w.services || []).includes(i) ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div></div>
    <p class="err full" id="ws-err"></p></form>`;
}
ACTIONS['ws-new'] = () => openModal({ title: 'Cadastrar oficina credenciada', wide: true, body: wsForm(), foot: '<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="ws-save">Salvar</button>' });
ACTIONS['ws-edit'] = a => { const w = shopOf(a.dataset.id); const used = S.maintRecords.some(r => r.workshopId === w.id) || S.vehicles.some(v => v.maintenanceWorkshopId === w.id);
  openModal({ title: `Editar ${w.name}`, wide: true, body: wsForm(w), foot: `${!used ? `<button class="btn danger" data-act="ws-del" data-id="${w.id}">Excluir</button>` : ''}<button class="btn ${w.active === false ? 'pri' : 'danger'}" data-act="ws-toggle" data-id="${w.id}">${w.active === false ? 'Credenciar de novo' : 'Descredenciar'}</button><button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="ws-save" data-id="${w.id}">Salvar</button>` }); };
ACTIONS['ws-save'] = a => {
  const f = $('#ws-form'); const d = formData(f); const err = t => $('#ws-err').textContent = t;
  if ((d.name || '').length < 2) return err('Informe o nome da oficina.');
  const cnpj = onlyDigits(d.cnpj || ''); if (cnpj && !cnpjValid(cnpj)) return err('CNPJ inválido.');
  if (cnpj && (S.workshops || []).some(w => w.cnpj === cnpj && w.id !== a.dataset.id)) return err('Já existe uma oficina com este CNPJ.');
  const vals = { name: d.name, cnpj: cnpj || null, phone: d.phone, contact: d.contact, email: d.email, address: d.address, city: d.city, services: $$('input[name=sv]:checked', f).map(x => x.value) };
  if (a.dataset.id) { Object.assign(shopOf(a.dataset.id), vals); log('cadastro', `Oficina ${d.name} atualizada por ${CUR.name}`, {}); }
  else { (S.workshops = S.workshops || []).push({ id: uid(), ...vals, active: true, createdAt: nowTs() }); log('cadastro', `Oficina ${d.name} credenciada por ${CUR.name}`, {}); }
  save(); closeModal(); toast('Oficina salva.'); render();
};
ACTIONS['ws-toggle'] = a => {
  const w = shopOf(a.dataset.id); const inShop = S.vehicles.filter(v => v.maintenance && v.maintenanceWorkshopId === w.id);
  if (w.active !== false && inShop.length) return toast(`Há veículo nesta oficina (${inShop.map(v => v.plate).join(', ')}). Registre a saída antes de descredenciar.`);
  w.active = w.active === false; log('cadastro', `Oficina ${w.name} ${w.active ? 'credenciada novamente' : 'descredenciada'} por ${CUR.name}`, {}); save(); closeModal(); render();
};
ACTIONS['ws-del'] = a => { const w = shopOf(a.dataset.id); S.workshops = S.workshops.filter(x => x !== w); log('cadastro', `Oficina ${w.name} excluída por ${CUR.name}`, {}); save(); closeModal(); toast('Oficina excluída.'); render(); };

/* ---------- manutenção em andamento: editar ou cancelar a entrada ---------- */
ACTIONS['mnt-entry-edit'] = a => {
  const v = veh(a.dataset.id);
  openModal({ title: `Manutenção em andamento · ${v.plate}`, body: `<form id="me-form" class="form-grid">
      <label class="field full"><span>Oficina credenciada</span>${shopSelect('workshopId', v.maintenanceWorkshopId)}</label>
      <label class="field full"><span>Motivo</span><input class="inp" name="note" value="${esc(v.maintenanceNote || '')}"></label>
      <label class="field"><span>Entrada em</span><input class="inp" type="date" name="since" value="${dateInput(v.maintenanceSince)}" max="${dateInput(nowTs())}"></label>
      <p class="err full" id="me-err"></p></form>`,
    foot: `<button class="btn danger" data-act="mnt-entry-cancel" data-id="${v.id}">Excluir entrada</button><button class="btn" data-act="modal-close">Voltar</button><button class="btn ok" data-act="mnt-entry-save" data-id="${v.id}">Salvar</button>` });
};
ACTIONS['mnt-entry-save'] = a => {
  const v = veh(a.dataset.id); const d = formData($('#me-form')); const err = t => $('#me-err').textContent = t;
  if (!shopOk(d.workshopId)) return err('Escolha uma oficina credenciada.');
  if ((d.note || '').length < 3) return err('Informe o motivo.');
  const since = parseDate(d.since); if (!since || since > nowTs()) return err('Data de entrada inválida.');
  const before = `${shopName(v.maintenanceWorkshopId, v.maintenanceNote)} · ${fmtDate(v.maintenanceSince)}`;
  v.maintenanceWorkshopId = d.workshopId; v.maintenanceNote = d.note; v.maintenanceSince = startOfDay(since) === startOfDay(v.maintenanceSince) ? v.maintenanceSince : since + 8 * 36e5;
  log('manutencao', `Dados da manutenção alterados por ${CUR.name}: ${before} → ${shopName(d.workshopId)} · ${fmtDate(v.maintenanceSince)} (${d.note})`, { vehicleId: v.id });
  save(); closeModal(); toast('Manutenção atualizada.'); render();
};
ACTIONS['mnt-entry-cancel'] = a => {
  const v = veh(a.dataset.id);
  openModal({ title: `Excluir entrada em manutenção · ${v.plate}`, body: `<p>Use quando a entrada foi registrada por engano. O veículo volta ao pátio, sem registro de serviço. O checklist de entrada continua no histórico.</p><label class="field"><span>Motivo</span><textarea class="inp" id="mc-why"></textarea></label><p class="err" id="mc-err"></p>`,
    foot: `<button class="btn" data-act="modal-close">Voltar</button><button class="btn danger" data-act="mnt-entry-cancel-ok" data-id="${v.id}">Excluir entrada</button>` });
};
ACTIONS['mnt-entry-cancel-ok'] = a => {
  const v = veh(a.dataset.id); const r = $('#mc-why').value.trim(); if (r.length < 5) return $('#mc-err').textContent = 'Informe o motivo.';
  log('manutencao', `Entrada em manutenção excluída por ${CUR.name} (${shopName(v.maintenanceWorkshopId, v.maintenanceNote)}, desde ${fmtDate(v.maintenanceSince)}): ${r}`, { vehicleId: v.id });
  v.maintenance = false; v.maintenanceSince = null; v.maintenanceNote = ''; v.maintenanceWorkshopId = null;
  save(); closeModal(); toast('Entrada excluída. Veículo no pátio.'); render();
};

/* ---------- serviços realizados: editar e excluir (o plano de manutenção acompanha) ---------- */
function maintRecordsTable(list, opts = {}) {
  const M = isManager();
  return tbl(['Data', ...(opts.noVeh ? [] : ['Veículo']), 'Serviços', 'Oficina', '>Km', '>Custo', ...(M ? [''] : [])], list.slice().sort((a, b) => b.at - a.at).map(r => `<tr><td class="nowrap">${fmtDate(r.at)}</td>${opts.noVeh ? '' : `<td>${vehLink(r.vehicleId)}</td>`}<td>${esc(r.items.join(', '))}${r.notes ? `<div class="small muted">${esc(r.notes)}</div>` : ''}</td><td>${esc(recShop(r))}</td><td class="r">${nf(r.km)}</td><td class="r">${money(r.cost)}</td>${M ? `<td class="r nowrap"><button class="btn sm" data-act="mr-edit" data-id="${r.id}">${ic('edit')}Editar</button></td>` : ''}</tr>`), 'Nenhum serviço registrado.');
}
function mrForm(r) {
  return `<form id="mr-form" class="form-grid">
    <label class="field"><span>Data</span><input class="inp" type="date" name="date" value="${dateInput(r.at)}" max="${dateInput(nowTs())}"></label>
    <label class="field"><span>Quilometragem</span><input class="inp num" name="km" inputmode="numeric" value="${r.km ?? ''}"></label>
    <div class="field full"><span>Serviços realizados</span><div class="seg">${[...new Set([...MAINT_ITEMS, ...r.items])].map(i => `<label><input type="checkbox" name="it" value="${esc(i)}" ${r.items.includes(i) ? 'checked' : ''}><span>${esc(i)}</span></label>`).join('')}</div></div>
    <label class="field"><span>Custo total (R$)</span><input class="inp num" name="cost" inputmode="decimal" value="${r.cost ? nf(r.cost, 2) : ''}"></label>
    <label class="field"><span>Oficina credenciada</span>${shopSelect('workshopId', r.workshopId)}</label>
    <label class="field full"><span>Observações</span><input class="inp" name="notes" value="${esc(r.notes || '')}"></label>
    ${!r.workshopId && r.shop ? `<p class="small muted full">Registro antigo: oficina informada como “${esc(r.shop)}”. Escolha a oficina credenciada correspondente.</p>` : ''}
    <p class="err full" id="mr-err"></p></form>`;
}
ACTIONS['mr-edit'] = a => {
  const r = byId(S.maintRecords, a.dataset.id); const v = veh(r.vehicleId);
  openModal({ title: `Manutenção · ${v.plate} · ${fmtDate(r.at)}`, wide: true, body: mrForm(r),
    foot: `<button class="btn danger" data-act="mr-del" data-id="${r.id}">Excluir</button><button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="mr-save" data-id="${r.id}">Salvar alterações</button>` });
};
// plano: itens cuja última troca veio deste registro voltam para o registro anterior do mesmo item
function planFromRecords(vid, item, skipId) {
  const prev = S.maintRecords.filter(x => x.vehicleId === vid && x.id !== skipId && x.items.includes(item)).sort((a, b) => b.at - a.at)[0];
  return prev ? { lastKm: prev.km, lastDate: startOfDay(prev.at) } : null;
}
const planIsFrom = (p, r) => p.lastKm === r.km && startOfDay(p.lastDate) === startOfDay(r.at);
ACTIONS['mr-save'] = a => {
  const r = byId(S.maintRecords, a.dataset.id); const v = veh(r.vehicleId); const f = $('#mr-form'); const d = formData(f); const err = t => $('#mr-err').textContent = t;
  const items = $$('input[name=it]:checked', f).map(x => x.value); const kmv = parseInt(onlyDigits(d.km), 10); const at = parseDate(d.date);
  if (!items.length) return err('Marque ao menos um serviço.'); if (!kmv) return err('Informe a quilometragem.'); if (!at || at > nowTs()) return err('Data inválida.');
  if (kmv > Math.max(v.odometer, r.km)) return err(`A quilometragem não pode passar do km atual do veículo (${nf(v.odometer)}).`);
  if (!shopOk(d.workshopId) && d.workshopId !== r.workshopId) return err('Escolha uma oficina credenciada.');
  if (!d.workshopId) return err('Escolha a oficina credenciada.');
  const cost = parseFloat(String(d.cost || '').replace(/\./g, '').replace(',', '.')) || 0;
  const old = { at: r.at, km: r.km, items: [...r.items], cost: r.cost, workshopId: r.workshopId, shop: r.shop, notes: r.notes || '' };
  const nat = startOfDay(at) === startOfDay(r.at) ? r.at : at + 12 * 36e5;
  // ajusta o plano: itens retirados voltam ao registro anterior; itens mantidos/novos passam a usar os novos valores
  S.plans.filter(p => p.vehicleId === v.id).forEach(p => {
    const was = old.items.includes(p.item) && planIsFrom(p, old); const now = items.includes(p.item);
    if (was && !now) { const b = planFromRecords(v.id, p.item, r.id) || r.planPrev?.[p.id]; if (b) Object.assign(p, b); }
    else if (now && (was || p.lastKm == null || kmv >= p.lastKm)) { p.lastKm = kmv; p.lastDate = startOfDay(nat); }
  });
  Object.assign(r, { at: nat, km: kmv, items, cost, workshopId: d.workshopId, shop: shopName(d.workshopId), notes: d.notes || '' });
  const ch = [['Data', fmtDate(old.at), fmtDate(r.at)], ['Km', nf(old.km), nf(r.km)], ['Serviços', old.items.join(', '), r.items.join(', ')], ['Custo', money(old.cost), money(r.cost)], ['Oficina', old.workshopId ? shopName(old.workshopId) : old.shop, shopName(r.workshopId)], ['Obs.', old.notes, r.notes]].filter(x => x[1] !== x[2]);
  if (!ch.length) { closeModal(); return; }
  log('manutencao', `Registro de manutenção alterado por ${CUR.name}: ${ch.map(([l, x, y]) => `${l} ${x || '—'} → ${y || '—'}`).join('; ')}`, { vehicleId: v.id, data: { recordId: r.id, before: old } });
  save(); closeModal(); toast('Manutenção atualizada.'); render();
};
ACTIONS['mr-del'] = a => {
  const r = byId(S.maintRecords, a.dataset.id);
  openModal({ title: 'Excluir registro de manutenção', body: `<p><b>${veh(r.vehicleId).plate}</b> · ${fmtDate(r.at)} · ${esc(r.items.join(', '))} · ${money(r.cost)}</p><p class="small muted">O plano de manutenção volta para a troca anterior destes itens. Uma cópia do registro fica no histórico do veículo.</p><label class="field"><span>Motivo da exclusão</span><textarea class="inp" id="mr-why"></textarea></label><p class="err" id="mr-err2"></p>`,
    foot: `<button class="btn" data-act="modal-close">Voltar</button><button class="btn danger" data-act="mr-del-ok" data-id="${r.id}">Excluir</button>` });
};
ACTIONS['mr-del-ok'] = a => {
  const r = byId(S.maintRecords, a.dataset.id); const why = $('#mr-why').value.trim(); if (why.length < 5) return $('#mr-err2').textContent = 'Informe o motivo.';
  S.plans.filter(p => p.vehicleId === r.vehicleId && r.items.includes(p.item) && planIsFrom(p, r)).forEach(p => { const b = planFromRecords(r.vehicleId, p.item, r.id) || r.planPrev?.[p.id]; if (b) Object.assign(p, b); });
  S.maintRecords = S.maintRecords.filter(x => x !== r);
  log('manutencao', `Registro de manutenção excluído por ${CUR.name} (${fmtDate(r.at)} · ${r.items.join(', ')} · ${money(r.cost)} · ${recShop(r)}): ${why}`, { vehicleId: r.vehicleId, data: { deleted: { ...r } } });
  save(); closeModal(); toast('Registro excluído.'); render();
};
// guarda a última troca anterior de cada item do plano (para desfazer ao excluir)
function planSnapshot(vid, items) { const o = {}; S.plans.filter(p => p.vehicleId === vid && items.includes(p.item)).forEach(p => { o[p.id] = { lastKm: p.lastKm, lastDate: p.lastDate }; }); return o; }

/* ===================== Seguro e contato de emergência ===================== */
const insOf = v => v?.insurance || null;
const telLink = (n, label, cls = '') => n ? `<a class="btn ${cls}" href="tel:${esc(onlyDigits(n))}" data-act="ins-call" data-l="${esc(label)}">${ic('phone')}${esc(label)}<span class="num" style="margin-left:6px;opacity:.85">${esc(n)}</span></a>` : '';
function insuranceItems(v) {
  const i = insOf(v); if (!i?.end) return [];
  return [{ kind: 'seguro', label: `Seguro${i.insurer ? ' ' + i.insurer : ''}`, due: i.end, ...dueLevel(i.end) }];
}
function insurancePanel(v) {
  const i = insOf(v); const M = isManager(); const crit = openIssues(v.id).some(x => x.severity === 'critica' || !x.canRun);
  const lvl = i?.end ? dueLevel(i.end) : null;
  return `<div class="panel ${crit ? 'ins-crit' : ''}"><div class="panel-h"><h3>Seguro e emergência</h3>${lvl ? `<span class="pill ${lvl.lvl === 'normal' ? 'ok' : M_LEVEL[lvl.lvl].c}">${lvl.days < 0 ? 'Vencido' : `até ${fmtDate(i.end)}`}</span>` : ''}</div><div class="panel-b stack" style="gap:10px">
    ${i && (i.insurer || i.assist) ? `<dl class="pairs"><div><dt>Seguradora</dt><dd>${esc(i.insurer || '—')}</dd></div><div><dt>Apólice</dt><dd class="num">${esc(i.policy || '—')}</dd></div><div><dt>Assistência 24h</dt><dd class="num">${esc(i.assist || '—')}</dd></div><div><dt>Contato de emergência</dt><dd>${esc(i.contactName || '—')}${i.contactPhone ? ` · <span class="num">${esc(i.contactPhone)}</span>` : ''}</dd></div></dl>` : `<div class="muted small">Seguro não cadastrado.</div>`}
    <div class="row">${i ? `<button class="btn ${crit ? 'danger' : ''}" data-go="seguro" data-vid="${v.id}">${ic('shield')}Acionar seguro</button>` : ''}${M ? `<button class="btn sm" data-act="ins-edit" data-id="${v.id}">${ic('edit')}${i ? 'Editar' : 'Cadastrar seguro'}</button>` : ''}</div></div></div>`;
}
function insForm(v) {
  const i = insOf(v) || {};
  return `<form id="ins-form" class="form-grid">
    <label class="field"><span>Seguradora</span><input class="inp" name="insurer" value="${esc(i.insurer || '')}"></label>
    <label class="field"><span>Nº da apólice</span><input class="inp" name="policy" value="${esc(i.policy || '')}"></label>
    <label class="field"><span>Início da vigência</span><input class="inp" type="date" name="start" value="${dateInput(i.start)}"></label>
    <label class="field"><span>Fim da vigência</span><input class="inp" type="date" name="end" value="${dateInput(i.end)}"></label>
    <label class="field"><span>Assistência 24h (guincho, pane)</span><input class="inp" name="assist" inputmode="tel" value="${esc(i.assist || '')}" placeholder="0800 ..."></label>
    <label class="field"><span>Telefone para sinistro</span><input class="inp" name="claim" inputmode="tel" value="${esc(i.claim || '')}"></label>
    <label class="field"><span>Corretor</span><input class="inp" name="broker" value="${esc(i.broker || '')}"></label>
    <label class="field"><span>Telefone do corretor</span><input class="inp" name="brokerPhone" inputmode="tel" value="${esc(i.brokerPhone || '')}"></label>
    <label class="field"><span>Franquia (R$)</span><input class="inp num" name="deductible" inputmode="decimal" value="${i.deductible ? nf(i.deductible, 2) : ''}"></label>
    <div class="full" style="border-top:1px solid var(--border2);padding-top:10px"><b class="small">Contato de emergência do veículo</b><div class="tiny muted">Quem o condutor deve avisar em caso de acidente, pane ou problema crítico.</div></div>
    <label class="field"><span>Nome</span><input class="inp" name="contactName" value="${esc(i.contactName || '')}"></label>
    <label class="field"><span>Telefone</span><input class="inp" name="contactPhone" inputmode="tel" value="${esc(i.contactPhone || '')}"></label>
    <label class="field full"><span>Orientações para o condutor</span><textarea class="inp" name="notes" placeholder="Ex.: informar placa e apólice; não mover o veículo após acidente">${esc(i.notes || '')}</textarea></label>
    <p class="err full" id="ins-err"></p></form>`;
}
ACTIONS['ins-edit'] = a => { const v = veh(a.dataset.id); openModal({ title: `Seguro e emergência · ${v.plate}`, wide: true, body: insForm(v), foot: `${insOf(v) ? `<button class="btn danger" data-act="ins-clear" data-id="${v.id}">Remover</button>` : ''}<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="ins-save" data-id="${v.id}">Salvar</button>` }); };
ACTIONS['ins-save'] = a => {
  const v = veh(a.dataset.id); const d = formData($('#ins-form')); const err = t => $('#ins-err').textContent = t;
  if (!d.insurer && !d.contactPhone) return err('Informe a seguradora ou, ao menos, o contato de emergência.');
  if (d.insurer && !d.assist && !d.claim) return err('Informe o telefone da assistência 24h ou de sinistro.');
  const s = parseDate(d.start), e = parseDate(d.end); if (s && e && e <= s) return err('O fim da vigência deve ser depois do início.');
  const tel = x => x && onlyDigits(x).length < 8 ? null : x; if ([d.assist, d.claim, d.contactPhone, d.brokerPhone].some(x => x && !tel(x))) return err('Confira os telefones (mínimo 8 dígitos).');
  v.insurance = { insurer: d.insurer, policy: d.policy, start: s, end: e, assist: d.assist, claim: d.claim, broker: d.broker, brokerPhone: d.brokerPhone, deductible: parseFloat(String(d.deductible || '').replace(/\./g, '').replace(',', '.')) || null, contactName: d.contactName, contactPhone: d.contactPhone, notes: d.notes };
  log('cadastro', `Seguro e contato de emergência atualizados por ${CUR.name}${d.insurer ? ` (${d.insurer}${d.policy ? ', apólice ' + d.policy : ''})` : ''}`, { vehicleId: v.id });
  save(); closeModal(); toast('Seguro salvo.'); render();
};
ACTIONS['ins-clear'] = a => { const v = veh(a.dataset.id); v.insurance = null; log('cadastro', `Dados do seguro removidos por ${CUR.name}`, { vehicleId: v.id }); save(); closeModal(); render(); };

/* ---------- acionar o seguro (condutor e gestão) ---------- */
PAGES.seguro = {
  driver: true, title: 'Acionar seguro',
  render({ vid }) {
    const d = myDriver(); vid = vid || (d && driverCustodies(d.id)[0]?.vehicleId); const v = vid && veh(vid);
    if (!v) return `<div class="drv"><h1>Acionar seguro</h1><div class="note">Nenhum veículo com você.</div></div>`;
    const i = insOf(v) || {}; const iss = openIssues(v.id).filter(x => x.severity === 'critica' || !x.canRun);
    const loc = currentLocation(v.id) || lastLocation(v.id);
    const wrap = CUR.role === 'condutor' ? 'drv' : 'drv" style="margin:0;max-width:640px';
    return `<div class="${wrap}">
      <div class="note bad">${ic('shield')}<div><b>Emergência com o ${esc(v.plate)}</b>${iss.length ? `<div class="small">${esc(iss[0].type)} — ${esc(iss[0].desc)}</div>` : ''}<div class="small">Se houver feridos, ligue primeiro para o SAMU (192) ou Bombeiros (193).</div></div></div>
      <div class="veh-card"><div class="top-line">${plate(v.plate, true)}<span class="muted small">${esc(v.brand)} ${esc(v.model)} · ${v.year || ''}</span></div>
        <dl class="kv"><dt>Seguradora</dt><dd>${esc(i.insurer || 'Não cadastrada')}</dd><dt>Apólice</dt><dd class="num">${esc(i.policy || '—')}</dd>${i.end ? `<dt>Vigência</dt><dd>até ${fmtDate(i.end)}${i.end < nowTs() ? ' <span class="pill bad">vencida</span>' : ''}</dd>` : ''}
        <dt>Local</dt><dd class="small">${loc ? `${nf(loc.lat, 5)}, ${nf(loc.lng, 5)} · ${esc(nearestPlace(loc))}` : 'Sem localização'}</dd></dl></div>
      <div class="stack ins-calls">
        ${telLink(i.assist, 'Assistência 24h', 'danger lg block')}${telLink(i.claim, 'Sinistro', 'lg block')}${telLink(i.contactPhone, i.contactName ? `Emergência: ${i.contactName}` : 'Contato de emergência', 'lg block')}${telLink(i.brokerPhone, i.broker ? `Corretor: ${i.broker}` : 'Corretor', 'lg block')}
        ${!i.assist && !i.claim && !i.contactPhone ? '<div class="note warn">Os telefones do seguro deste veículo não foram cadastrados. Avise a gestão da frota.</div>' : ''}
        <button class="btn lg block" data-act="ins-copy" data-vid="${v.id}">${ic('list')}Copiar dados para informar</button>
      </div>
      ${i.notes ? `<div class="note">${esc(i.notes)}</div>` : ''}
      <button class="btn" data-go="${CUR.role === 'condutor' ? 'inicio' : 'veiculo'}" data-id="${v.id}">Voltar</button>
    </div>`;
  }
};
ACTIONS['ins-call'] = a => {
  const vid = ROUTE.p.vid || (myDriver() && driverCustodies(myDriver().id)[0]?.vehicleId); const v = veh(vid); if (!v) return;
  const who = myDriver()?.name || CUR.name; const loc = currentLocation(v.id) || lastLocation(v.id);
  log('seguro', `Seguro acionado por ${who}: ${a.dataset.l}${loc ? ` · local ${nf(loc.lat, 5)}, ${nf(loc.lng, 5)}` : ''}`, { vehicleId: v.id, driverId: myDriver()?.id || activeCustody(v.id)?.driverId || null });
  notify('gestao', `${who} acionou ${a.dataset.l.toLowerCase()} do ${v.plate}.`, { level: 'bad', link: { page: 'veiculo', id: v.id } });
  save();
};
ACTIONS['ins-copy'] = async a => {
  const v = veh(a.dataset.vid); const i = insOf(v) || {}; const loc = currentLocation(v.id) || lastLocation(v.id);
  const txt = [`Veículo: ${v.plate} · ${v.brand} ${v.model} ${v.year || ''}`, i.insurer ? `Seguradora: ${i.insurer}` : '', i.policy ? `Apólice: ${i.policy}` : '', `Condutor: ${myDriver()?.name || drv(activeCustody(v.id)?.driverId)?.name || CUR.name}`, loc ? `Local: https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=17/${loc.lat}/${loc.lng}` : ''].filter(Boolean).join('\n');
  try { await navigator.clipboard.writeText(txt); toast('Dados copiados.'); } catch (e) { openModal({ title: 'Dados do veículo', body: `<pre style="white-space:pre-wrap">${esc(txt)}</pre>` }); }
};
