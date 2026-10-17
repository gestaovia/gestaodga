/* ===================== Correção de quilometragem pela gestão (v1.12.0) =====================
   Um km digitado errado (ex.: 150.000 em vez de 15.000) subia o hodômetro e ninguém conseguia baixar:
   o condutor seguinte não podia informar menos que o último registro e o calendário de manutenção
   ficava todo vencido. Agora o gestor de frota (ou o administrador) informa a quilometragem correta
   do painel e corrige, um a um, os registros que ficaram acima dela (checklists, abastecimentos,
   posses, plano e serviços de manutenção). O valor original fica guardado em kmFix, com quem, quando
   e o motivo; a correção vai para a linha do tempo do veículo. */
const KM_FIX_SRC = [
  // [coleção, rótulo, campo do km, filtro do veículo, descrição]
  ['checklists', 'Checklist', 'km', (r, v) => r.vehicleId === v.id, r => `${CK_TYPES[r.type] || 'Checklist'} · ${fmtShort(r.at)}${r.driverId && drv(r.driverId) ? ' · ' + drv(r.driverId).name : ''}`],
  ['fuel', 'Abastecimento', 'km', (r, v) => r.vehicleId === v.id, r => `Abastecimento · ${fmtShort(r.at)}${r.driverId && drv(r.driverId) ? ' · ' + drv(r.driverId).name : ''}`],
  ['custody', 'Posse', 'startKm', (r, v) => r.vehicleId === v.id, r => `Início da posse · ${fmtShort(r.start)}${drv(r.driverId) ? ' · ' + drv(r.driverId).name : ''}`],
  ['custody', 'Posse', 'endKm', (r, v) => r.vehicleId === v.id && r.end, r => `Fim da posse · ${fmtShort(r.end)}${drv(r.driverId) ? ' · ' + drv(r.driverId).name : ''}`],
  ['plans', 'Manutenção', 'lastKm', (r, v) => r.vehicleId === v.id, r => `Plano de manutenção · ${r.item} (última troca)`],
  ['maintRecords', 'Manutenção', 'km', (r, v) => r.vehicleId === v.id, r => `Serviço de manutenção · ${fmtShort(r.at)}`]
];
// registros do veículo com quilometragem acima de "ok"
function kmAbove(v, ok) {
  const out = [];
  KM_FIX_SRC.forEach(([key, lab, f, flt, desc], si) => (S[key] || []).forEach(r => { if (flt(r, v) && +r[f] > ok) out.push({ key, f, si, r, lab, desc: desc(r) }); }));
  return out.sort((a, b) => b.r[b.f] - a.r[a.f]);
}
let KMFIX = null;
ACTIONS['km-fix'] = a => {
  if (!isManager()) return toast('Somente o gestor de frota ou o administrador corrige a quilometragem.');
  const v = veh(a.dataset.id); if (!v) return;
  KMFIX = { vid: v.id, step: 1, km: '', reason: '' };
  kmFixModal();
};
function kmFixModal() {
  const v = veh(KMFIX.vid); const last = lastRecordedKm(v.id);
  if (KMFIX.step === 1) {
    openModal({ title: `Corrigir quilometragem · ${v.plate}`, body: `<p>Hodômetro no sistema: <b>${km(v.odometer)}</b>${last > v.odometer ? ` · maior registro: <b>${km(last)}</b>` : ''}.</p>
        <p class="small muted">Use quando alguém digitou a quilometragem errada. Informe o km que aparece hoje no painel do veículo; na próxima etapa você confere os registros que ficaram acima dele.</p>
        <form id="kf-form" class="form-grid"><label class="field"><span>Quilometragem correta (painel hoje)</span><input class="inp big num" name="km" inputmode="numeric" value="${esc(KMFIX.km)}"></label>
        <label class="field full"><span>Motivo</span><input class="inp" name="reason" value="${esc(KMFIX.reason)}" placeholder="Ex.: condutor digitou um zero a mais no checklist diário"></label><p class="err full" id="kf-err"></p></form>`,
      foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn pri" data-act="km-fix-next">Avançar</button>` });
    return;
  }
  const list = kmAbove(v, KMFIX.km);
  openModal({ title: `Corrigir quilometragem · ${v.plate}`, wide: true, body: `<p>Quilometragem correta: <b>${km(KMFIX.km)}</b> · motivo: ${esc(KMFIX.reason)}</p>
      ${list.length ? `<p class="small muted">${list.length} registro(s) ficaram acima deste km. Corrija cada um com o valor certo (veja a foto do painel no checklist, se houver). Nenhum pode passar de ${km(KMFIX.km)}.</p>
      <form id="kf-list" class="stack" style="gap:8px">${list.map((x, i) => `<div class="row" style="gap:10px;flex-wrap:nowrap;align-items:center"><div style="flex:1;min-width:0"><b class="small">${esc(x.desc)}</b><div class="tiny muted">registrado: ${km(x.r[x.f])}${x.key === 'checklists' && x.r.photos?.painel ? ' · tem foto do painel (aba Checklists do veículo)' : ''}</div></div><input class="inp num" style="max-width:130px" name="k${i}" inputmode="numeric" value="${x.r[x.f]}" aria-label="Km correto"></div>`).join('')}</form>`
      : '<p class="small muted">Nenhum registro ficou acima deste km: só o hodômetro do veículo será corrigido.</p>'}
      <p class="err" id="kf-err2"></p>`,
    foot: `<button class="btn" data-act="km-fix-back" style="margin-right:auto">Voltar</button><button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="km-fix-ok">Salvar correção</button>` });
}
ACTIONS['km-fix-next'] = () => {
  const d = formData($('#kf-form')); const k = parseInt(String(d.km || '').replace(/\D/g, ''), 10); const err = t => $('#kf-err').textContent = t;
  KMFIX.km = k || ''; KMFIX.reason = (d.reason || '').trim();
  if (!k) return err('Informe a quilometragem do painel.');
  if (KMFIX.reason.length < 5) return err('Informe o motivo (mínimo 5 caracteres).');
  const v = veh(KMFIX.vid); if (k >= v.odometer && k >= lastRecordedKm(v.id)) return err(`Para subir a quilometragem não é preciso corrigir: ela sobe sozinha no próximo registro.`);
  KMFIX.step = 2; kmFixModal();
};
ACTIONS['km-fix-back'] = () => { KMFIX.step = 1; kmFixModal(); };
ACTIONS['km-fix-ok'] = () => {
  const v = veh(KMFIX.vid); const ok = KMFIX.km; const list = kmAbove(v, ok); const err = t => $('#kf-err2').textContent = t;
  const d = list.length ? formData($('#kf-list')) : {};
  const vals = list.map((x, i) => parseInt(String(d['k' + i] || '').replace(/\D/g, ''), 10));
  const bad = vals.findIndex(n => !n || n > ok);
  if (bad >= 0) return err(`${list[bad].desc}: informe um km entre 1 e ${nf(ok)}.`);
  const at = nowTs(); const fix = (r, f, to) => { r.kmFix = [...(r.kmFix || []), { field: f, from: r[f], to, by: CUR.id, at, reason: KMFIX.reason }]; r[f] = to; };
  list.forEach((x, i) => fix(x.r, x.f, vals[i]));
  const from = v.odometer; v.kmFix = [...(v.kmFix || []), { field: 'odometer', from, to: ok, by: CUR.id, at, reason: KMFIX.reason }]; v.odometer = ok;
  if (S.locations[v.id]) S.locations[v.id].km = ok;
  log('km', `Quilometragem corrigida por ${CUR.name}: ${nf(from)} → ${nf(ok)} km${list.length ? ` · ${list.length} registro(s) ajustado(s)` : ''}. Motivo: ${KMFIX.reason}`, { vehicleId: v.id });
  KMFIX = null; save(); closeModal(); toast('Quilometragem corrigida.'); render();
};
