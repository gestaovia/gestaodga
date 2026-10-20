// cada caso roda dentro da página (funções e estado do app); devolve true ou {ok, ...}
const C = [];
const t = (name, fn) => C.push({ name, fn });

// ---------- premiação: diário por dia ----------
t('dia com diário conta; dia sem diário não conta (posse de 5 dias, 1 diário)', () => {
  const T = FIX(); CUR = S.users[0];
  S.checklists.push({ id: 'r1', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-05T08:00'), serverAt: T('2026-10-05T08:00'), km: 15000, items: {}, photos: {} });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-05T08:00'), end: T('2026-10-09T18:00'), startKm: 15000, endKm: 15500, receiveChecklistId: 'r1', segments: [{ at: T('2026-10-05T08:00'), projectId: 'p1' }] });
  S.checklists.push({ id: 'k1', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-06T08:30'), serverAt: T('2026-10-06T08:30'), km: 15100 });
  const sc = driverScore('d1', '2026-10');
  return { ok: sc.possDays === 2 && sc.skipDays.length === 3 && /sem checklist diário neste dia/.test(sc.skipDays[0].why), possDays: sc.possDays, skip: sc.skipDays.map(x => x.why) };
});
t('dia do recebimento só conta se a posse tiver diário depois', () => {
  const T = FIX(); CUR = S.users[0];
  S.checklists.push({ id: 'r1', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-05T08:00'), serverAt: T('2026-10-05T08:00'), km: 15000 });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-05T08:00'), end: T('2026-10-06T18:00'), startKm: 15000, endKm: 15100, receiveChecklistId: 'r1', segments: [] });
  const a = driverScore('d1', '2026-10').possDays;
  S.checklists.push({ id: 'k1', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-06T08:30'), serverAt: T('2026-10-06T08:30'), km: 15050 });
  const b2 = driverScore('d1', '2026-10').possDays;
  return { ok: a === 0 && b2 === 2, semDiario: a, comDiario: b2 };
});
t('posse de 5 min com recebimento continua sem pontos (caso de 16/10)', () => {
  const T = FIX(); CUR = S.users[0];
  S.checklists.push({ id: 'r1', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-16T17:52'), serverAt: T('2026-10-16T17:52'), km: 15000 });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-16T17:52'), end: T('2026-10-16T17:57'), startKm: 15000, endKm: 15000, receiveChecklistId: 'r1', closedReason: 'forcada', segments: [] });
  const sc = driverScore('d1', '2026-10'); return { ok: sc.possDays === 0 && sc.eligible === false, possDays: sc.possDays };
});
t('regra "só diário" também exige o diário no dia', () => {
  const T = FIX(); CUR = S.users[0]; bonusCfg().versions = [{ from: '2026-10', p: { dayRule: 'diario' } }];
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-05T08:00'), end: T('2026-10-07T18:00'), startKm: 1, segments: [] });
  S.checklists.push({ id: 'k1', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-06T08:30'), serverAt: T('2026-10-06T08:30'), km: 2 });
  const sc = driverScore('d1', '2026-10'); return { ok: sc.possDays === 1, possDays: sc.possDays };
});

// ---------- horário do servidor ----------
t('relógio do celular 2 h adiantado: premiação usa o horário do servidor', () => {
  const T = FIX(); const c = { id: 'c1', start: T('2026-10-05T10:00'), serverStart: T('2026-10-05T08:00'), end: T('2026-10-05T20:00'), serverEnd: T('2026-10-05T18:00') };
  return { ok: custStart(c) === c.serverStart && custEnd(c) === c.serverEnd && custClock(c).min === -120 && !custClock(c).offline };
});
t('diferença pequena (5 min) mantém o horário do aparelho', () => {
  const T = FIX(); const c = { start: T('2026-10-05T08:00'), serverStart: T('2026-10-05T08:05') };
  return custStart(c) === c.start && custClock(c) === null;
});
t('posse enviada sem conexão 3 h depois mantém o horário do aparelho (com aviso)', () => {
  const T = FIX(); const c = { start: T('2026-10-05T08:00'), serverStart: T('2026-10-05T11:00'), offlineQueued: true };
  const k = custClock(c); return { ok: custStart(c) === c.start && k.offline === true, k };
});
t('envio sem conexão depois de 30 h passa a usar o servidor', () => {
  const T = FIX(); const c = { start: T('2026-10-05T08:00'), serverStart: T('2026-10-06T14:00'), offlineQueued: true };
  return custStart(c) === c.serverStart;
});
t('diário feito sem conexão às 08h e enviado às 14h não vira atraso', () => {
  const T = FIX(); CUR = S.users[0];
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-05T07:00'), end: T('2026-10-05T20:00'), startKm: 1, segments: [] });
  S.checklists.push({ id: 'k1', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-05T08:00'), serverAt: T('2026-10-05T14:00'), offlineQueued: true, km: 2 });
  const sc = driverScore('d1', '2026-10'); const late = sc.occ ? sc.occ : null;
  const b = sc.mods.B; return { ok: tsOf(S.checklists[0]) === T('2026-10-05T08:00') && b.n === 0, B: b };
});

// ---------- quilometragem ----------
t('km menor que o último registro é recusado', () => {
  FIX(); CUR = S.users[1]; DRAFT = {}; const e = []; kmGuard(S.vehicles[0], 14000, e); return e.length === 1 && /não pode ser menor/.test(e[0]);
});
t('salto grande pede conferência e aceita na segunda vez', () => {
  FIX(); CUR = S.users[1]; DRAFT = {}; const v = S.vehicles[0]; const e1 = []; kmGuard(v, 150000, e1); const e2 = []; kmGuard(v, 150000, e2);
  const j = DRAFT._kmJump; kmJumpNote(v, 'd1');
  return { ok: e1.length === 1 && /Confira a quilometragem/.test(e1[0]) && e2.length === 0 && j.to === 150000 && S.notifications.some(n => n.to === 'gestao' && /subiu/.test(n.text)) && S.audit.some(a => a.type === 'km'), e1 };
});
t('trocar o valor depois do aviso volta a conferir', () => {
  FIX(); CUR = S.users[1]; DRAFT = {}; const v = S.vehicles[0]; kmGuard(v, 150000, []); const e = []; kmGuard(v, 160000, e); return e.length === 1;
});
t('salto dentro do limite passa direto', () => {
  FIX(); CUR = S.users[1]; DRAFT = {}; const e = []; kmGuard(S.vehicles[0], 16500, e); return e.length === 0 && !DRAFT._kmJump;
});
t('kmAbove encontra checklist, abastecimento, posse e plano acima do km correto', () => {
  const T = FIX();
  S.checklists.push({ id: 'k1', type: 'diario', vehicleId: 'v1', driverId: 'd1', at: T('2026-10-10T08:00'), km: 150000 });
  S.fuel.push({ id: 'f1', vehicleId: 'v1', driverId: 'd1', at: T('2026-10-11T08:00'), km: 150200 });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-09T08:00'), end: T('2026-10-12T08:00'), startKm: 15000, endKm: 150300, segments: [] });
  S.plans[0].lastKm = 150000; S.vehicles[0].odometer = 150300;
  const l = kmAbove(S.vehicles[0], 15500); return { ok: l.length === 4 && l[0].r[l[0].f] === 150300, n: l.length, f: l.map(x => x.key + '.' + x.f) };
});

// ---------- pedágios ----------
t('mês fechado: snapshot no lugar do cálculo atual e aviso de diferença', () => {
  const T = FIX(); CUR = S.users[0];
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-09-01T07:00'), end: T('2026-09-30T18:00'), startKm: 1, segments: [{ at: T('2026-09-01T07:00'), projectId: 'p1' }] });
  S.tolls.push({ id: 't1', plate: 'ABC1D23', at: T('2026-09-10T09:00'), place: 'Praça', value: 10 }, { id: 't2', plate: 'ABC1D23', at: T('2026-09-11T09:00'), place: 'Praça', value: 5 });
  const snap = tollSnapshot(tollMonth('2026-09')); S.tollClosings.push({ id: 'x', month: '2026-09', closedAt: T('2026-10-02T10:00'), closedBy: 'u_adm', rows: snap, total: 15 });
  const a = tollMonthView('2026-09');
  S.custody[0].segments[0].projectId = 'p2'; // correção de obra depois do fechamento
  const b2 = tollMonthView('2026-09');
  return { ok: a.diff === 0 && b2.total === 15 && b2.obras[0].code === 'OB-01' && b2.diff > 0 && b2.live.obras[0].k === 'p2', diffA: a.diff, diffB: b2.diff };
});
t('importação ignora passagens de mês fechado; trava por data', () => {
  const T = FIX(); S.tollClosings.push({ id: 'x', month: '2026-09', closedAt: 1, rows: { obras: [] }, total: 0 });
  const rows = [['Placa', 'Data', 'Valor'], ['ABC1D23', '10/09/2026', '5,00'], ['ABC1D23', '10/10/2026', '6,00']];
  const out = tollBuild(rows, 0, { plate: 0, date: 1, value: 2, time: -1, place: -1, type: -1, tag: -1 }, true);
  return { ok: out[0].status === 'skip' && out[0].why === 'mês já fechado' && out[1].status === 'ok' && tollLockedAt(T('2026-09-30T23:30')) && !tollLockedAt(T('2026-10-01T00:30')), out: out.map(o => o.status + ':' + o.why) };
});

// ---------- fila do aparelho ----------
t('registro sem conexão fica no aparelho e volta depois de recarregar', async () => {
  const T = FIX(); CUR = S.users[1]; CLOUD.snapshot();
  S.checklists.push({ id: crypto.randomUUID(), type: 'diario', vehicleId: 'v1', driverId: 'd1', userId: 'u_d1', at: T('2026-10-20T08:00'), km: 15100, photos: { painel: 'data:image/jpeg;base64,' + 'A'.repeat(400) } });
  CLOUD.markOffline(); await CLOUD.savePending();
  const id = S.checklists[0].id; const flagged = S.checklists[0].offlineQueued === true;
  FIX(); CUR = S.users[1]; CLOUD.snapshot(); // app fechado e aberto de novo: dados do servidor sem o checklist
  const n = await CLOUD.replayPending(); clearTimeout(CLOUD.timer);
  const back = S.checklists.find(k => k.id === id);
  const ops = CLOUD.diff().filter(o => CLOUD.allowed(o));
  return { ok: flagged && n === 1 && !!back && back.offlineQueued && back.photos.painel.startsWith('data:') && ops.length === 1 && ops[0].op === 'insert', n, ops: ops.length };
});
t('fila vazia some do aparelho depois do envio', async () => {
  FIX(); CUR = S.users[1]; CLOUD.snapshot(); await CLOUD.savePending(); return (await PENDING.get('u_d1')) == null;
});
t('fila de outro usuário não é aplicada', async () => {
  const T = FIX(); CUR = S.users[1]; CLOUD.snapshot();
  S.checklists.push({ id: crypto.randomUUID(), type: 'diario', vehicleId: 'v1', driverId: 'd1', userId: 'u_d1', at: T('2026-10-20T08:00'), km: 15100 });
  await CLOUD.savePending(); FIX(); CUR = S.users[2]; CLOUD.snapshot(); const n = await CLOUD.replayPending(); FIX(); CUR = S.users[1]; CLOUD.snapshot(); await CLOUD.savePending();
  return n === 0;
});
t('condutor: posse encerrada sem conexão ganha o aviso', () => {
  const T = FIX(); CUR = S.users[1];
  S.custody.push({ id: crypto.randomUUID(), vehicleId: 'v1', driverId: 'd1', start: T('2026-10-20T07:00'), end: null, startKm: 15000, segments: [] }); CLOUD.snapshot();
  S.custody[0].end = T('2026-10-20T11:00'); CLOUD.markOffline(); return S.custody[0].offlineQueued === true;
});
// ---------- v1.13.0: dias não úteis (fila da gestão) ----------
t('dia não útil: diário de sábado entra na fila e não muda nada antes da decisão', () => {
  NBSET(); const q = nbQueue('2026-10'); const sc = driverScore('d1', '2026-10');
  return { ok: q.length === 1 && dayKey(q[0].d) === '2026-10-17' && !q[0].decision && /Sábado/.test(nbLabel(q[0].d)) && sc.possDays === 4 && sc.bizDays === 19 && sc.nbPending === 1 && nbPendingCount('2026-10') === 1, q: q.length, poss: sc.possDays, biz: sc.bizDays };
});
t('dia não útil considerado: soma nos dois lados (4/19 → 5/20)', () => {
  NBSET(); const b0 = driverScore('d1', '2026-10');
  newAdj({ driverId: 'd1', period: '2026-10', kind: 'diaextra', key: 'N:2026-10-17', reason: 'Considerado pela gestão' });
  const sc = driverScore('d1', '2026-10'); const exp = Math.round(sc.full * 5 / 20 * 100) / 100;
  return { ok: sc.possDays === 5 && sc.bizDays === 20 && sc.baseBizDays === 19 && sc.extraDays === 1 && sc.bonus === exp && sc.bonus > b0.bonus && nbPendingCount('2026-10') === 0, poss: sc.possDays, biz: sc.bizDays, bonus: sc.bonus, antes: b0.bonus };
});
t('dia não útil não considerado: premiação igual', () => {
  NBSET(); const b0 = driverScore('d1', '2026-10');
  newAdj({ driverId: 'd1', period: '2026-10', kind: 'diarecusa', key: 'N:2026-10-17', reason: 'uso particular' });
  const sc = driverScore('d1', '2026-10');
  return { ok: sc.possDays === 4 && sc.bizDays === 19 && sc.bonus === b0.bonus && sc.nbPending === 0 && nbQueue('2026-10')[0].decision.kind === 'diarecusa' };
});
t('desfazer a decisão devolve o dia para a fila', () => {
  NBSET(); const a = newAdj({ driverId: 'd1', period: '2026-10', kind: 'diaextra', key: 'N:2026-10-17', reason: 'Considerado pela gestão' });
  a.voidedAt = nowTs(); const sc = driverScore('d1', '2026-10');
  return { ok: sc.possDays === 4 && sc.bizDays === 19 && sc.nbPending === 1 };
});
t('fim de semana sem diário (só posse) não entra na fila', () => {
  NBSET(); S.checklists = S.checklists.filter(k => k.id !== 'ks'); return { ok: nbQueue('2026-10').length === 0 };
});
t('feriado (12/10) com diário entra na fila como feriado', () => {
  const T = FIX(); CUR = S.users[0];
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd2', start: T('2026-10-09T08:00'), end: T('2026-10-13T18:00'), startKm: 1, segments: [] });
  S.checklists.push({ id: 'kh', type: 'diario', vehicleId: 'v1', driverId: 'd2', custodyId: 'c1', at: T('2026-10-12T07:40'), serverAt: T('2026-10-12T07:40'), km: 2 });
  const q = nbQueue('2026-10'); return { ok: q.length === 1 && q[0].did === 'd2' && /Feriado · Nossa Senhora Aparecida/.test(nbLabel(q[0].d)), label: q[0] && nbLabel(q[0].d) };
});
t('dia aprovado que deixou de ser não útil é ignorado (sem contar duas vezes)', () => {
  NBSET(); bonusCfg().holidays.push({ date: '2026-10-16', name: 'Aniversário da cidade' });
  newAdj({ driverId: 'd1', period: '2026-10', kind: 'diaextra', key: 'N:2026-10-16', reason: 'Considerado pela gestão' });
  bonusCfg().holidays = []; const sc = driverScore('d1', '2026-10');
  return { ok: sc.extraDays === 0 && sc.possDays === 4 && sc.bizDays === 19, poss: sc.possDays, biz: sc.bizDays };
});
t('fechamento guarda os dias não úteis considerados', () => {
  NBSET(); newAdj({ driverId: 'd1', period: '2026-10', kind: 'diaextra', key: 'N:2026-10-17', reason: 'Considerado pela gestão' });
  const r = statementRow(S.drivers[0], driverScore('d1', '2026-10'));
  return { ok: r.extraDays === 1 && r.extraList.length === 1 && r.possDays === 5 && r.bizDays === 20 };
});

// ---------- v1.14.0: frota comercial / motorista administrativo ----------
t('administrativo: sem pontuação, sem prêmio e fora do ranking e do fechamento', () => {
  const T = ADMSET(); CUR = S.users[0]; ADMCUST(T);
  const sc = driverScore('d3', '2026-10'); const rk = rankList('2026-10').map(x => x.d.id); const cl = buildClosing('2026-10', false).rows.map(r => r.driverId);
  return { ok: sc.adm === true && sc.eligible === false && sc.bonus === 0 && sc.occurrences.length === 0 && !rk.includes('d3') && !cl.includes('d3'), sc: { adm: sc.adm, el: sc.eligible, b: sc.bonus }, rk, cl };
});
t('administrativo: sábado com diário não entra na fila de dias não úteis', () => {
  const T = ADMSET(); CUR = S.users[0]; ADMCUST(T);
  return { ok: nbQueue('2026-10').every(x => x.did !== 'd3') && nonBizDays('d3', '2026-10').length === 1, q: nbQueue('2026-10').length };
});
t('administrativo: diário opcional (sem "sem checklist hoje"); motorista de obra continua pendente', () => {
  const T = ADMSET(); CUR = S.users[0];
  S.custody.push({ id: 'cx', vehicleId: 'v3', driverId: 'd3', start: T('2026-10-20T07:00'), end: null, startKm: 5000, segments: [{ at: T('2026-10-20T07:00'), projectId: COM_ID }] });
  S.custody.push({ id: 'cy', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-20T07:00'), end: null, startKm: 15000, segments: [{ at: T('2026-10-20T07:00'), projectId: 'p1' }] });
  const att = attentionItems().map(a => a.title);
  return { ok: needsDaily(veh('v3')) === false && needsDaily(veh('v1')) === true && !att.some(x => /COM1A23 sem checklist/.test(x)), att };
});
t('obra COMERCIAL: aparece em 1º para o administrativo e some para o motorista de obra', () => {
  ADMSET(); CUR = S.users[0];
  const a = projectOptions('', true), o = projectOptions('', false);
  return { ok: a.indexOf('COMERCIAL') > 0 && a.indexOf('COMERCIAL') < a.indexOf('OB-01') && !o.includes('COMERCIAL') && o.includes('OB-01') };
});
t('obra COMERCIAL é criada pela gestão quando falta e não duplica', () => {
  FIX(); CUR = S.users[0]; ensureComProj(); ensureComProj();
  const n = S.projects.filter(p => isComProj(p.id)).length; return { ok: n === 1 && comProj().id === COM_ID && comProj().active === true, n };
});
t('relatórios: coluna Tipo do condutor e Uso do veículo', () => {
  const T = ADMSET(); CUR = S.users[0]; ADMCUST(T);
  const R = monthReport('2026-10'); const c = R.drivers.find(x => x.condutor === 'Carla Dias'); const v = R.vehicles.find(x => x.placa === 'COM1A23');
  const pc = R.projects.find(x => x.obra === 'COMERCIAL');
  return { ok: c?.tipo === 'Administrativo' && c.diarios === '—' && c.pontuacao === null && c.premio === 0 && v?.uso === 'Comercial' && pc?.km === 600, c, uso: v?.uso, pc };
});
t('indicadores: filtro Frota comercial separa os veículos', () => {
  ADMSET(); CUR = S.users[0]; KPI_F.u = 'comercial'; const a = S.vehicles.filter(kpiVehPass).map(v => v.plate); KPI_F.u = 'obra'; const b = S.vehicles.filter(kpiVehPass).map(v => v.plate); KPI_F.u = '';
  return { ok: a.join() === 'COM1A23' && b.length === 2 && !b.includes('COM1A23'), a, b };
});
module.exports = C;
