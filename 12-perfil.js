/* ===================== Meu perfil, organização, histórico de checklists e manutenção direta ===================== */

/* ---------- imagens pequenas (foto de perfil e logo) ---------- */
function squareImage(file, size = 256, type = 'image/jpeg') {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('Escolha uma imagem (JPG ou PNG).'));
    const fr = new FileReader(); fr.onerror = () => rej(new Error('Não foi possível ler a imagem.'));
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); const x = c.getContext('2d');
        if (type === 'image/png') { // logo: mantém proporção e transparência
          const sc = Math.min(1, size / Math.max(im.width, im.height)); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
          x.drawImage(im, 0, 0, c.width, c.height); return res(c.toDataURL('image/png'));
        }
        const s = Math.min(im.width, im.height); c.width = c.height = size; // foto: recorte quadrado no centro
        x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
        res(c.toDataURL('image/jpeg', .82));
      };
      im.onerror = () => rej(new Error('Formato de imagem não suportado.')); im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- Meu perfil (todos os usuários, inclusive no celular) ---------- */
let PROFILE_DRAFT = null;
PAGES.perfil = {
  title: 'Meu perfil', driver: true,
  render() {
    const ph = PROFILE_DRAFT?.avatar !== undefined ? PROFILE_DRAFT.avatar : CUR.avatar;
    const me = { ...CUR, avatar: ph };
    const wrap = CUR.role === 'condutor' ? 'drv' : '" style="max-width:560px';
    return `<div class="${wrap}">
      <div class="panel"><div class="panel-b stack" style="gap:16px;padding-top:18px">
        <div class="row" style="gap:16px;flex-wrap:nowrap">${av(me, 'xl')}<div style="min-width:0"><b style="font-size:1.1rem">${esc(CUR.name)}</b><div class="muted small">${esc(CUR.email || '')}</div><div class="small">${roleLabel(CUR)}</div></div></div>
        <form id="prof-form" class="stack" style="gap:12px">
          <div class="row" style="gap:8px">
            <label class="btn" style="position:relative;overflow:hidden">${ic('camera')}${ph ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" id="prof-photo" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
            ${ph ? '<button type="button" class="btn danger" data-act="prof-photo-del">Remover foto</button>' : ''}
          </div>
          <label class="field"><span>Nome</span><input class="inp" name="name" value="${esc(PROFILE_DRAFT?.name ?? CUR.name)}" maxlength="80" autocomplete="name"></label>
          <p class="err" id="prof-err"></p>
          <button class="btn ok lg">Salvar perfil</button>
        </form>
      </div></div>
      <div class="panel"><div class="panel-b row" style="justify-content:space-between;padding-top:16px"><div><b>Senha</b><div class="small muted">Troque a senha de acesso a qualquer momento.</div></div><button class="btn" data-go="senha">${ic('key')}Alterar senha</button></div></div>
    </div>`;
  },
  mount() {
    const f = $('#prof-form'); if (!f) return;
    f.querySelector('[name=name]').addEventListener('input', e => { PROFILE_DRAFT = { ...(PROFILE_DRAFT || {}), name: e.target.value }; });
    $('#prof-photo').addEventListener('change', async e => {
      try { const img = await squareImage(e.target.files[0], 256); PROFILE_DRAFT = { ...(PROFILE_DRAFT || {}), avatar: img }; render(); }
      catch (x) { $('#prof-err').textContent = x.message; }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault(); const name = f.querySelector('[name=name]').value.trim(); const err = t => $('#prof-err').textContent = t;
      if (name.split(' ').filter(Boolean).length < 2) return err('Informe nome e sobrenome.');
      const btn = f.querySelector('.btn.ok'); btn.disabled = true;
      const d = PROFILE_DRAFT || {};
      try {
        await CLOUD.flush();
        const r = await CLOUD.rpc('update_my_profile', { p_name: name, p_avatar: d.avatar || null, p_clear_avatar: d.avatar === null });
        PROFILE_DRAFT = null; CUR.name = r.name; CUR.avatar = r.avatar || null;
        await CLOUD.reload(true); toast('Perfil salvo.'); render();
      } catch (x) { btn.disabled = false; err(friendlyError(x)); }
    });
  }
};
ACTIONS['prof-photo-del'] = () => { PROFILE_DRAFT = { ...(PROFILE_DRAFT || {}), avatar: null }; render(); };

/* ---------- Organização (administrador) ---------- */
const onlyDigits = s => String(s || '').replace(/\D/g, '');
function cnpjValid(c) {
  c = onlyDigits(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +c[12] && calc(13) === +c[13];
}
const cnpjFmt = c => { c = onlyDigits(c); return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c; };
let ORG_LOGO_DRAFT;
function orgSettings() {
  const o = orgOf(); const logo = ORG_LOGO_DRAFT !== undefined ? ORG_LOGO_DRAFT : o.logo;
  return `<form id="org-form" class="panel-b form-grid" style="padding-top:14px">
    <div class="field full"><span>Logo da empresa</span><div class="row" style="gap:12px">
      ${orgLogoOk(logo) ? `<img src="${logo}" alt="" style="width:72px;height:72px;object-fit:contain;background:#fff;border:1px solid var(--border);border-radius:6px">` : '<div class="muted small" style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:6px">sem logo</div>'}
      <label class="btn" style="position:relative;overflow:hidden">${ic('camera')}Enviar logo<input type="file" accept="image/png,image/jpeg,image/webp" id="org-logo" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
      ${orgLogoOk(logo) ? '<button type="button" class="btn danger" data-act="org-logo-del">Remover</button>' : ''}</div>
      <small>PNG com fundo transparente fica melhor. Aparece no menu, no aplicativo do condutor e no PDF dos checklists.</small></div>
    <label class="field"><span>Razão social</span><input class="inp" name="name" value="${esc(o.name || '')}" maxlength="120"></label>
    <label class="field"><span>Nome personalizado (aparece no sistema)</span><input class="inp" name="displayName" value="${esc(o.displayName || '')}" maxlength="40" placeholder="Ex.: Frota DGA"></label>
    <label class="field"><span>CNPJ</span><input class="inp mono" name="cnpj" value="${esc(cnpjFmt(o.cnpj || ''))}" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"></label>
    <p class="err full" id="org-err"></p>
    <div class="full"><button class="btn ok">Salvar organização</button></div>
  </form>`;
}
function mountOrgSettings() {
  const f = $('#org-form'); if (!f) return;
  $('#org-logo').addEventListener('change', async e => {
    try { const img = await squareImage(e.target.files[0], 320, 'image/png'); if (img.length > 350000) throw new Error('Logo muito grande. Use uma imagem menor.'); ORG_LOGO_DRAFT = img; render(); }
    catch (x) { $('#org-err').textContent = x.message; }
  });
  f.addEventListener('submit', e => {
    e.preventDefault(); const d = formData(f); const err = t => $('#org-err').textContent = t;
    if (d.cnpj && !cnpjValid(d.cnpj)) return err('CNPJ inválido. Confira os números.');
    const o = S.settings.org = { ...(S.settings.org || {}) };
    Object.assign(o, { name: d.name, displayName: d.displayName, cnpj: onlyDigits(d.cnpj) });
    if (ORG_LOGO_DRAFT !== undefined) o.logo = ORG_LOGO_DRAFT || null;
    ORG_LOGO_DRAFT = undefined;
    log('config', `Dados da organização atualizados por ${CUR.name}`, {}); save(); toast('Organização salva.'); render();
  });
}
ACTIONS['org-logo-del'] = () => { ORG_LOGO_DRAFT = null; render(); };

/* ---------- Condutor: histórico de todos os checklists que fez ---------- */
PAGES.meus_checklists = {
  title: 'Meus checklists', driver: true,
  render({ f = '' }) {
    const d = myDriver(); if (!d) return '<div class="drv"><p>Usuário sem cadastro de condutor.</p></div>';
    const all = S.checklists.filter(k => k.driverId === d.id).sort((a, b) => b.at - a.at);
    const list = f ? all.filter(k => k.type === f) : all;
    const types = [...new Set(all.map(k => k.type))];
    const byCus = {}; list.forEach(k => { (byCus[k.custodyId || '_'] = byCus[k.custodyId || '_'] || []).push(k); });
    const groups = Object.entries(byCus).map(([cid, ks]) => {
      const c = byId(S.custody, cid); const v = veh(ks[0].vehicleId);
      return `<div class="panel"><div class="panel-h"><h3>${v ? plate(v.plate) : '—'}</h3><span class="muted small">${c ? `Posse de ${fmtDate(c.start)} ${c.end ? `a ${fmtDate(c.end)}` : '· atual'}` : 'Sem posse vinculada'}</span></div>
        <div class="vlist">${ks.map(k => `<div class="vrow" data-act="ck-view" data-id="${k.id}" style="grid-template-columns:auto 1fr auto;cursor:pointer"><span class="dot ${k.ok ? 'ok' : k.problem ? 'bad' : 'warn'}"></span><div class="who2"><b>${CK_TYPES[k.type]}</b><small>${fmtDT(k.at)} · ${km(k.km)}${k.late ? ' · fora do prazo' : ''}</small></div>${ic('chev')}</div>`).join('')}</div></div>`;
    }).join('');
    return `<div class="drv">
      <div><h1>Meus checklists</h1><p class="muted">${all.length} registro(s) em todas as posses. Toque para ver as fotos e gerar o PDF.</p></div>
      ${types.length > 1 ? `<div class="filters"><button class="chip ${!f ? 'on' : ''}" data-go="meus_checklists">Todos</button>${types.map(t => `<button class="chip ${f === t ? 'on' : ''}" data-go="meus_checklists" data-f="${t}">${CK_TYPES[t]}</button>`).join('')}</div>` : ''}
      ${groups || '<div class="note">Você ainda não fez nenhum checklist.</div>'}
    </div>`;
  }
};

/* ---------- Gestão: veículo bloqueado vai direto para a manutenção ---------- */
ACTIONS['maint-direct'] = a => {
  const v = veh(a.dataset.id); const c = activeCustody(v.id); const iss = openIssues(v.id).filter(i => !i.canRun);
  openModal({
    title: `Enviar ${v.plate} para manutenção`,
    body: `<p>${iss.length ? `Problema informado: <b>${esc(iss[0].type)}</b> — ${esc(iss[0].desc)}` : 'Veículo bloqueado.'}</p>
      ${c ? `<div class="note warn">${ic('alert')}<div>A posse de <b>${esc(drv(c.driverId)?.name || '')}</b> será encerrada agora, sem checklist de entrega. O condutor é avisado.</div></div>` : ''}
      <form id="md-form" class="form-grid">
        <label class="field full"><span>Oficina e motivo</span><input class="inp" name="shop" placeholder="Ex.: Oficina X – freios"></label>
        <label class="field"><span>Quilometragem</span><input class="inp num" name="km" inputmode="numeric" value="${nf(Math.max(v.odometer || 0, lastRecordedKm(v.id)))}"></label>
        <p class="err full" id="md-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="maint-direct-ok" data-id="${v.id}">Enviar para manutenção</button>`
  });
};
ACTIONS['maint-direct-ok'] = a => {
  const v = veh(a.dataset.id); const d = formData($('#md-form')); const err = t => $('#md-err').textContent = t;
  if (!isManager()) return err('Somente a gestão envia para manutenção.');
  if ((d.shop || '').length < 3) return err('Informe a oficina e o motivo.');
  const k = parseInt(onlyDigits(d.km), 10) || v.odometer;
  const c = activeCustody(v.id);
  if (c) {
    if (k < c.startKm) return err('A quilometragem não pode ser menor que a do início da posse.');
    const t = activeTransfer(v.id); if (t) setTransfer(t, 'cancelada', 'Veículo enviado para manutenção pela gestão');
    c.end = nowTs(); c.endKm = k; c.closedReason = 'manutencao';
    notify(c.driverId, `O ${v.plate} foi enviado para manutenção pela gestão (${CUR.name}). Sua posse foi encerrada.`, { level: 'warn' });
    log('posse_fim', `Posse de ${drv(c.driverId)?.name || ''} encerrada pela gestão: veículo bloqueado enviado para manutenção`, { vehicleId: v.id, driverId: c.driverId });
  }
  v.odometer = Math.max(v.odometer, k); v.maintenance = true; v.maintenanceSince = nowTs(); v.maintenanceNote = d.shop;
  log('manutencao', `Entrada em manutenção sem checklist (veículo bloqueado por problema crítico): ${d.shop}`, { vehicleId: v.id });
  save(); closeModal(); toast('Veículo enviado para manutenção.'); render();
};
