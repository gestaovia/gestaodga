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
