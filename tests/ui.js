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
  ok('UI premiação: simulação mostra 4/19 → 5/20', /4\/19.*5\/20/s.test(await p.textContent('#modal')), await p.textContent('#modal .note'));
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
  await p.fill('#dform [name="km"]', '15050'); await p.evaluate(() => document.querySelector('#dform').requestSubmit()); await p.waitForTimeout(100);
  const n = await p.evaluate(() => ({ ck: S.checklists.length, nt: S.notifications.filter(x => x.to === 'gestao' && /dia não útil/.test(x.text)).map(x => x.text) }));
  ok('UI condutor: diário no sábado avisa a gestão', n.ck === 1 && n.nt.length === 1, n);
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
