/* ===================== Correção da obra pela gestão =====================
   O condutor informa a obra no recebimento e em "Trocar obra". Se ele escolheu errado, o gestor de frota
   (ou o administrador) corrige a obra de cada trecho da posse. A correção:
   - troca a obra do trecho (o original fica guardado em segment.fix, com quem corrigiu, quando e o motivo);
   - leva junto os checklists e abastecimentos daquela posse/trecho que estavam com a obra errada;
   - recalcula sozinha custos, pedágios, multas e indicadores por obra (todos usam a obra da posse no horário);
   - fica na linha do tempo do veículo e o condutor recebe um aviso. */
const obraOpts = sel => S.projects.filter(p => p.active || p.id === sel).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.code)} – ${esc(p.name)}${p.active ? '' : ' (inativa)'}</option>`).join('');
// célula "Obras" das listas de posses (com botão Corrigir para a gestão)
function custObras(x) {
  const fixed = x.segments.some(s => s.fix?.length);
  const list = [...new Set(x.segments.map(s => prj(s.projectId)?.code || '—'))].join(', ');
  return `<div class="row" style="gap:6px;flex-wrap:nowrap">${list ? esc(list) : pill('Sem obra', 'urg')}${fixed ? ` <span class="pill" title="Obra corrigida pela gestão">corrigida</span>` : ''}${isManager() ? `<button class="btn sm" data-act="obra-fix" data-id="${x.id}" title="Corrigir a obra informada pelo condutor">${ic('edit')}Corrigir</button>` : ''}</div>`;
}
const segRange = (c, i) => { const s = c.segments; return [i === 0 ? -Infinity : s[i].at, s[i + 1] ? s[i + 1].at : (c.end ? c.end + 6 * 36e5 : Infinity)]; };
ACTIONS['obra-fix'] = a => {
  if (!isManager()) return toast('Somente o gestor de frota ou o administrador corrige a obra.');
  const c = byId(S.custody, a.dataset.id); if (!c) return;
  const v = veh(c.vehicleId); const segs = c.segments;
  const rows = segs.length ? segs.map((s, i) => { const [, b] = segRange(c, i); return `<div class="field full"><span>${i === 0 ? 'Desde o recebimento' : 'Troca em'} ${fmtShort(i === 0 ? Math.min(s.at, c.start) : s.at)}${isFinite(b) && segs[i + 1] ? ` até ${fmtShort(b)}` : c.end ? ` até a entrega (${fmtShort(c.end)})` : ' até agora'}${s.purpose ? ` · ${esc(s.purpose)}` : ''}</span>
      <select class="inp" name="s${i}">${obraOpts(s.projectId)}</select>${s.fix?.length ? `<small>Corrigida antes: ${s.fix.map(f => `${esc(prj(f.from)?.code || 'sem obra')} → ${esc(prj(f.to)?.code || '—')} em ${fmtShort(f.at)} por ${esc(userName(f.by))}`).join('; ')}</small>` : ''}</div>`; }).join('')
    : `<label class="field full"><span>Obra da posse (desde ${fmtShort(c.start)})</span><select class="inp" name="s0"><option value="">Selecione</option>${obraOpts('')}</select></label>`;
  openModal({ title: 'Corrigir obra da posse', body: `<p>${plate(v.plate)} · <b>${esc(drv(c.driverId)?.name || '—')}</b> · ${fmtShort(c.start)} a ${c.end ? fmtShort(c.end) : 'agora'}</p>
      <p class="small muted">Use quando o condutor informou a obra errada. Checklists e abastecimentos desta posse vão junto para a obra corrigida; custos, pedágios e multas por obra são recalculados.</p>
      <form id="of-form" class="form-grid">${rows}<label class="field full"><span>Motivo da correção</span><textarea class="inp" name="reason" placeholder="Ex.: condutor selecionou a obra anterior por engano"></textarea></label><p class="err full" id="of-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="obra-fix-ok" data-id="${c.id}">Salvar correção</button>` });
};
function fixCustodyProject(c, i, to, reason) {
  // troca a obra do trecho i da posse c e leva junto checklists/abastecimentos do trecho que estavam com a obra antiga
  if (!c.segments.length) c.segments.push({ at: c.start, projectId: null, ccId: null, purpose: '', by: CUR.id });
  const s = c.segments[i]; const from = s.projectId || null; if (from === to) return 0;
  const [a, b] = segRange(c, i); const inSeg = r => r.at >= a && r.at < b && (r.projectId || null) === from;
  s.fix = [...(s.fix || []), { from, to, by: CUR.id, at: nowTs(), reason }]; s.projectId = to;
  let n = 0;
  S.checklists.filter(k => (k.custodyId === c.id || (k.vehicleId === c.vehicleId && k.driverId === c.driverId && k.at >= c.start - 36e5 && (!c.end || k.at <= c.end + 36e5))) && inSeg(k)).forEach(k => { k.projectId = to; n++; });
  S.fuel.filter(f => (f.custodyId === c.id || (f.vehicleId === c.vehicleId && f.at >= c.start && (!c.end || f.at <= c.end))) && inSeg(f)).forEach(f => { f.projectId = to; n++; });
  return n;
}
ACTIONS['obra-fix-ok'] = a => {
  const c = byId(S.custody, a.dataset.id); const d = formData($('#of-form')); const err = t => $('#of-err').textContent = t;
  const n0 = Math.max(1, c.segments.length); const ch = [];
  for (let i = 0; i < n0; i++) { const to = d['s' + i] || null; const from = c.segments[i]?.projectId || null; if (to && to !== from) ch.push({ i, from, to }); }
  if (!ch.length) return err('Nenhuma obra foi alterada.');
  if ((d.reason || '').length < 5) return err('Informe o motivo da correção (mínimo 5 caracteres).');
  let moved = 0; ch.forEach(x => { moved += fixCustodyProject(c, x.i, x.to, d.reason); });
  const v = veh(c.vehicleId); const txt = ch.map(x => `${prj(x.from)?.code || 'sem obra'} → ${prj(x.to).code}`).join('; ');
  log('obra', `Obra corrigida por ${CUR.name} na posse de ${drv(c.driverId)?.name || ''} (${fmtShort(c.start)}): ${txt}${moved ? ` · ${moved} registro(s) ajustado(s)` : ''}. Motivo: ${d.reason}`, { vehicleId: c.vehicleId, driverId: c.driverId });
  if (c.driverId) notify(c.driverId, `A gestão corrigiu a obra do ${v.plate}: ${txt}.`, { link: { page: 'inicio' } });
  save(); closeModal(); toast('Obra corrigida.'); render();
};
