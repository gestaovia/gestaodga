/* ===================== Premiação · Regulamento do Programa de Pontuação e Bonificação de Motoristas (versão 00) =====================
   Período de apuração: do dia 26 de um mês ao dia 25 do mês seguinte (chave AAAA-MM = mês em que o período termina).
   Modalidades: A (checklist de entrega e recebimento), B (checklist diário), C (abastecimento com foto do hodômetro).
   Ordem do cálculo (item 6): pontos da modalidade − descontos (mínimo 0) → subtotal → −10 por modalidade zerada → mínimo 0.
   Premiação (item 7): (valor base + adicional) × dias com posse ÷ dias úteis do período.
   Os parâmetros (item 11) têm vigência por período: uma alteração só vale a partir do período seguinte. */
const BONUS_DEF = () => ({ startDay: 26, ptsA: 50, ptsB: 30, ptsC: 20, discA: 50, discLate: 10, discAbsent: 15, deadline: '10:00', discC: 10, zeroPenalty: 10, baseValue: 300, add100: 100, add90: 50, addMinDays: 15, releaseDays: 3 });
const MODS = {
  A: { l: 'Checklist de entrega e recebimento', s: 'Entrega e recebimento', pk: 'ptsA' },
  B: { l: 'Checklist diário', s: 'Checklist diário', pk: 'ptsB' },
  C: { l: 'Abastecimento com foto do hodômetro', s: 'Abastecimento', pk: 'ptsC' }
};
const PARAM_LABEL = {
  startDay: ['Dia de início do período', 'dia'], ptsA: ['Pontos: checklist de entrega e recebimento', 'pts'], ptsB: ['Pontos: checklist diário', 'pts'], ptsC: ['Pontos: abastecimento', 'pts'],
  discA: ['Desconto: transferência sem checklist completo', 'pts'], discLate: ['Desconto: checklist diário com atraso', 'pts'], discAbsent: ['Desconto: ausência de checklist diário', 'pts'],
  deadline: ['Horário limite do checklist diário', ''], discC: ['Desconto: abastecimento sem registro ou sem foto', 'pts'], zeroPenalty: ['Penalidade por modalidade zerada', 'pts'],
  baseValue: ['Valor base da premiação (100 pontos)', 'R$'], add100: ['Adicional com 100 pontos', 'R$'], add90: ['Adicional de 90 a 99 pontos', 'R$'],
  addMinDays: ['Dias com posse mínimos para o adicional', 'dias'], releaseDays: ['Divulgação do extrato após o fim do período', 'dias']
};
const bonusCfg = () => { const s = S.settings; if (!s.bonus) s.bonus = { startPeriod: null, versions: [], closing: { auto: true }, holidays: [], odoSince: null }; const b = s.bonus; b.versions = b.versions || []; b.holidays = b.holidays || []; b.closing = b.closing || { auto: true }; return b; };
function bonusP(key) {
  const vs = bonusCfg().versions.slice().sort((a, b) => a.from < b.from ? -1 : 1);
  const v = vs.filter(x => x.from <= key).at(-1) || vs[0];
  return { ...BONUS_DEF(), ...(v?.p || {}) };
}

/* ----- período de apuração ----- */
function periodRange(key) {
  const [y, m] = key.split('-').map(Number); const sd = Math.max(1, Math.min(28, +bonusP(key).startDay || 1));
  return sd === 1 ? [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()] : [new Date(y, m - 2, sd).getTime(), new Date(y, m - 1, sd).getTime()];
}
function periodOf(t) {
  let key = monthKey(t); const [f, to] = periodRange(key);
  if (t >= to) key = shiftMonth(key, 1); else if (t < f) key = shiftMonth(key, -1);
  return key;
}
const curPeriod = () => periodOf(nowTs());
const periodDates = key => { const [f, t] = periodRange(key); return `${fmtDate(f)} a ${fmtDate(t - 1)}`; };
const periodName = key => `${cap(monthName(key))} · ${periodDates(key)}`;
const releaseAt = key => { const [, t] = periodRange(key); const d = new Date(t - 1); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (+bonusP(key).releaseDays || 0)); return d.getTime(); };
const deadlineNow = () => bonusP(curPeriod()).deadline || S.settings.dailyDeadline || '10:00';
const hm = s => { const [h, m] = String(s || '10:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/* ----- dias úteis (segunda a sexta, exceto feriados) ----- */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da);
}
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const NATIONAL = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']];
function holidaysOf(y) {
  const out = NATIONAL.map(([md, n]) => ({ date: `${y}-${md}`, name: n, national: true }));
  const gf = easter(y); gf.setDate(gf.getDate() - 2); out.push({ date: dayKey(gf.getTime()), name: 'Sexta-feira Santa', national: true });
  bonusCfg().holidays.filter(h => h.date?.startsWith(y + '-')).forEach(h => out.push({ date: h.date, name: h.name || 'Feriado', national: false }));
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
const HOLI = { k: null, set: null };
function isHoliday(t) {
  const k = JSON.stringify(bonusCfg().holidays); if (HOLI.k !== k) { HOLI.k = k; HOLI.set = new Map(); }
  const y = new Date(t).getFullYear(); if (!HOLI.set.has(y)) HOLI.set.set(y, new Set(holidaysOf(y).map(h => h.date)));
  return HOLI.set.get(y).has(dayKey(t));
}
const isBizDay = t => { const w = new Date(t).getDay(); return w > 0 && w < 6 && !isHoliday(t); };
function daysBetween(from, to) { const out = []; const d = new Date(from); d.setHours(0, 0, 0, 0); while (d.getTime() < to) { out.push(d.getTime()); d.setDate(d.getDate() + 1); } return out; }
const nextDay = t => { const d = new Date(t); d.setDate(d.getDate() + 1); return d.getTime(); };

/* ----- evidências ----- */
const tsOf = r => r?.serverAt || r?.at;           // horário gravado pelo servidor (registros antigos: horário do aparelho)
const ckComplete = k => !!k && CK_ITEMS.every(([x]) => k.items && k.items[x]) && PHOTO_SLOTS.every(([x]) => k.photos && k.photos[x] && !String(k.photos[x]).startsWith('removida'));
const fuelHasOdo = f => f.at >= (bonusCfg().odoSince || 0) ? !!f.odoPhoto : !!(f.odoPhoto || f.receipt);
const blockedAt = (vid, ts) => S.issues.some(i => i.vehicleId === vid && !i.canRun && i.at <= ts && (i.status === 'aberta' || (i.resolvedAt && i.resolvedAt > ts)));
const adjOf = (did, key) => (S.bonusAdj || []).filter(a => a.driverId === did && a.period === key);

/* ----- pontuação e premiação de um condutor no período ----- */
function driverScore(did, key = curPeriod()) {
  if (typeof key === 'number') key = periodOf(key);
  const P = bonusP(key); const [from, to] = periodRange(key); const now = nowTs(); const partial = now < to;
  const cs = S.custody.filter(c => c.driverId === did && !c.imported && c.start < to && (!c.end || c.end > from));
  const adjs = adjOf(did, key); const live = adjs.filter(a => !a.voidedAt);
  const abono = new Map(live.filter(a => a.kind === 'abono').map(a => [a.key, a]));
  const occ = [];
  const add = (o) => { const ab = abono.get(o.key); occ.push({ ...o, abono: ab ? { id: ab.id, reason: ab.reason, by: ab.createdBy, at: ab.createdAt } : null }); };

  // dias úteis do período e dias com posse
  const days = daysBetween(from, to); const biz = days.filter(isBizDay);
  const possDays = biz.filter(d => d <= now && cs.some(c => c.start < nextDay(d) && (!c.end || c.end > d)));

  // A · entrega e recebimento (−50 por transferência sem checklist completo)
  cs.forEach(c => {
    if (c.start >= from && c.start < to) { const k = byId(S.checklists, c.receiveChecklistId); if (!ckComplete(k)) add({ key: `A:rec:${c.id}`, mod: 'A', at: c.start, pts: P.discA, why: k ? 'Checklist de recebimento incompleto (itens ou fotos faltando)' : 'Veículo recebido sem checklist de recebimento', ev: { checklistId: k?.id || null, vehicleId: c.vehicleId } }); }
    if (c.end && c.end >= from && c.end < to && !['forcada', 'manutencao'].includes(c.closedReason)) { const k = byId(S.checklists, c.deliverChecklistId); if (!ckComplete(k)) add({ key: `A:ent:${c.id}`, mod: 'A', at: c.end, pts: P.discA, why: k ? 'Checklist de entrega incompleto (itens ou fotos faltando)' : 'Veículo entregue sem checklist de entrega', ev: { checklistId: k?.id || null, vehicleId: c.vehicleId } }); }
  });
  const fuels = S.fuel.filter(f => f.driverId === did && tsOf(f) >= from && tsOf(f) < to);
  fuels.forEach(f => { if (!S.custody.some(c => c.driverId === did && c.vehicleId === f.vehicleId && c.start <= f.at && (!c.end || c.end >= f.at))) add({ key: `A:fuel:${f.id}`, mod: 'A', at: f.at, pts: P.discA, why: 'Abastecimento em período sem posse aberta no sistema', ev: { fuelId: f.id, vehicleId: f.vehicleId } }); });

  // B · checklist diário em todo dia com posse (prazo P.deadline; atraso −10; ausência −15)
  const cks = S.checklists.filter(k => k.driverId === did && ['diario', 'recebimento', 'entrega', 'devolucao'].includes(k.type));
  let onTime = 0, late = 0, absent = 0, pending = 0, exempt = 0;
  possDays.forEach(d => {
    const vehs = [...new Set(cs.filter(c => c.start < nextDay(d) && (!c.end || c.end > d)).map(c => c.vehicleId))];
    const dl = d + hm(P.deadline) * MIN;
    if (vehs.length && vehs.every(v => blockedAt(v, dl))) { exempt++; return; } // veículo parado por problema crítico
    const dk = cks.filter(k => tsOf(k) >= d && tsOf(k) < nextDay(d));
    if (dk.some(k => k.type !== 'diario') || dk.some(k => tsOf(k) <= dl)) { onTime++; return; }
    const lk = dk.find(k => k.type === 'diario');
    if (lk) { late++; add({ key: `B:${dayKey(d)}`, mod: 'B', at: tsOf(lk), pts: P.discLate, why: `Checklist diário enviado às ${fmtTime(tsOf(lk))}, depois do prazo (${P.deadline})`, ev: { checklistId: lk.id, vehicleId: lk.vehicleId } }); return; }
    if (now < nextDay(d)) { pending++; return; } // hoje: ainda dá tempo até 23h59 (sem desconto por enquanto)
    absent++; add({ key: `B:${dayKey(d)}`, mod: 'B', at: d, pts: P.discAbsent, why: 'Nenhum checklist diário enviado no dia', ev: { vehicleId: vehs[0] || null } });
  });

  // C · abastecimento com foto do hodômetro (−10 por abastecimento sem foto)
  fuels.forEach(f => { if (!fuelHasOdo(f)) add({ key: `C:foto:${f.id}`, mod: 'C', at: f.at, pts: P.discC, why: `Abastecimento sem foto do hodômetro (${nf(f.liters, 1)} L em ${f.station || 'posto não informado'})`, ev: { fuelId: f.id, vehicleId: f.vehicleId } }); });

  // ocorrências registradas pela gestão (ex.: abastecimento sem registro no extrato do cartão, uso sem checklist)
  live.filter(a => a.kind === 'ocorrencia' && MODS[a.modality]).forEach(a => add({ key: `M:${a.id}`, mod: a.modality, at: a.at || a.createdAt, pts: Math.abs(+a.points || 0), why: a.reason, manual: a.id, ev: { vehicleId: a.vehicleId || null } }));
  occ.sort((a, b) => (a.at || 0) - (b.at || 0));

  // cálculo (item 6)
  const mods = Object.fromEntries(Object.entries(MODS).map(([k, m]) => {
    const max = +P[m.pk] || 0; const disc = sum(occ.filter(o => o.mod === k && !o.abono), o => o.pts);
    return [k, { k, l: m.l, max, disc, v: Math.max(0, max - disc), zero: max > 0 && disc >= max, n: occ.filter(o => o.mod === k && !o.abono).length }];
  }));
  const subtotal = sum(Object.values(mods), m => m.v);
  const zeroed = Object.values(mods).filter(m => m.zero).length; const penalty = zeroed * (+P.zeroPenalty || 0);
  const adjust = sum(live.filter(a => a.kind === 'ajuste'), a => +a.points || 0);
  const total = Math.max(0, Math.min(100, subtotal - penalty + adjust));
  // premiação (item 7)
  const eligible = cs.length > 0;
  const base = (+P.baseValue || 0) * total / 100;
  let addv = total >= 100 ? +P.add100 || 0 : total >= 90 ? +P.add90 || 0 : 0; const addBlocked = addv > 0 && possDays.length < (+P.addMinDays || 0);
  if (addBlocked) addv = 0;
  const full = base + addv; const factor = biz.length ? possDays.length / biz.length : 0;
  const bonus = eligible ? Math.round(full * factor * 100) / 100 : 0;
  const parts = Object.values(mods).map(m => ({ k: m.k, l: m.l, v: m.v, max: m.max, info: m.n ? `${m.n} desconto(s)${m.zero ? ' · zerada' : ''}` : 'Sem descontos' }));
  return { key, from, to, partial, P, total, bonus, eligible, mods, subtotal, zeroed, penalty, adjust, base, add: addv, addBlocked, full, factor, possDays: possDays.length, bizDays: biz.length,
    occurrences: occ, adjustments: adjs, parts, req: onTime + late + absent, done: onTime + late, late, absent, pending, exempt, tier: null, fines: [] };
}
function rankList(key) {
  const [from, to] = periodRange(key);
  const list = S.drivers.filter(d => !d._ro || d.id === CUR?.driverId).filter(d => d.active !== false || S.custody.some(c => c.driverId === d.id && c.start < to && (!c.end || c.end > from)))
    .map(d => ({ d, sc: driverScore(d.id, key) })).sort((a, b) => (b.sc.eligible - a.sc.eligible) || b.sc.total - a.sc.total || b.sc.bonus - a.sc.bonus || a.d.name.localeCompare(b.d.name, 'pt-BR'));
  let pos = 0; list.forEach((x, i) => { if (!i || x.sc.total !== list[i - 1].sc.total || x.sc.eligible !== list[i - 1].sc.eligible) pos = i + 1; x.pos = x.sc.eligible ? pos : null; }); // empate: mesma posição
  return list;
}

/* ----- fechamento (guarda o extrato de cada condutor como estava) ----- */
function statementRow(d, sc) {
  return { driverId: d.id, name: d.name, score: sc.total, bonus: sc.bonus, base: Math.round(sc.base * 100) / 100, add: sc.add, addBlocked: sc.addBlocked, full: Math.round(sc.full * 100) / 100, factor: sc.factor, possDays: sc.possDays, bizDays: sc.bizDays,
    subtotal: sc.subtotal, zeroed: sc.zeroed, penalty: sc.penalty, adjust: sc.adjust, mods: sc.mods, occurrences: sc.occurrences.map(o => ({ key: o.key, mod: o.mod, at: o.at, pts: o.pts, why: o.why, manual: o.manual || null, abono: o.abono, ev: o.ev })),
    adjustments: sc.adjustments.filter(a => a.kind === 'ajuste' && !a.voidedAt).map(a => ({ points: a.points, reason: a.reason, at: a.createdAt })), counts: { late: sc.late, absent: sc.absent, exempt: sc.exempt }, P: sc.P };
}
function buildClosing(key, auto) {
  const list = rankList(key).filter(x => x.sc.eligible);
  const rows = list.map(({ d, sc, pos }) => ({ pos, ...statementRow(d, sc) }));
  const [from, to] = periodRange(key);
  return { id: uid(), month: key, closedAt: nowTs(), closedBy: CUR.id, auto: !!auto, rows, total: Math.round(sum(rows, r => r.bonus) * 100) / 100, from, to, releaseAt: releaseAt(key) };
}
function closeMonth(key, auto) {
  if (closingOf(key)) return null;
  const c = buildClosing(key, auto); if (auto && !c.rows.length) return null;
  S.closings = S.closings || []; S.closings.push(c);
  log('premiacao', `Fechamento da premiação do período ${periodDates(key)} ${auto ? 'feito automaticamente' : `feito por ${CUR.name}`}: ${c.rows.filter(r => r.bonus).length} premiado(s), ${money(c.total)}. Extrato liberado aos condutores em ${fmtDate(c.releaseAt)}.`, {});
  notify('gestao', `Premiação do período ${periodDates(key)} fechada${auto ? ' automaticamente' : ''}: ${money(c.total)}.`, { level: 'ok', link: { page: 'relatorios', id: '' } });
  c.rows.forEach(r => notify(r.driverId, `Seu extrato da premiação (${periodDates(key)}) fica disponível em ${fmtDate(c.releaseAt)}.`, { link: { page: 'inicio' } }));
  return c;
}
// fechamento automático: na data de divulgação do período anterior (fim do período + dias de divulgação)
function autoCloseCheck() {
  if (!isManager()) return;
  const b = bonusCfg(); if (!b.closing.auto) return;
  const prev = shiftMonth(curPeriod(), -1);
  if (b.startPeriod && prev < b.startPeriod) return;
  if (closingOf(prev) || nowTs() < releaseAt(prev)) return;
  if (closeMonth(prev, true)) { save(); toast(`Premiação do período ${periodDates(prev)} fechada automaticamente.`); }
}

/* ===================== Telas ===================== */
const scoreBar = (v, max) => `<div class="bar s-${pctTone(v, max)}"><i style="width:${max ? Math.max(2, v / max * 100) : 0}%"></i></div>`;
const modPill = k => `<span class="pill mod-${k}">${k}</span>`;
function occRow(o, opts = {}) {
  const ev = o.ev?.checklistId ? `<button class="link small" data-act="ck-view" data-id="${o.ev.checklistId}">ver checklist</button>` : '';
  const vv = o.ev?.vehicleId && veh(o.ev.vehicleId) ? ` · ${veh(o.ev.vehicleId).plate}` : '';
  const btn = opts.manage && !o.abono && !opts.closed ? `<button class="btn sm" data-act="bn-abonar" data-did="${opts.did}" data-key="${esc(o.key)}" data-p="${opts.key}" data-why="${esc(o.why)}">Abonar</button>` : '';
  const who = opts.who ? `<td><button class="link" data-go="condutor" data-id="${opts.who.id}" data-tab="score">${esc(opts.who.name)}</button></td>` : '';
  return `<tr class="${o.abono ? 'abonado' : ''}">${who}<td class="nowrap">${fmtDate(o.at)}${o.mod === 'B' ? '' : ` <span class="muted small">${fmtTime(o.at)}</span>`}</td><td>${modPill(o.mod)}</td>
    <td>${esc(o.why)}<div class="small muted">${o.manual ? 'Registrado pela gestão' : 'Identificado pelo sistema'}${vv}${ev ? ' · ' + ev : ''}</div>${o.abono ? `<div class="small"><span class="st"><span class="dot ok"></span>Abonado: ${esc(o.abono.reason)}</span></div>` : ''}</td>
    <td class="r nowrap"><b class="num" style="${o.abono ? 'text-decoration:line-through;color:var(--text3)' : 'color:var(--red)'}">−${nf(o.pts)}</b></td>${opts.manage ? `<td class="r">${btn}</td>` : ''}</tr>`;
}
/* extrato do período (item 9): descontos, cálculo da pontuação (item 6) e da premiação (item 7) */
function statementHTML(sc, opts = {}) {
  const P = sc.P; const M = sc.mods; const key = sc.key || opts.key;
  const modsHTML = Object.values(M).map(m => `<div class="mod-card"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div class="row" style="gap:8px;flex-wrap:nowrap">${modPill(m.k)}<b>${esc(MODS[m.k].l)}</b></div><b class="num">${nf(m.v)} / ${nf(m.max)}</b></div>${scoreBar(m.v, m.max)}<div class="tiny muted">${m.disc ? `Descontos: −${nf(m.disc)}${m.disc > m.max ? ` (limitado a ${nf(m.max)})` : ''}` : 'Sem descontos'}${m.zero ? ' · <b style="color:var(--red)">modalidade zerada</b>' : ''}</div></div>`).join('');
  const occ = sc.occurrences || [];
  const fx = `${sc.possDays}/${sc.bizDays}`;
  const steps = [
    ['1. Pontos das modalidades', `A ${nf(M.A.max)} · B ${nf(M.B.max)} · C ${nf(M.C.max)}`],
    ['2. Após os descontos (mínimo 0)', `A ${nf(M.A.v)} · B ${nf(M.B.v)} · C ${nf(M.C.v)}`],
    ['3. Subtotal', nf(sc.subtotal)],
    [`4. Modalidades zeradas (${sc.zeroed} × −${nf(P.zeroPenalty)})`, sc.penalty ? `−${nf(sc.penalty)}` : '0'],
    ...(sc.adjust ? [['Ajuste manual da gestão', (sc.adjust > 0 ? '+' : '') + nf(sc.adjust)]] : []),
    ['5. Pontuação final (mínimo 0)', `<b>${nf(sc.score ?? sc.total)}</b>`]
  ];
  const total = sc.score ?? sc.total;
  if (sc.eligible === false) return `<div class="stack" style="gap:10px"><div class="row"><span class="avatar lg" style="background:var(--border2);color:var(--text3)">—</span><div><b>${opts.title || 'Pontuação do período'}</b><div class="tiny muted">${periodDates(key)}${sc.partial ? ' · em andamento' : ''}</div></div></div><div class="note">Sem posse de veículo no período: não há pontuação nem premiação. A pontuação começa a contar no recebimento de um veículo.</div>${opts.manage ? adjHistory(sc.adjustments || [], opts) : ''}</div>`;
  const prem = [
    ['Valor base', `${money(P.baseValue)} × ${nf(total)} ÷ 100 = <b>${money(sc.base)}</b>`],
    ['Adicional por desempenho', sc.add ? `<b>${money(sc.add)}</b> (${total >= 100 ? '100 pontos' : '90 a 99 pontos'})` : sc.addBlocked ? `— <span class="small muted">exige ${P.addMinDays} dias com posse (teve ${sc.possDays})</span>` : '— <span class="small muted">abaixo de 90 pontos</span>'],
    ['Premiação cheia', `<b>${money(sc.full)}</b>`],
    ['Fator de participação', `${fx} dias úteis = ${nf((sc.factor || 0) * 100, 1)}%`],
    ['Premiação a receber', `<b style="font-size:1.1rem;color:${sc.bonus ? 'var(--green)' : 'var(--text3)'}">${money(sc.bonus)}</b>`]
  ];
  const kv = rows => `<table class="tbl calc"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td class="r">${b}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="stack" style="gap:14px">
    <div class="row" style="justify-content:space-between"><div class="row">${ring(total)}<div><b>${opts.title || 'Pontuação do período'}</b><div class="tiny muted">${periodDates(key)}${sc.partial ? ' · parcial, até hoje' : ''}</div><div class="tiny muted">${sc.possDays} dia(s) com posse de ${sc.bizDays} dias úteis</div></div></div>
      <div style="text-align:right"><div class="tiny muted">${sc.partial ? 'Prêmio previsto' : 'Premiação'}</div><b style="font-size:1.25rem;color:${sc.bonus ? 'var(--green)' : 'var(--text3)'}">${money(sc.bonus)}</b></div></div>
    <div class="mods">${modsHTML}</div>
    <div class="panel" style="box-shadow:none"><div class="panel-h"><h3>Descontos e evidências</h3>${opts.manage && !opts.closed ? `<button class="btn sm" data-act="bn-occ-new" data-did="${opts.did}" data-p="${key}">${ic('plus')}Ocorrência</button><button class="btn sm" data-act="bn-adj-new" data-did="${opts.did}" data-p="${key}">Ajuste manual</button>` : ''}</div>
      ${tbl(['Data', 'Mod.', 'Motivo e evidência', '>Pontos', ...(opts.manage ? [''] : [])], occ.map(o => occRow(o, { ...opts, key })), 'Nenhum desconto no período.')}</div>
    ${sc.pending ? `<div class="note warn">${ic('check')}<div>Checklist diário de hoje ainda pendente: envie até ${P.deadline} para não ter desconto.</div></div>` : ''}
    <div class="grid2"><div class="panel" style="box-shadow:none"><div class="panel-h"><h3>Cálculo da pontuação</h3></div>${kv(steps)}</div>
      <div class="panel" style="box-shadow:none"><div class="panel-h"><h3>Cálculo da premiação</h3></div>${kv(prem)}</div></div>
    ${opts.manage ? adjHistory(sc.adjustments || [], opts) : ''}
  </div>`;
}
function adjHistory(list, opts) {
  if (!list.length) return '';
  const kind = { abono: 'Abono', ocorrencia: 'Ocorrência', ajuste: 'Ajuste' };
  return `<div class="panel" style="box-shadow:none"><div class="panel-h"><h3>Registros da gestão</h3><span class="small muted">não podem ser apagados; correções cancelam o registro</span></div>
    ${tbl(['Data', 'Tipo', 'Justificativa', '>Pontos', 'Por', ''], list.slice().sort((a, b) => b.createdAt - a.createdAt).map(a => `<tr class="${a.voidedAt ? 'abonado' : ''}"><td class="nowrap small">${fmtDT(a.createdAt)}</td><td>${kind[a.kind]}${a.modality ? ' ' + modPill(a.modality) : ''}</td>
      <td>${esc(a.reason)}${a.voidedAt ? `<div class="small" style="color:var(--red)">Cancelado em ${fmtDT(a.voidedAt)} por ${esc(userName(a.voidedBy))}: ${esc(a.voidReason || '')}</div>` : ''}</td><td class="r num">${a.kind === 'abono' ? '—' : (a.kind === 'ocorrencia' ? '−' + nf(Math.abs(a.points)) : (a.points > 0 ? '+' : '') + nf(a.points))}</td><td class="small">${esc(userName(a.createdBy))}</td>
      <td class="r">${!a.voidedAt && !opts.closed ? `<button class="btn sm danger" data-act="bn-void" data-id="${a.id}">Cancelar</button>` : ''}</td></tr>`))}</div>`;
}

/* ----- registros da gestão: abono, ocorrência e ajuste (exigem justificativa) ----- */
function newAdj(o) {
  const a = { id: uid(), driverId: o.driverId, period: o.period, kind: o.kind, modality: o.modality || null, key: o.key || null, points: o.points || 0, at: o.at || null, vehicleId: o.vehicleId || null, reason: o.reason, createdBy: CUR.id, createdAt: nowTs(), voidedAt: null, voidedBy: null, voidReason: null };
  (S.bonusAdj = S.bonusAdj || []).push(a);
  const lab = { abono: 'Abono', ocorrencia: `Ocorrência na modalidade ${o.modality} (−${nf(Math.abs(o.points))})`, ajuste: `Ajuste manual de ${o.points > 0 ? '+' : ''}${nf(o.points)} ponto(s)` }[o.kind];
  log('premiacao', `${lab} registrado por ${CUR.name} para ${drv(o.driverId)?.name || ''} (período ${periodDates(o.period)}): ${o.reason}`, { driverId: o.driverId });
  return a;
}
const closedGuard = key => { if (closingOf(key)) { toast('Período já fechado. O administrador precisa reabrir antes de alterar.'); return true; } return false; };
ACTIONS['bn-abonar'] = a => {
  if (closedGuard(a.dataset.p)) return;
  openModal({ title: 'Abonar desconto', body: `<p class="small">${esc(a.dataset.why)}</p><p class="small muted">Use para motivos alheios ao condutor (item 8 do regulamento): sistema fora do ar, falta de sinal informada no mesmo dia, veículo em manutenção ou sinistro, orientação por escrito do gestor.</p><label class="field"><span>Justificativa</span><textarea class="inp" id="bn-why"></textarea></label><p class="err" id="bn-err"></p>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="bn-abonar-ok" data-did="${a.dataset.did}" data-key="${esc(a.dataset.key)}" data-p="${a.dataset.p}">Abonar</button>` });
};
ACTIONS['bn-abonar-ok'] = a => {
  const r = $('#bn-why').value.trim(); if (r.length < 5) return $('#bn-err').textContent = 'Escreva a justificativa (mínimo 5 caracteres).';
  newAdj({ driverId: a.dataset.did, period: a.dataset.p, kind: 'abono', key: a.dataset.key, reason: r }); save(); closeModal(); toast('Desconto abonado.'); render();
};
ACTIONS['bn-occ-new'] = a => {
  const key = a.dataset.p; if (closedGuard(key)) return; const P = bonusP(key); const [from, to] = periodRange(key);
  openModal({ title: 'Registrar ocorrência', body: `<form id="bn-form" class="form-grid">
      ${a.dataset.did ? `<input type="hidden" name="driverId" value="${a.dataset.did}">` : `<label class="field full"><span>Condutor</span><select class="inp" name="driverId">${driverOptions('', d => !d._ro)}</select></label>`}
      <label class="field full"><span>Modalidade</span><select class="inp" name="modality" id="bn-mod"><option value="C">C · Abastecimento sem registro no aplicativo (extrato do cartão) ou foto ilegível (−${P.discC})</option><option value="A">A · Uso do veículo sem checklist de recebimento ou entrega (−${P.discA})</option><option value="B">B · Checklist diário (−${P.discAbsent})</option></select></label>
      <label class="field"><span>Data</span><input class="inp" type="date" name="date" value="${dateInput(Math.min(nowTs(), to - 1))}" min="${dateInput(from)}" max="${dateInput(to - 1)}"></label>
      <label class="field"><span>Veículo</span><select class="inp" name="vehicleId"><option value="">—</option>${S.vehicles.map(v => `<option value="${v.id}">${v.plate}</option>`).join('')}</select></label>
      <label class="field full"><span>Motivo e evidência</span><textarea class="inp" name="reason" placeholder="Ex.: abastecimento de 40 L no cartão em 12/10 às 15h, sem registro no aplicativo"></textarea></label>
      <p class="err full" id="bn-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="bn-occ-ok" data-p="${key}">Registrar</button>` });
};
ACTIONS['bn-occ-ok'] = a => {
  const key = a.dataset.p; const d = formData($('#bn-form')); const P = bonusP(key); const [from, to] = periodRange(key); const at = parseDate(d.date) + 12 * 36e5;
  if (!d.driverId) return $('#bn-err').textContent = 'Escolha o condutor.';
  if (!at || at < from || at >= to) return $('#bn-err').textContent = `A data precisa estar no período (${periodDates(key)}).`;
  if ((d.reason || '').length < 5) return $('#bn-err').textContent = 'Descreva o motivo e a evidência.';
  const pts = { A: P.discA, B: P.discAbsent, C: P.discC }[d.modality];
  newAdj({ driverId: d.driverId, period: key, kind: 'ocorrencia', modality: d.modality, points: pts, at, vehicleId: d.vehicleId || null, reason: d.reason });
  save(); closeModal(); toast('Ocorrência registrada.'); render();
};
ACTIONS['bn-adj-new'] = a => {
  const key = a.dataset.p; if (closedGuard(key)) return;
  openModal({ title: 'Ajuste manual de pontos', body: `<p class="small muted">Exige justificativa e fica registrado com seu nome, data e hora (item 10).</p><form id="bn-form" class="form-grid"><input type="hidden" name="driverId" value="${a.dataset.did}">
      <label class="field"><span>Pontos (+ ou −)</span><input class="inp num" name="points" placeholder="Ex.: 10 ou -10"></label>
      <label class="field full"><span>Justificativa</span><textarea class="inp" name="reason"></textarea></label><p class="err full" id="bn-err"></p></form>`,
    foot: `<button class="btn" data-act="modal-close">Cancelar</button><button class="btn ok" data-act="bn-adj-ok" data-p="${key}">Registrar</button>` });
};
ACTIONS['bn-adj-ok'] = a => {
  const d = formData($('#bn-form')); const pts = parseFloat(String(d.points).replace(',', '.'));
  if (!pts || Math.abs(pts) > 100) return $('#bn-err').textContent = 'Informe os pontos (entre −100 e 100, diferente de zero).';
  if ((d.reason || '').length < 5) return $('#bn-err').textContent = 'Escreva a justificativa.';
  newAdj({ driverId: d.driverId, period: a.dataset.p, kind: 'ajuste', points: pts, reason: d.reason }); save(); closeModal(); toast('Ajuste registrado.'); render();
};
ACTIONS['bn-void'] = a => {
  const x = byId(S.bonusAdj, a.dataset.id); if (closedGuard(x.period)) return;
  openModal({ title: 'Cancelar registro', body: `<p>${esc(x.reason)}</p><p class="small muted">O registro continua visível como cancelado.</p><label class="field"><span>Motivo do cancelamento</span><textarea class="inp" id="bn-why"></textarea></label><p class="err" id="bn-err"></p>`,
    foot: `<button class="btn" data-act="modal-close">Voltar</button><button class="btn danger" data-act="bn-void-ok" data-id="${x.id}">Cancelar registro</button>` });
};
ACTIONS['bn-void-ok'] = a => {
  const x = byId(S.bonusAdj, a.dataset.id); const r = $('#bn-why').value.trim(); if (r.length < 5) return $('#bn-err').textContent = 'Informe o motivo.';
  x.voidedAt = nowTs(); x.voidedBy = CUR.id; x.voidReason = r;
  log('premiacao', `Registro da premiação cancelado por ${CUR.name} (${drv(x.driverId)?.name || ''}): ${x.reason} — motivo: ${r}`, { driverId: x.driverId });
  save(); closeModal(); toast('Registro cancelado.'); render();
};

/* ----- página Premiação ----- */
let BON_P = null;
PAGES.bonificacao = {
  title: 'Premiação',
  render({ tab = 'ranking' }) {
    const M = isManager(); BON_P = BON_P || curPeriod(); const key = BON_P; const cur = key === curPeriod(); const c = closingOf(key);
    const tabs = `<div class="tabs">${[['ranking', 'Ranking do período'], ['ocorrencias', 'Descontos e abonos'], ['parametros', 'Parâmetros']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-go="bonificacao" data-tab="${k}">${l}</button>`).join('')}</div>`;
    const nav = `<div class="row" style="gap:8px"><button class="icon-btn" data-act="bn-p" data-d="-1" aria-label="Período anterior">${ic('back')}</button><div style="text-align:center;min-width:190px"><b style="text-transform:capitalize">${monthName(key)}</b><div class="tiny muted">${periodDates(key)}</div></div><button class="icon-btn" data-act="bn-p" data-d="1" aria-label="Próximo período" ${cur ? 'disabled' : ''}>${ic('chev')}</button>${cur ? pill('em andamento') : c ? pill('fechado', 'ok') : pill('aguardando fechamento', 'warn')}</div>`;
    if (tab === 'parametros') return `<div class="stack">${tabs}${paramsView(M)}</div>`;
    const list = rankList(key); const el = list.filter(x => x.sc.eligible);
    if (tab === 'ocorrencias') {
      const all = el.flatMap(({ d, sc }) => sc.occurrences.map(o => ({ d, o })));
      return `<div class="stack">${tabs}<div class="page-head" style="margin:0">${nav}${M && !c ? `<button class="btn pri" data-act="bn-occ-new" data-p="${key}">${ic('plus')}Registrar ocorrência</button>` : ''}</div>
        <div class="note">${ic('alert')}<div>Os descontos de entrega/recebimento, checklist diário e foto do hodômetro são identificados automaticamente pelos registros. Abastecimento <b>sem registro</b> no aplicativo é lançado pela gestão a partir do extrato do cartão combustível. Abonos exigem justificativa e o original fica visível.</div></div>
        <div class="panel">${tbl(['Condutor', 'Data', 'Mod.', 'Motivo e evidência', '>Pontos', ...(M ? [''] : [])], all.sort((a, b) => b.o.at - a.o.at).map(({ d, o }) => occRow(o, { manage: M, did: d.id, key, closed: !!c, who: d })), 'Nenhum desconto neste período.')}</div></div>`;
    }
    const medal = ['var(--u-green)', 'var(--text3)', 'var(--border)'];
    const totalPrev = sum(el, x => x.sc.bonus);
    return `<div class="stack">${tabs}<div class="page-head" style="margin:0">${nav}<button class="btn" data-go="relatorios" data-tab="premiacao">${ic('report')}Fechamento para o RH</button></div>
      <div class="kpis">${kpi('Média da equipe', el.length ? nf(sum(el, x => x.sc.total) / el.length, 0) : '—', 'gauge', 'c-blue', '', 'pontos')}${kpi('Com posse no período', `${el.length}`, 'user')}${kpi(cur ? 'Prêmios previstos' : 'Prêmios do período', money(totalPrev), 'star', 'c-green')}${kpi('Dias úteis', el[0]?.sc.bizDays ?? daysBetween(...periodRange(key)).filter(isBizDay).length, 'cal', '', '', cur ? 'no período' : '')}</div>
      ${el.length ? `<div class="grid3">${el.slice(0, 3).map(({ d, sc, pos }, i) => `<div class="vcard" data-go="condutor" data-id="${d.id}" data-tab="score" style="align-items:center;text-align:center;border-top:4px solid ${medal[Math.min(2, pos - 1)]}"><span class="pill ${pos === 1 ? 'ok' : ''}">${pos}º lugar</span>${av(d, 'lg')}<b>${esc(d.name)}</b>${ring(sc.total)}<b style="font-size:1.15rem;color:${sc.bonus ? 'var(--text)' : 'var(--text3)'}">${money(sc.bonus)}</b><span class="tiny muted">${sc.possDays}/${sc.bizDays} dias com posse</span></div>`).join('')}</div>` : ''}
      <div class="panel"><div class="panel-h"><h2>Condutores</h2><span class="small muted">A · B · C = entrega/recebimento · checklist diário · abastecimento</span></div>
        <div class="vlist">${list.map(({ d, sc, pos }) => `<div class="vrow" data-go="condutor" data-id="${d.id}" data-tab="score" style="grid-template-columns:30px auto 1fr auto auto"><b class="muted num">${pos ? pos + 'º' : '—'}</b>${sc.eligible ? ring(sc.total, true) : '<span class="avatar" style="background:var(--border2);color:var(--text3)">—</span>'}<div class="who2"><b>${esc(d.name)}</b>${sc.eligible ? `<div class="row" style="gap:3px;flex-wrap:nowrap;margin-top:5px">${Object.values(sc.mods).map(m => `<div class="bar s-${pctTone(m.v, m.max)}" style="flex:${m.max || 1};min-width:14px" title="${esc(m.l)}: ${nf(m.v)}/${m.max}"><i style="width:${m.max ? m.v / m.max * 100 : 0}%"></i></div>`).join('')}</div>` : '<small>Sem posse no período</small>'}</div><span class="small muted nowrap">${sc.possDays}/${sc.bizDays} dias</span><b class="num" style="min-width:86px;text-align:right;color:${sc.bonus ? 'var(--text)' : 'var(--text3)'}">${money(sc.bonus)}</b></div>`).join('') || '<div class="panel-b muted">Nenhum condutor ativo.</div>'}</div></div>
    </div>`;
  },
  mount({ tab }) { if (tab === 'parametros') mountParams(); }
};
ACTIONS['bn-p'] = a => { BON_P = shiftMonth(BON_P || curPeriod(), +a.dataset.d); if (BON_P > curPeriod()) BON_P = curPeriod(); render(); };

/* ----- parâmetros (item 11), com vigência e histórico ----- */
function paramsView(M) {
  const b = bonusCfg(); const cur = curPeriod(); const next = shiftMonth(cur, 1); const P = bonusP(cur); const Pn = bonusP(next); const dis = M ? '' : 'disabled';
  const changed = Object.keys(BONUS_DEF()).some(k => String(P[k]) !== String(Pn[k]));
  const field = k => { const [l, u] = PARAM_LABEL[k]; return `<label class="field"><span>${l}</span><div class="row" style="flex-wrap:nowrap;gap:6px">${u === 'R$' ? '<span class="small muted">R$</span>' : ''}<input class="inp num" name="${k}" value="${esc(Pn[k])}" ${k === 'deadline' ? 'type="time"' : 'inputmode="decimal"'} style="max-width:120px" ${dis}>${u && u !== 'R$' ? `<span class="small muted">${u}</span>` : ''}</div></label>`; };
  const yr = new Date().getFullYear();
  const hol = [...holidaysOf(yr), ...holidaysOf(yr + 1)].filter(h => h.date >= dayKey(nowTs() - 31 * DAY));
  return `<div class="panel"><div class="panel-h"><h2>Vigente no período atual</h2><span class="small muted">${periodName(cur)}</span></div>
      ${tbl(['Parâmetro', '>Valor'], Object.keys(PARAM_LABEL).map(k => `<tr><td>${PARAM_LABEL[k][0]}</td><td class="r num">${PARAM_LABEL[k][1] === 'R$' ? money(P[k]) : esc(P[k]) + (PARAM_LABEL[k][1] ? ' ' + PARAM_LABEL[k][1] : '')}</td></tr>`))}
      <div class="panel-b small muted">Premiação = (valor base × pontuação ÷ 100 + adicional) × dias com posse ÷ dias úteis. Adicional só para quem teve posse em ${P.addMinDays} dias ou mais.</div></div>
    <form class="panel" id="bp-form"><div class="panel-h"><h2>Alterar parâmetros</h2><span class="pill ${changed ? 'warn' : ''}">vale a partir de ${periodName(next)}</span></div>
      <div class="panel-b form-grid three">${Object.keys(PARAM_LABEL).map(field).join('')}</div>
      <div class="panel-b"><p class="small muted">Pelo regulamento, qualquer alteração só vale a partir do período seguinte à divulgação e fica registrada com data e responsável.</p><p class="err" id="bp-err"></p>${M ? '<button class="btn ok">Salvar para o próximo período</button>' : '<p class="muted small">Somente o gestor de frota ou o administrador altera os parâmetros.</p>'}</div></form>
    <div class="grid2">
      <div class="panel"><div class="panel-h"><h3>Feriados (dias que não são úteis)</h3></div><div class="panel-b stack" style="gap:8px">
        <div class="small muted">Feriados nacionais entram automaticamente. Inclua os municipais e estaduais das obras.</div>
        <div class="vlist">${hol.map(h => `<div class="row small" style="justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border2)"><span><b class="num">${fmtDate(parseDate(h.date))}</b> · ${esc(h.name)}</span>${h.national ? '<span class="muted tiny">nacional</span>' : M ? `<button class="btn sm danger" data-act="hol-del" data-d="${h.date}">Remover</button>` : ''}</div>`).join('')}</div>
        ${M ? `<div class="row"><input class="inp" type="date" id="hol-d" style="max-width:170px"><input class="inp" id="hol-n" placeholder="Nome do feriado" style="flex:1;min-width:140px"><button class="btn" data-act="hol-add">${ic('plus')}Incluir</button></div>` : ''}</div></div>
      <div class="panel"><div class="panel-h"><h3>Fechamento e divulgação</h3></div><div class="panel-b stack" style="gap:10px">
        <label class="row small" style="gap:8px"><span class="toggle"><input type="checkbox" id="cl-auto" ${b.closing.auto ? 'checked' : ''} ${dis}><i></i></span>Fechamento automático na data de divulgação</label>
        <div class="small muted">O período termina no dia ${P.startDay > 1 ? P.startDay - 1 : 'último'}; o extrato é fechado e liberado aos condutores ${P.releaseDays} dia(s) depois (próxima: ${fmtDate(releaseAt(cur))}). A gestão pode fechar antes em Relatórios › Fechamento da premiação; o condutor só vê o extrato na data de divulgação.</div>
        <div class="tiny muted">Programa iniciado no período ${b.startPeriod ? periodName(b.startPeriod) : '—'}. Foto do hodômetro exigida nos abastecimentos desde ${b.odoSince ? fmtDT(b.odoSince) : '—'}.</div></div></div>
    </div>
    <div class="panel"><div class="panel-h"><h3>Histórico de versões</h3></div>${tbl(['Vale a partir de', 'Registrada em', 'Por', 'Alterações'], b.versions.slice().sort((x, y) => x.from < y.from ? 1 : -1).map((v, i, arr) => { const prev = arr[i + 1]; const diff = prev ? Object.keys(PARAM_LABEL).filter(k => String(v.p[k]) !== String(prev.p[k])).map(k => `${PARAM_LABEL[k][0]}: ${esc(prev.p[k])} → ${esc(v.p[k])}`).join('<br>') : 'Versão inicial (regulamento versão 00)'; return `<tr><td class="nowrap">${periodName(v.from)}</td><td class="nowrap small">${fmtDT(v.at)}</td><td class="small">${esc(userName(v.by))}</td><td class="small">${diff || '—'}</td></tr>`; }))}</div>`;
}
function mountParams() {
  $('#cl-auto')?.addEventListener('change', e => { if (!isManager()) return; bonusCfg().closing.auto = e.target.checked; log('config', `Fechamento automático da premiação ${e.target.checked ? 'ligado' : 'desligado'} por ${CUR.name}`, {}); save(); toast('Configuração salva.'); });
  const f = $('#bp-form'); if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault(); if (!isManager()) return; const d = formData(f); const err = t => $('#bp-err').textContent = t;
    const next = shiftMonth(curPeriod(), 1); const p = {};
    for (const k of Object.keys(PARAM_LABEL)) {
      if (k === 'deadline') { if (!/^\d{2}:\d{2}$/.test(d.deadline)) return err('Horário limite inválido.'); p.deadline = d.deadline; continue; }
      const n = parseFloat(String(d[k]).replace(/\./g, '').replace(',', '.')); if (isNaN(n) || n < 0) return err(`${PARAM_LABEL[k][0]}: valor inválido.`); p[k] = n;
    }
    if (p.startDay < 1 || p.startDay > 28) return err('O dia de início do período deve ser de 1 a 28.');
    if (p.ptsA + p.ptsB + p.ptsC !== 100) return err(`A soma dos pontos das modalidades deve ser 100 (está ${p.ptsA + p.ptsB + p.ptsC}).`);
    const b = bonusCfg(); const old = bonusP(next);
    if (!Object.keys(p).some(k => String(p[k]) !== String(old[k]))) return err('Nenhuma alteração.');
    b.versions = b.versions.filter(v => v.from !== next); b.versions.push({ from: next, at: nowTs(), by: CUR.id, p });
    log('config', `Parâmetros da premiação alterados por ${CUR.name}, válidos a partir de ${periodName(next)}`, {});
    save(); toast(`Parâmetros salvos. Valem a partir de ${monthName(next)}.`); render();
  });
}
ACTIONS['hol-add'] = () => {
  const d = $('#hol-d').value; const n = $('#hol-n').value.trim(); if (!d || n.length < 3) return toast('Informe a data e o nome do feriado.');
  const b = bonusCfg(); if (b.holidays.some(h => h.date === d)) return toast('Este dia já está na lista.');
  const key = periodOf(parseDate(d)); if (closingOf(key)) return toast('Esse dia pertence a um período já fechado.');
  b.holidays.push({ date: d, name: n, by: CUR.id, at: nowTs() }); b.holidays.sort((x, y) => x.date < y.date ? -1 : 1);
  log('config', `Feriado incluído por ${CUR.name}: ${fmtDate(parseDate(d))} (${n})`, {}); save(); render();
};
ACTIONS['hol-del'] = a => {
  const b = bonusCfg(); const h = b.holidays.find(x => x.date === a.dataset.d); if (!h) return;
  if (closingOf(periodOf(parseDate(h.date)))) return toast('Esse dia pertence a um período já fechado.');
  b.holidays = b.holidays.filter(x => x !== h); log('config', `Feriado removido por ${CUR.name}: ${fmtDate(parseDate(h.date))} (${h.name})`, {}); save(); render();
};

/* ----- condutor: extratos divulgados (fechados) ----- */
let MY_ST = null;
async function loadMyStatements() {
  try { const { data, error } = await CLOUD.client().rpc('my_bonus_statements'); if (error) throw error; MY_ST = data || []; } catch (e) { MY_ST = []; }
}
ACTIONS['my-score'] = async () => {
  const sc = driverScore(CUR.driverId);
  const el = openModal({ title: 'Minha pontuação', wide: true, body: `${statementHTML(sc, { title: 'Período atual' })}<div id="my-st" class="stack" style="margin-top:16px"><p class="small muted">Carregando extratos fechados…</p></div>` });
  await loadMyStatements(); const box = el.querySelector('#my-st'); if (!box) return;
  box.innerHTML = MY_ST.length ? `<h3>Extratos fechados</h3>${MY_ST.map(s => `<details class="panel" style="box-shadow:none"><summary class="panel-h" style="cursor:pointer"><b>${periodName(s.month)}</b><span class="row"><span class="num">${nf(s.statement.score)} pts</span><b class="num">${money(s.statement.bonus)}</b></span></summary><div class="panel-b">${statementHTML({ ...s.statement, key: s.month, total: s.statement.score, partial: false, eligible: true }, { title: 'Extrato do período' })}</div></details>`).join('')}`
    : '<p class="small muted">Nenhum extrato fechado divulgado ainda. O extrato do período sai 3 dias após o fechamento (dia 25).</p>';
};
