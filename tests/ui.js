module.exports = async (p, ok) => {
  const setup = async (role = 0) => p.evaluate((role) => {
    const T = FIX(); CUR = S.users[role]; CLOUD.on = false;
    S.checklists.push({ id: 'k1', type: 'diario', vehicleId: 'v1', driverId: 'd1', userId: 'u_d1', custodyId: 'c1', at: T('2026-10-10T08:00'), serverAt: T('2026-10-10T13:00'), offlineQueued: true, km: 150000, ok: true, photos: {} });
    S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-09T08:00'), serverStart: T('2026-10-09T10:30'), end: T('2026-10-12T08:00'), startKm: 15000, endKm: 150300, receiveChecklistId: null, segments: [{ at: T('2026-10-09T08:00'), projectId: 'p1' }] });
    S.custody.push({ id: 'c0', vehicleId: 'v1', driverId: 'd2', start: T('2026-09-01T07:00'), end: T('2026-09-30T18:00'), startKm: 14000, endKm: 14900, segments: [{ at: T('2026-09-01T07:00'), projectId: 'p1' }] });
    S.fuel.push({ id: 'f1', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-11T08:00'), km: 150200, liters: 30, total: 180 });
    S.tolls.push({ id: 't1', plate: 'ABC1D23', at: T('2026-09-10T09:00'), place: 'Praça Um', value: 10, invoice: 'Lançamento manual', source: 'manual', manual: null });
    S.plans[0].lastKm = 150000; S.vehicles[0].odometer = 150300;
  }, role);
  const goto = (page, params) => p.evaluate(([pg, pr]) => { go(pg, pr || {}); }, [page, params]);
  const click = async sel => { await p.click(sel); await p.waitForTimeout(80); };

  // --- correção de km ---
  await setup(0); await goto('veiculo', { id: 'v1' });
  ok('UI: botão Corrigir km na tela do veículo', await p.isVisible('[data-act="km-fix"]'));
  await click('[data-act="km-fix"]');
  await p.fill('#kf-form [name="km"]', '15600'); await p.fill('#kf-form [name="reason"]', 'condutor digitou um zero a mais');
  await click('[data-act="km-fix-next"]');
  const n = await p.$$eval('#kf-list input', l => l.length);
  ok('UI: lista os 4 registros acima do km correto', n === 4, n);
  const fills = { 'Fim da posse': '15300', 'Abastecimento': '15200', 'Diário': '15000', 'Plano': '12000' };
  // primeiro tenta salvar com valores acima (deve recusar)
  await click('[data-act="km-fix-ok"]');
  ok('UI: recusa registro acima do km correto', /informe um km entre 1 e 15\.600/.test(await p.textContent('#kf-err2')), await p.textContent('#kf-err2'));
  const rows = await p.$$('#kf-list > div');
  for (const r of rows) { const t = await r.textContent(); const k = Object.keys(fills).find(x => t.includes(x)); await (await r.$('input')).fill(fills[k]); }
  await click('[data-act="km-fix-ok"]');
  const kr = await p.evaluate(() => ({ odo: S.vehicles[0].odometer, ck: S.checklists[0].km, fix: S.checklists[0].kmFix?.[0], end: S.custody[0].endKm, fuel: S.fuel[0].km, plan: S.plans[0].lastKm, last: lastRecordedKm('v1'), log: S.audit.some(a => a.type === 'km' && /150\.300 → 15\.600/.test(a.text)), vfix: S.vehicles[0].kmFix?.length }));
  ok('UI: correção aplicada em tudo e registrada', kr.odo === 15600 && kr.ck === 15000 && kr.fix.from === 150000 && kr.end === 15300 && kr.fuel === 15200 && kr.plan === 12000 && kr.last === 15600 && kr.log && kr.vfix === 1, kr);

  // --- aviso de relógio na posse e checklist sem conexão ---
  await setup(0); await goto('veiculo', { id: 'v1', tab: 'posses' });
  const pills = await p.textContent('.tbl');
  ok('UI: posse com relógio divergente mostra aviso', /relógio/.test(pills));
  await p.evaluate(() => showChecklist('k1'));
  ok('UI: checklist feito sem conexão mostra horário do servidor', /Feito sem conexão: recebido pelo servidor/.test(await p.textContent('#modal')));
  await p.evaluate(() => closeModal());

  // --- pedágios: fechar e reabrir ---
  await setup(0); await p.evaluate(() => { TOLL_M = '2026-09'; }); await goto('pedagios');
  ok('UI: mês encerrado oferece Fechar o mês', await p.isVisible('[data-act="toll-close"]'));
  await click('[data-act="toll-close"]'); await click('[data-act="toll-close-ok"]');
  const tc = await p.evaluate(() => ({ n: S.tollClosings.length, total: S.tollClosings[0]?.total, ob: S.tollClosings[0]?.rows.obras[0]?.code, ps: S.tollClosings[0]?.rows.passagens.length }));
  ok('UI: fechamento grava foto por obra e passagens', tc.n === 1 && tc.total === 10 && tc.ob === 'OB-01' && tc.ps === 1, tc);
  ok('UI: mês fechado aparece congelado', /Mês fechado/.test(await p.textContent('#app')));
  await p.evaluate(() => { S.custody.find(c => c.id === 'c0').segments[0].projectId = 'p2'; render(); });
  ok('UI: avisa quando o cálculo atual muda depois do fechamento', /O cálculo atual ficou diferente do fechamento/.test(await p.textContent('#app')));
  const blocked = await p.evaluate(() => { const before = S.tolls.length; ACTIONS['toll-del']({ dataset: { id: 't1' } }); return { before, after: S.tolls.length, modal: !!document.querySelector('#modal') }; });
  ok('UI: excluir passagem de mês fechado é bloqueado', blocked.after === blocked.before && !blocked.modal, blocked);
  await click('[data-act="toll-reopen"]'); await p.fill('#tro-r', 'fatura complementar'); await click('[data-act="toll-reopen-ok"]');
  ok('UI: administrador reabre o mês com motivo', await p.evaluate(() => S.tollClosings.length === 0 && S.audit.some(a => /reabertos/.test(a.text))));
  await setup(0); await p.evaluate(() => { TOLL_M = '2026-10'; }); await goto('pedagios');
  ok('UI: mês corrente não oferece fechamento', !(await p.isVisible('[data-act="toll-close"]')));

  // --- outras telas sem erro ---
  await setup(0); await goto('configuracoes', { tab: 'regras' });
  ok('UI: campo de conferência de km nas regras', await p.isVisible('[name="kmJumpMax"]'));
  for (const pg of ['bonificacao', 'dashboard', 'veiculos', 'indicadores', 'relatorios', 'checklists']) {
    await setup(0); let e = null; try { await goto(pg); await p.waitForTimeout(60); } catch (x) { e = x.message; }
    ok(`UI: página ${pg} abre`, !e && (await p.textContent('#app')).length > 50, e);
  }
  await setup(1); await goto('inicio'); ok('UI: início do condutor abre', (await p.textContent('#app')).includes('Olá'));
};
module.exports.diario = async (p, ok) => {
  await p.evaluate(() => { const T = FIX(); CUR = S.users[1]; CLOUD.on = false; DRAFT = null;
    S.custody.push({ id: 'c9', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-19T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-19T07:00'), projectId: 'p1' }] }); go('diario', { vid: 'v1' }); });
  await p.waitForTimeout(100);
  await p.click('[data-act="d-ans"][data-v="sim"]'); await p.waitForTimeout(80);
  // v1.16.0: km começa vazio e a foto do hodômetro é obrigatória
  ok('UI condutor: diário sem km sugerido', (await p.inputValue('#dform [name="km"]')) === '');
  await p.fill('#dform [name="km"]', '15010'); await p.evaluate(() => document.querySelector('#dform').requestSubmit()); await p.waitForTimeout(100);
  ok('UI condutor: diário sem foto do hodômetro é recusado', /foto do painel com o hodômetro/.test(await p.textContent('#ck-err')) && (await p.evaluate(() => S.checklists.length)) === 0, await p.textContent('#ck-err'));
  await p.evaluate(() => { DRAFT.photos.painel_d = 'data:image/png;base64,AA=='; });
  await p.fill('#dform [name="km"]', '150000');
  await p.evaluate(() => document.querySelector('#dform').requestSubmit()); await p.waitForTimeout(100);
  const t1 = await p.textContent('#app'); const n1 = await p.evaluate(() => S.checklists.length);
  ok('UI condutor: diário com salto pede conferência', /Confira a quilometragem/.test(t1) && n1 === 0, n1);
  if (await p.$('#dform')) { await p.fill('#dform [name="km"]', '150000'); await p.evaluate(() => document.querySelector('#dform').requestSubmit()); } await p.waitForTimeout(100);
  const r = await p.evaluate(() => ({ n: S.checklists.length, odo: S.vehicles[0].odometer, nt: S.notifications.filter(n => n.to === 'gestao').length }));
  ok('UI condutor: segunda confirmação salva e avisa a gestão', r.n === 1 && r.odo === 150000 && r.nt === 1, r);
};
// v1.13.0: fila de dias não úteis e setas no visualizador de fotos
module.exports.v113 = async (p, ok, shots) => {
  const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }); };
  await p.evaluate(() => { NBSET(); CLOUD.on = false; BON_P = null; go('bonificacao'); });
  await p.waitForTimeout(80);
  ok('UI premiação: aviso de dia não útil pendente no ranking', /1 checklist\(s\) diário\(s\) em fim de semana ou feriado/.test(await p.textContent('#app')));
  await p.evaluate(() => go('bonificacao', { tab: 'naouteis' })); await p.waitForTimeout(80); await shot('nb-fila');
  ok('UI premiação: aba Dias não úteis lista o sábado', /17\/10\/2026/.test(await p.textContent('#app')) && await p.isVisible('[data-act="nb-yes"]'));
  await p.click('[data-act="nb-no"]'); await p.click('[data-act="nb-ok"]');
  ok('UI premiação: Não considerar exige motivo', /Informe o motivo/.test(await p.textContent('#nb-err')));
  await p.click('[data-act="modal-close"]');
  await p.click('[data-act="nb-yes"]'); await p.waitForTimeout(300); await shot('nb-considerar');
  ok('UI premiação: simulação mostra 4/19 → 5/19', /4\/19.*5\/19/s.test(await p.textContent('#modal')), await p.textContent('#modal .note'));
  await p.click('[data-act="nb-ok"]'); await p.waitForTimeout(80); await shot('nb-avaliado');
  const r = await p.evaluate(() => ({ adj: S.bonusAdj.filter(a => a.kind === 'diaextra' && a.key === 'N:2026-10-17').length, nt: S.notifications.some(n => n.to === 'd1' && /foi considerado/.test(n.text)), sc: driverScore('d1', '2026-10').possDays, log: S.audit.some(a => /considerado na premiação/.test(a.text)) }));
  ok('UI premiação: Considerar grava, avisa o condutor e soma o dia', r.adj === 1 && r.nt && r.sc === 5 && r.log, r);
  await p.click('[data-act="bn-void"]'); await p.fill('#bn-why', 'avaliei o dia errado'); await p.click('[data-act="bn-void-ok"]'); await p.waitForTimeout(60);
  ok('UI premiação: Desfazer devolve para a fila', await p.isVisible('[data-act="nb-yes"]') && await p.evaluate(() => driverScore('d1', '2026-10').possDays === 4));
  // extrato do condutor mostra o dia considerado
  await p.evaluate(() => { newAdj({ driverId: 'd1', period: '2026-10', kind: 'diaextra', key: 'N:2026-10-17', reason: 'Considerado pela gestão' }); go('condutor', { id: 'd1', tab: 'score' }); }); await p.waitForTimeout(80); await shot('nb-extrato');
  ok('UI extrato: mostra o dia não útil considerado', /considerado\(s\) pela gestão/.test(await p.textContent('#app')));

  // condutor faz diário no sábado → aviso para a gestão
  await p.evaluate(() => { const T = FIX(); CUR = S.users[1]; CLOUD.on = false; DRAFT = null; const N = T('2026-10-24T09:00'); Date.now = () => N;
    S.custody.push({ id: 'c9', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-23T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-23T07:00'), projectId: 'p1' }] }); go('diario', { vid: 'v1' }); });
  await p.waitForTimeout(80); await p.click('[data-act="d-ans"][data-v="sim"]'); await p.waitForTimeout(60);
  await p.evaluate(() => { DRAFT.photos.painel_d = 'data:image/png;base64,AA=='; });
  await p.fill('#dform [name="km"]', '15050'); await p.evaluate(() => document.querySelector('#dform').requestSubmit()); await p.waitForTimeout(100);
  // v1.20.0: em dia não útil a finalidade é obrigatória
  const n0 = await p.evaluate(() => ({ ck: S.checklists.length, err: document.querySelector('#ck-err')?.textContent || '' }));
  ok('UI condutor: diário no sábado exige a finalidade do uso', n0.ck === 0 && /finalidade/.test(n0.err), n0);
  await p.selectOption('#dform [name="nbType"]', 'Transporte de equipe'); await p.fill('#dform [name="nbDesc"]', 'plantão na obra OB-01');
  await p.evaluate(() => document.querySelector('#dform').requestSubmit()); await p.waitForTimeout(100);
  const n = await p.evaluate(() => ({ ck: S.checklists.length, np: S.checklists[0]?.nbPurpose, nt: S.notifications.filter(x => x.to === 'gestao' && /dia não útil/.test(x.text)).map(x => x.text) }));
  ok('UI condutor: diário no sábado avisa a gestão', n.ck === 1 && n.nt.length === 1 && /plantão na obra OB-01/.test(n.nt[0]) && n.np?.type === 'Transporte de equipe', n);
  await p.evaluate(() => { const N0 = new Date('2026-10-20T12:00:00-03:00').getTime(); Date.now = () => N0; });

  // visualizador de fotos
  await p.evaluate(() => { FIX(); CUR = S.users[0]; CLOUD.on = false; go('dashboard');
    S.checklists.push({ id: 'kp', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', at: nowTs(), km: 15000, ok: true, items: {}, photos: { frontal: 'x:frontal', traseira: 'x:traseira', lat_dir: 'x:lat_dir', lat_esq: 'x:lat_esq', painel: 'x:painel' } });
    showChecklist('kp'); });
  await p.click('#modal .thumbs img:nth-child(2)'); await p.waitForTimeout(300); await shot('fotos');
  const c1 = await p.textContent('#pv-count'); const l1 = await p.textContent('#pv-label');
  await p.keyboard.press('ArrowRight'); const c2 = await p.textContent('#pv-count');
  await p.click('.pv-nav.next'); const c3 = await p.textContent('#pv-count'); const l3 = await p.textContent('#pv-label');
  await p.click('.pv-nav.prev'); await p.click('.pv-strip button:nth-child(5)'); const c5 = await p.textContent('#pv-count'); const dis = await p.$eval('.pv-nav.next', b => b.disabled);
  ok('UI fotos: setas, teclado e miniaturas navegam entre as fotos', c1 === '2 de 5' && l1 === 'Traseira' && c2 === '3 de 5' && c3 === '4 de 5' && l3 === 'Lateral esquerda' && c5 === '5 de 5' && dis, { c1, l1, c2, c3, l3, c5, dis });
  await p.keyboard.press('Escape');
  ok('UI fotos: fechar a foto volta para o checklist aberto', !(await p.$('#pv')) && !!(await p.$('#modal')));
  // celular: deslizar o dedo
  await p.setViewportSize({ width: 390, height: 800 });
  await p.click('#modal .thumbs img:nth-child(1)'); await p.waitForTimeout(300); await shot('fotos-celular');
  await p.evaluate(() => { const el = document.querySelector('#pv'); const tt = (type, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 }); el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true })); }; tt('touchstart', 300); tt('touchend', 120); });
  ok('UI fotos: deslizar para o lado passa a foto no celular', (await p.textContent('#pv-count')) === '2 de 5');
  await p.click('.pv-x'); await p.setViewportSize({ width: 1280, height: 900 });
  // abastecimento: hodômetro e cupom na mesma linha
  await p.evaluate(() => { closeModal(); FIX(); CUR = S.users[0]; CLOUD.on = false; S.fuel.push({ id: 'f1', vehicleId: 'v1', driverId: 'd1', at: nowTs(), km: 15000, liters: 30, total: 180, odoPhoto: 'x:painel', receipt: 'x:cupom' }); go('abastecimento'); });
  await p.waitForTimeout(80);
  const fimg = await p.$('img[data-act="photo"][alt="Cupom"]');
  if (fimg) { await fimg.click(); ok('UI fotos: abastecimento navega entre hodômetro e cupom', (await p.textContent('#pv-count')) === '2 de 2'); await p.keyboard.press('Escape'); }
  else ok('UI fotos: abastecimento navega entre hodômetro e cupom', false, 'foto do cupom não encontrada');
};
// v1.14.0: frota comercial e motorista administrativo
module.exports.v114 = async (p, ok, shots) => {
  const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }); };
  const W = () => p.waitForTimeout(90);
  // cadastro: tipo de motorista
  await p.evaluate(() => { ADMSET(); CUR = S.users[0]; CLOUD.on = false; go('condutor', { id: 'd1' }); }); await W();
  await p.click('[data-act="drv-edit"]'); await W(); await shot('adm-form');
  ok('UI cadastro: campo Tipo de motorista', await p.isVisible('#dform-cad input[name="kind"][value="administrativo"]'));
  await p.click('#dform-cad input[name="kind"][value="administrativo"] + span');
  await p.evaluate(() => { const f = document.querySelector('#dform-cad'); f.cnh.value = '12345678901'; f.cnhExp.value = '2030-01-01'; f.email.value = 'u_d1@x.com'; });
  await p.click('[data-act="drv-save"]'); await W();
  const k = await p.evaluate(() => ({ kind: drv('d1').kind, nt: S.notifications.some(n => n.to === 'd1' && /administrativo/.test(n.text)), log: S.audit.some(a => /tipo: motorista administrativo/.test(a.text)) }));
  ok('UI cadastro: salva administrativo, registra e avisa o condutor', k.kind === 'administrativo' && k.nt && k.log, k);
  ok('UI condutor (gestão): sem aba Pontuação e com aviso de sem premiação', !/>Pontuação</.test(await p.innerHTML('.tabs')) && /não participa da premiação/.test(await p.textContent('#app'))); await shot('adm-condutor');
  await p.evaluate(() => go('condutores', { f: 'adm' })); await W();
  ok('UI condutores: filtro Administrativos', /Carla Dias/.test(await p.textContent('#app')) && /Ana Souza/.test(await p.textContent('#app')) && !/Bruno Lima/.test(await p.textContent('.cards')));
  // premiação: fora do ranking, com aviso
  await p.evaluate(() => { BON_P = null; go('bonificacao'); }); await W(); await shot('adm-premiacao');
  const rk = await p.textContent('.vlist');
  ok('UI premiação: administrativos fora do ranking, com aviso', !/Carla Dias|Ana Souza/.test(rk) && /motorista\(s\) administrativo\(s\)/.test(await p.textContent('#app')));
  // veículo: uso frota comercial
  await p.evaluate(() => go('veiculos')); await W();
  await p.click('[data-act="veh-new"]'); await W();
  ok('UI veículo: campo Uso do veículo', await p.isVisible('#vform input[name="fleet"][value="comercial"]'));
  await p.evaluate(() => { const f = document.querySelector('#vform'); f.plate.value = 'NEW1C23'; f.brand.value = 'VW'; f.model.value = 'Polo'; f.year.value = '2025'; f.odometer.value = '100'; });
  await p.click('#vform input[name="fleet"][value="comercial"] + span'); await p.click('[data-act="veh-save"]'); await W();
  ok('UI veículo: salva frota comercial', await p.evaluate(() => vehicleByPlate('NEW1C23')?.fleet === 'comercial'));
  await p.evaluate(() => go('veiculos', { f: 'comercial' })); await W(); await shot('adm-veiculos');
  const vc = await p.textContent('#v-cards');
  ok('UI veículos: filtro Frota comercial', /COM1A23/.test(vc.replace(/\W/g, '')) || /COM1A23|NEW1C23/.test(vc.replace(/[^A-Z0-9]/g, '')), vc.slice(0, 80));
  // app do condutor administrativo
  await p.evaluate(() => { const T = ADMSET(); CUR = S.users[3]; CLOUD.on = false; DRAFT = null;
    S.custody.push({ id: 'cx', vehicleId: 'v3', driverId: 'd3', start: T('2026-10-20T07:00'), end: null, startKm: 5000, segments: [{ at: T('2026-10-20T07:00'), projectId: COM_ID }] }); go('inicio'); });
  await p.setViewportSize({ width: 390, height: 860 }); await W(); await shot('adm-inicio');
  const home = await p.textContent('#app');
  ok('UI condutor administrativo: diário opcional, sem Pendente e sem pontuação', /Opcional/.test(home) && !/Pendente/.test(home) && !(await p.$('[data-act="my-score"]')) && /COMERCIAL/.test(home));
  ok('UI condutor administrativo: ação principal é Entregar veículo', await p.evaluate(() => document.querySelector('.main-act')?.dataset.go === 'entregar'));
  // recebimento: Comercial já selecionado
  await p.evaluate(() => { const T = ADMSET(); CUR = S.users[3]; CLOUD.on = false; DRAFT = null; S.qrcodes.push({ id: 'q3', vehicleId: 'v3', token: 'VLK1-AAAAAAAAAAAAAAAA', active: true }); go('receber', { vid: 'v3' }); }); await W(); await shot('adm-receber');
  const sel = await p.evaluate(() => ({ v: document.querySelector('#f-proj')?.value, opts: [...document.querySelectorAll('#f-proj option')].map(o => o.textContent.split(' – ')[0]) }));
  ok('UI recebimento administrativo: Comercial já escolhido, obras disponíveis', sel.v === '00000000-0000-4000-a000-00000000c0e1' && sel.opts[0] === 'COMERCIAL' && sel.opts.includes('OB-01'), sel);
  // motorista de obra não vê COMERCIAL
  await p.evaluate(() => { ADMSET(); CUR = S.users[1]; CLOUD.on = false; DRAFT = null; go('receber', { vid: 'v1' }); }); await W();
  const o2 = await p.evaluate(() => [...document.querySelectorAll('#f-proj option')].map(o => o.textContent));
  ok('UI recebimento de obra: sem COMERCIAL na lista', !o2.some(x => /COMERCIAL/.test(x)) && o2.some(x => /OB-01/.test(x)), o2);
  await p.setViewportSize({ width: 1280, height: 900 });
  // indicadores: filtro de uso
  await p.evaluate(() => { ADMSET(); CUR = S.users[0]; CLOUD.on = false; go('indicadores'); }); await W();
  ok('UI indicadores: filtro Obra e comercial', await p.isVisible('#kf-u'));
};
// v1.20.0: busca de obra, edição pelo administrador, atribuição, dia não útil, fotos pela galeria
module.exports.v120 = async (p, ok, shots) => {
  const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }); };
  const W = (ms = 90) => p.waitForTimeout(ms);
  const N0 = new Date('2026-10-20T12:00:00-03:00').getTime();
  // ---- busca de obra pelo número (recebimento no celular) ----
  await p.setViewportSize({ width: 390, height: 860 });
  await p.evaluate(() => { FIX(); CLOUD.on = false; DRAFT = null;
    ['1234', '1240', '0012', '512'].forEach((c, i) => S.projects.push({ id: 'px' + i, code: c, name: 'Obra ' + c, ccId: 'cc1', active: true }));
    CUR = S.users[1]; go('receber', { vid: 'v2' }); });
  await W(); await shot('v120-obra-busca');
  await p.fill('#ckform [data-proj-find]', '12'); await W(40);
  const b1 = await p.evaluate(() => ({ v: document.querySelector('#f-proj').value, opts: [...document.querySelector('#f-proj').options].map(o => o.textContent), d: DRAFT.projectId, hint: document.querySelector('.proj-hint').textContent }));
  ok('UI obra: número exato escolhe a obra (12 → 0012)', b1.v === 'px2' && b1.d === 'px2' && /0012/.test(b1.hint), b1);
  await p.fill('#ckform [data-proj-find]', '4'); await W(40);
  const b2 = await p.evaluate(() => ({ v: document.querySelector('#f-proj').value, opts: [...document.querySelector('#f-proj').options].map(o => o.textContent), d: DRAFT.projectId }));
  ok('UI obra: número que serve para várias filtra a lista sem escolher', b2.v === '' && b2.d === '' && b2.opts.length === 3 && /2 obras encontradas/.test(b2.opts[0]) && /1234/.test(b2.opts[1]) && /1240/.test(b2.opts[2]), b2);
  await p.fill('#ckform [data-proj-find]', '1234'); await p.keyboard.press('Enter'); await W(40);
  const b3 = await p.evaluate(() => ({ v: document.querySelector('#f-proj').value, d: DRAFT.projectId, page: ROUTE.page, cks: S.checklists.length }));
  ok('UI obra: Enter no campo de busca não envia o checklist', b3.v === 'px0' && b3.d === 'px0' && b3.page === 'receber' && b3.cks === 0, b3);
  await p.fill('#ckform [data-proj-find]', '999'); await W(40);
  const b4 = await p.evaluate(() => ({ n: document.querySelector('#f-proj').options.length, hint: document.querySelector('.proj-hint').textContent, v: document.querySelector('#f-proj').value }));
  ok('UI obra: sem resultado mostra aviso e a lista completa', b4.n === 7 && /Nenhuma obra/.test(b4.hint) && b4.v === 'px0', b4);
  // troca de obra e diário também têm a busca
  await p.evaluate(() => { DRAFT = null; FORM_DIRTY = false; const T = FIX(); ['1234'].forEach((c, i) => S.projects.push({ id: 'px' + i, code: c, name: 'Obra ' + c, ccId: 'cc1', active: true })); CUR = S.users[1];
    S.custody.push({ id: 'c5', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-19T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-19T07:00'), projectId: 'p1' }] }); go('obra', { vid: 'v1' }); });
  await W(); await p.fill('#oform [data-proj-find]', '1234'); await W(40);
  ok('UI obra: busca na troca de obra', await p.$eval('#o-proj', s => s.value) === 'px0');
  // ---- dia não útil: sem "Pendente" e sem aviso na gestão ----
  await p.evaluate(() => { const T = FIX(); DRAFT = null; FORM_DIRTY = false; const N = T('2026-10-24T09:00'); Date.now = () => N; CUR = S.users[1];
    S.custody.push({ id: 'c9', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-23T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-23T07:00'), projectId: 'p1' }] }); go('inicio'); });
  await W(); await shot('v120-sabado-inicio');
  const s1 = await p.evaluate(() => ({ pend: !!document.querySelector('.ck-pend'), txt: document.querySelector('.veh-card').textContent, att: attentionItems().filter(a => /sem checklist hoje/.test(a.title)).length, semCk: fleetCounts().semCk }));
  ok('UI dia não útil: condutor sem "Pendente" e gestão sem aviso de diário', !s1.pend && /Dia não útil/.test(s1.txt) && s1.att === 0 && s1.semCk === 0, s1);
  await p.evaluate(N => { Date.now = () => N; render(); }, new Date('2026-10-23T11:00:00-03:00').getTime()); await W(40);
  const s2 = await p.evaluate(() => ({ pend: !!document.querySelector('.ck-pend'), att: attentionItems().filter(a => /sem checklist hoje/.test(a.title)).length }));
  ok('UI dia útil continua cobrando o diário', s2.pend && s2.att === 1, s2);
  await p.evaluate(N => { Date.now = () => N; }, N0);
  // ---- abastecimento: câmera ou galeria, data do abastecimento feito sem internet ----
  await p.evaluate(() => { const T = FIX(); DRAFT = null; FORM_DIRTY = false; CUR = S.users[1];
    S.custody.push({ id: 'c7', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-17T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-17T07:00'), projectId: 'p1' }] });
    S.checklists.push({ id: 'kd', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c7', at: T('2026-10-20T08:00'), km: 15400, photos: { painel: 'x:painel' } }); S.vehicles[0].odometer = 15400; go('abastecer', { vid: 'v1' }); });
  await W(); await shot('v120-abastecer');
  const g = await p.evaluate(() => ({ cam: [...document.querySelectorAll('input[data-photo="hodometro"]')].map(i => i.hasAttribute('capture')), gal: document.querySelectorAll('input[data-photo][data-gal="1"]').length, when: !!document.querySelector('#fform [name="when"]') }));
  ok('UI abastecimento: foto pela câmera ou pela galeria', g.cam.length === 2 && g.cam[0] === true && g.cam[1] === false && g.gal === 2 && g.when, g);
  // foto escolhida na galeria (tirada ontem às 18:10) preenche a data
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const tPhoto = new Date('2026-10-19T18:10:00-03:00').getTime();
  await p.evaluate(({ b64, t }) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const f = new File([u], 'odo.png', { type: 'image/png', lastModified: t }); const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.querySelector('input[data-photo="hodometro"][data-gal="1"]'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }, { b64: PNG.toString('base64'), t: tPhoto });
  await W(300);
  const g2 = await p.evaluate(() => ({ when: DRAFT.when, inp: document.querySelector('#fform [name="when"]').value, ph: !!DRAFT.photos.hodometro, done: !!document.querySelector('.ph-pick.done[data-slot="hodometro"]') }));
  ok('UI abastecimento: foto da galeria sugere a data e hora do abastecimento', g2.when === '2026-10-19T18:10' && g2.inp === g2.when && g2.ph && g2.done, g2);
  await p.evaluate(() => { DRAFT.photos.cupom = 'data:image/png;base64,AA=='; });
  await p.fill('#fform [name="km"]', '15500'); await p.fill('#fform [name="liters"]', '30'); await p.fill('#fform [name="total"]', '180'); await p.fill('#fform [name="station"]', 'Posto BR');
  await p.fill('#fform [name="km"]', '15350'); await p.evaluate(() => document.querySelector('#fform').requestSubmit()); await W();
  const g4 = await p.evaluate(() => { const f = S.fuel[0]; return f ? { at: f.at, man: f.atManual, km: f.km, odo: S.vehicles[0].odometer } : null; });
  ok('UI abastecimento: grava com a data informada (registrado depois)', g4 && g4.at === tPhoto && g4.man === true && g4.km === 15350 && g4.odo === 15400, g4);
  // v1.20.2: km menor que o último registro não bloqueia mais (condutor esqueceu o checklist e registra o abastecimento depois)
  await p.evaluate(() => { DRAFT = null; FORM_DIRTY = false; go('abastecer', { vid: 'v1' }); }); await W();
  await p.evaluate(() => { DRAFT.photos.cupom = 'data:image/png;base64,AA=='; DRAFT.photos.hodometro = 'data:image/png;base64,AA=='; });
  await p.fill('#fform [name="km"]', '15200'); await p.fill('#fform [name="liters"]', '25'); await p.fill('#fform [name="total"]', '150'); await p.fill('#fform [name="station"]', 'Posto BR');
  await p.evaluate(() => document.querySelector('#fform').requestSubmit()); await W();
  const g5 = await p.evaluate(() => ({ n: S.fuel.length, km: S.fuel[1]?.km, odo: S.vehicles[0].odometer, err: document.querySelector('#ck-err')?.textContent || '' }));
  ok('UI abastecimento: km menor que o último registro é aceito (v1.20.2) e não baixa o hodômetro', g5.n === 2 && g5.km === 15200 && g5.odo === 15400, g5);
  await p.setViewportSize({ width: 1280, height: 900 });
  // ---- administrador edita checklist (km diferente da foto) ----
  await p.evaluate(() => { const T = FIX(); DRAFT = null; FORM_DIRTY = false; CLOUD.on = false; CUR = S.users[0];
    S.checklists.push({ id: 'ke', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c8', at: T('2026-10-20T08:00'), km: 150400, photos: { painel: 'x:painel' }, ok: true });
    S.custody.push({ id: 'c8', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-17T07:00'), end: null, startKm: 15000, segments: [] }); S.vehicles[0].odometer = 150400; showChecklist('ke'); });
  await W();
  ok('UI administrador: botão Editar no checklist', await p.isVisible('#modal [data-act="ck-edit"]'));
  await p.click('#modal [data-act="ck-edit"]'); await W(); await shot('v120-ck-edit');
  ok('UI editar checklist: mostra a foto do painel', await p.isVisible('#modal .thumbs img'));
  await p.fill('#re-form [name="km"]', '15040'); await p.click('[data-act="ck-edit-ok"]'); await W(40);
  ok('UI editar checklist: exige motivo', /motivo/.test(await p.textContent('#re-err')));
  await p.fill('#re-form [name="reason"]', 'km diferente da foto do painel'); await p.click('[data-act="ck-edit-ok"]'); await W();
  const e1 = await p.evaluate(() => { const k = byId(S.checklists, 'ke'); return { km: k.km, fix: k.kmFix?.[0]?.from, ed: k.edits?.length, odo: S.vehicles[0].odometer, log: S.audit.some(a => /editado por Mauricio/.test(a.text)), nt: S.notifications.some(n => n.to === 'd1' && /corrigiu o seu checklist/.test(n.text)), modal: document.querySelector('#modal')?.textContent || '' }; });
  ok('UI editar checklist: corrige km, hodômetro, histórico e avisa o condutor', e1.km === 15040 && e1.fix === 150400 && e1.ed === 1 && e1.odo === 15040 && e1.log && e1.nt && /Editado pela gestão/.test(e1.modal), e1);
  await p.evaluate(() => closeModal());
  // gestor de frota não edita
  await p.evaluate(() => { S.users.push({ id: 'u_g', name: 'Gil', role: 'gestor', active: true }); CUR = byId(S.users, 'u_g'); showChecklist('ke'); }); await W(40);
  ok('UI editar checklist: só o administrador vê Editar', !(await p.$('#modal [data-act="ck-edit"]')));
  await p.evaluate(() => closeModal());
  // ---- administrador edita abastecimento ----
  await p.evaluate(() => { const T = FIX(); CUR = S.users[0];
    S.fuel.push({ id: 'fe', vehicleId: 'v1', driverId: 'd1', at: T('2026-10-19T10:00'), km: 51200, liters: 30, total: 180, fuelType: 'Gasolina', station: 'Posto', odoPhoto: 'x:painel', receipt: 'x:cupom' });
    S.fuel.push({ id: 'fp', vehicleId: 'v1', driverId: 'd1', at: T('2026-10-15T10:00'), km: 14800, liters: 30, total: 180, fuelType: 'Gasolina', station: 'Posto' });
    S.vehicles[0].odometer = 51200; go('veiculo', { id: 'v1', tab: 'fuel' }); });
  await W();
  await p.click('[data-act="fuel-edit"][data-id="fe"]'); await W(); await shot('v120-fuel-edit');
  await p.fill('#re-form [name="km"]', '15120'); await p.fill('#re-form [name="liters"]', '32,5'); await p.fill('#re-form [name="reason"]', 'km digitado errado'); await p.click('[data-act="fuel-edit-ok"]'); await W();
  const e2 = await p.evaluate(() => { const f = byId(S.fuel, 'fe'); return { km: f.km, l: f.liters, ed: f.edits?.[0]?.changes, odo: S.vehicles[0].odometer, modal: !!document.querySelector('#modal'), pill: /editado/.test(document.querySelector('#app').textContent) }; });
  ok('UI editar abastecimento: corrige km e litros, hodômetro e marca "editado"', e2.km === 15120 && e2.l === 32.5 && e2.ed.km && e2.ed.liters && e2.odo === 15120 && !e2.modal && e2.pill, e2);
  // km fora da sequência pede confirmação
  await p.click('[data-act="fuel-edit"][data-id="fe"]'); await W();
  await p.fill('#re-form [name="km"]', '14700'); await p.fill('#re-form [name="reason"]', 'teste sequência'); await p.click('[data-act="fuel-edit-ok"]'); await W(40);
  const e3 = await p.evaluate(() => ({ km: byId(S.fuel, 'fe').km, err: document.querySelector('#re-err').textContent }));
  await p.click('[data-act="fuel-edit-ok"]'); await W(40);
  const e4 = await p.evaluate(() => byId(S.fuel, 'fe').km);
  ok('UI editar abastecimento: km fora da sequência pede confirmação', e3.km === 15120 && /Fora da sequência/.test(e3.err) && e4 === 14700, { e3, e4 });
  // ---- atribuição administrativa ----
  await p.evaluate(() => { FIX(); CUR = S.users[0]; go('veiculo', { id: 'v2' }); }); await W();
  ok('UI atribuição: botão no veículo sem condutor', await p.isVisible('[data-act="veh-assign"]'));
  await p.click('[data-act="veh-assign"]'); await W();
  await p.click('[data-act="veh-assign-ok"]'); await W(40);
  ok('UI atribuição: exige o condutor', /Selecione o condutor/.test(await p.textContent('#as-err')));
  await p.selectOption('#as-drv', 'd2'); await p.fill('#as-form [name="note"]', 'saiu sem checklist'); await p.click('[data-act="veh-assign-ok"]'); await W(); await shot('v120-atribuido');
  const a1 = await p.evaluate(() => ({ st: vStatus(veh('v2')), as: veh('v2').assign?.driverId, att: attentionItems().some(a => /atribuído sem checklist/.test(a.title)), nt: S.notifications.some(n => n.to === 'd2' && /está com você/.test(n.text)), txt: document.querySelector('#app').textContent, disp: fleetCounts().disp, custody: S.custody.length }));
  ok('UI atribuição: marca o condutor, avisa, aparece na atenção e não cria posse', a1.st === 'atribuido' && a1.as === 'd2' && a1.att && a1.nt && /Bruno Lima/.test(a1.txt) && /Atribuído/.test(a1.txt) && a1.disp === 1 && a1.custody === 0, a1);
  await p.evaluate(() => go('condutor', { id: 'd2' })); await W(40);
  ok('UI atribuição: aparece na página do condutor', /atribuído sem checklist/.test(await p.textContent('#app')));
  // o condutor faz o recebimento → atribuição termina sozinha
  await p.evaluate(() => { S.custody.push({ id: 'cz', vehicleId: 'v2', driverId: 'd2', start: nowTs() + 1, end: null, startKm: 30000, segments: [{ at: nowTs(), projectId: 'p1' }] }); });
  const a2 = await p.evaluate(() => ({ st: vStatus(veh('v2')), as: vAssign(veh('v2')), att: attentionItems().some(a => /atribuído sem checklist/.test(a.title)) }));
  ok('UI atribuição: termina quando o checklist de recebimento é feito', a2.st === 'em_uso' && !a2.as && !a2.att, a2);
  // remover
  await p.evaluate(() => { S.custody = []; veh('v2').assign = { driverId: 'd1', at: nowTs(), by: 'u_adm', note: '' }; go('veiculo', { id: 'v2' }); }); await W();
  await p.click('[data-act="veh-unassign"]'); await W(); await p.click('[data-act="veh-unassign-ok"]'); await W();
  ok('UI atribuição: remover volta para Disponível', await p.evaluate(() => vStatus(veh('v2')) === 'disponivel' && S.audit.some(a => /removida por/.test(a.text))));
  await p.evaluate(() => { CUR = byId(S.users, 'u_adm'); S.users.push({ id: 'u_g', name: 'Gil', role: 'gestor', active: true }); CUR = byId(S.users, 'u_g'); render(); }); await W(40);
  ok('UI atribuição: só o administrador atribui', !(await p.$('[data-act="veh-assign"]')));
};
// v1.20.1: foto no checklist não derruba o app e, se o celular fechar o app, o checklist é recuperado
module.exports.v1201 = async (p, ok, shots) => {
  const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }); };
  const W = (ms = 90) => p.waitForTimeout(ms);
  await p.setViewportSize({ width: 390, height: 860 });
  // foto "de câmera" grande (4000 x 3000) gerada no próprio navegador
  const big = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 4000; c.height = 3000; const x = c.getContext('2d'); x.fillStyle = '#3a6'; x.fillRect(0, 0, 4000, 3000); x.fillStyle = '#fff'; x.fillRect(100, 100, 800, 600);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .95)); const a = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return btoa(s); });
  const r1 = await p.evaluate(async b64 => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = await readPhoto(new File([u], 'cam.jpg', { type: 'image/jpeg' })); const im = new Image(); await new Promise(r => { im.onload = r; im.src = d; }); return { w: im.width, h: im.height, jpg: d.startsWith('data:image/jpeg'), kb: Math.round(d.length / 1024) }; }, big);
  ok('Foto: câmera em alta resolução vira JPEG de 640 px', r1.w === 640 && r1.h === 480 && r1.jpg && r1.kb < 200, r1);
  const r2 = await p.evaluate(async () => { const out = {};
    try { await readPhoto(new File([new Uint8Array(4 * 1024 * 1024)], 'x.heic', { type: 'image/heic' })); out.big = 'aceitou'; } catch (e) { out.big = e.message; }
    try { out.small = (await readPhoto(new File([new Uint8Array(500)], 'y.heic', { type: 'image/heic' }))).slice(0, 15); } catch (e) { out.small = 'recusou'; }
    return out; });
  ok('Foto: formato que não abre e é grande é recusado com aviso; pequeno segue como antes', /HEIF/.test(r2.big) && r2.small === 'data:image/heic', r2);
  // diário: km e foto pelo botão (arquivo de verdade no <input>)
  await p.evaluate(() => { const T = FIX(); CUR = S.users[1]; CLOUD.on = false; DRAFT = null; FORM_DIRTY = false;
    S.custody.push({ id: 'c9', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-19T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-19T07:00'), projectId: 'p1' }] }); go('diario', { vid: 'v1' }); });
  await W(); await p.click('[data-act="d-ans"][data-v="sim"]'); await W(80);
  await p.fill('#dform [name="km"]', '15020');
  await p.setInputFiles('#dform input[data-photo="painel_d"]', { name: 'painel.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(big, 'base64') });
  await p.waitForFunction(() => !!DRAFT?.photos?.painel_d && !PHOTO_BUSY); await W(500);
  const st = await p.evaluate(async () => { const s = await PENDING.get('rascunho:' + CUR.id); return s && { page: s.route.page, km: s.draft.km, ph: !!s.draft.photos.painel_d, ans: s.draft.answer }; });
  ok('Rascunho: checklist com foto fica guardado no aparelho', st && st.page === 'diario' && st.km === '15020' && st.ph && st.ans === 'sim', st);
  // o celular fecha o app (página recarrega do zero): memória perdida, volta ao início
  await p.evaluate(() => { DRAFT = null; FORM_DIRTY = false; ROUTE = { page: 'inicio', p: {} }; render(); });
  const back = await p.evaluate(async () => { const s = await DRAFT_STORE.take(); if (s) DRAFT_STORE.resume(s); await new Promise(r => setTimeout(r, 60));
    return { page: ROUTE.page, km: document.querySelector('#dform [name="km"]')?.value, ph: !!document.querySelector('#dform [data-slot="painel_d"] img'), dirty: FORM_DIRTY, toast: document.body.textContent.includes('foi recuperado') }; });
  await shot('v1201-recuperado');
  ok('Rascunho: ao reabrir, volta ao diário com km e foto', back.page === 'diario' && back.km === '15020' && back.ph && back.dirty && back.toast, back);
  // concluir enquanto a foto ainda está sendo preparada: espera
  const busy = await p.evaluate(() => { PHOTO_BUSY = 1; const n0 = S.checklists.length; document.querySelector('#dform').requestSubmit(); const r = { n: S.checklists.length - n0, page: ROUTE.page }; PHOTO_BUSY = 0; return r; });
  ok('Foto em preparo: concluir espera', busy.n === 0 && busy.page === 'diario', busy);
  await p.evaluate(() => document.querySelector('#dform').requestSubmit()); await W(400);
  const done = await p.evaluate(async () => ({ page: ROUTE.page, n: S.checklists.filter(k => k.type === 'diario' && k.km === 15020 && k.photos.painel).length, kept: await PENDING.get('rascunho:' + CUR.id) }));
  ok('Rascunho: concluir salva o checklist e apaga o rascunho do aparelho', done.page === 'inicio' && done.n === 1 && !done.kept, done);
  // outro usuário ou rascunho velho não é recuperado
  const other = await p.evaluate(async () => { CUR = S.users[1]; DRAFT = { kind: 'diario', vid: 'v1', km: '1', photos: {}, items: {} }; ROUTE = { page: 'diario', p: { vid: 'v1' } }; await DRAFT_STORE.saveNow();
    const s = await PENDING.get('rascunho:' + CUR.id); s.at = Date.now() - 13 * 36e5; await PENDING.put('rascunho:' + CUR.id, s); DRAFT = null;
    const old = await DRAFT_STORE.take(); return { old: old === null, gone: (await PENDING.get('rascunho:' + CUR.id)) == null }; });
  ok('Rascunho: com mais de 12 h é descartado', other.old && other.gone, other);
  await p.evaluate(() => { DRAFT = null; FORM_DIRTY = false; });
  await p.setViewportSize({ width: 1280, height: 900 });
};
