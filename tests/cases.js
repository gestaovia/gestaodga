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
module.exports = C;
