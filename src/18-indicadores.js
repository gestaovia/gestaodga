/* ===================== Indicadores mensais da frota (v1.8.0) =====================
   Tudo é calculado a partir dos registros do sistema (abastecimentos, manutenção, posses, checklists,
   multas, pedágios, documentação, locação e problemas informados). Nada é estimado ou simulado:
   onde falta dado, o indicador mostra "sem dados" e a lista "Dados a completar" diz o que registrar.

   Regras (as mesmas em todos os gráficos):
   - Período: mês do calendário (dia 1 ao último dia). No mês atual, até hoje.
   - Custos: a mesma base dos relatórios (periodCosts) + locação proporcional aos dias do contrato no mês
     + custo informado nos problemas/incidentes. Cada registro entra uma única vez.
   - Obra de cada custo: abastecimento = obra registrada; manutenção, multa, pedágio e incidente = obra da posse
     naquele horário; locação = dividida pelo tempo de posse em cada obra (tempo parado fica "Sem obra").
   - Km rodados: trechos de posse (km inicial → km final), divididos pelo tempo em cada obra.
   - Custo por km = (combustível + manutenção) ÷ km rodados. Sem km no mês, o veículo não entra na média.
   - Consumo (km/l) = distância entre leituras de abastecimentos consecutivos ÷ litros. Leituras com km menor
     ou igual à anterior são descartadas.
   - Utilização = dias úteis com o veículo em posse de um condutor ÷ dias úteis disponíveis
     (cadastrado e fora de manutenção). Dias úteis = segunda a sexta, sem feriados (mesma regra da premiação).
   - Preventiva em dia = tarefas que venceram no mês e foram feitas até o vencimento ÷ tarefas que venceram no mês.
     Vencimento = o que vier primeiro: data (última + intervalo em dias) ou km (última + intervalo em km,
     no dia em que a leitura de km alcançou esse valor). Tarefas que ainda não venceram não contam. */

let KPI_TREND = null;
const KPI_F = { m: null, p: '', v: '', o: '', u: '' }; // mês AAAA-MM, obra ('_' = sem obra), veículo, tipo de frota ('propria' | 'locada'), uso ('obra' | 'comercial')
const KPI_CATS = [['fuel', 'Combustível'], ['maint', 'Manutenção'], ['rent', 'Locação'], ['fines', 'Multas'], ['inc', 'Incidentes'], ['other', 'Outros']];
const KIND_CAT = { 'Combustível': 'fuel', 'Manutenção': 'maint', 'Locação': 'rent', 'Multas': 'fines', 'Incidentes': 'inc', 'Pedágios': 'other', 'Documentação': 'other' };
const CAT_VAR = Object.fromEntries(KPI_CATS.map(([k], i) => [k, `var(--viz-${i + 1})`]));
const isLeased = v => v?.ownership === 'locada';
const ownVar = v => isLeased(v) ? 'var(--viz-2)' : 'var(--viz-1)';
const ownName = v => isLeased(v) ? 'Locada' : 'Própria';
const shortMonth = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)}${String(y).slice(2) !== String(new Date().getFullYear()).slice(2) ? '/' + String(y).slice(2) : ''}`; };
const kmFmt = n => `${nf(n)} km`;
const kmlFmt = n => n == null ? '—' : `${nf(n, 1)} km/l`;
const rkmFmt = n => n == null ? '—' : `${money(n)}/km`;
const pctFmt = n => n == null ? '—' : `${nf(n, 0)}%`;
const moneyShort = n => Math.abs(n) >= 1e6 ? `R$ ${nf(n / 1e6, 1)} mi` : Math.abs(n) >= 1e4 ? `R$ ${nf(n / 1e3, 0)} mil` : money(n);

/* ---------- linhas de custo do mês (uma por registro) ---------- */
function rentalRows(from, to) {
  // locação proporcional aos dias do contrato no mês (no mês atual, até hoje), dividida pela posse em cada obra
  const rows = []; const end = Math.min(to, nowTs());
  S.vehicles.filter(v => isLeased(v) && v.rental?.monthly).forEach(v => {
    const r = v.rental; const a = Math.max(from, r.pickupDate || from), b = Math.min(end, r.returnedAt || end);
    if (b <= a) return;
    const value = r.monthly * (b - a) / (to - from); const per = {}; let used = 0;
    S.custody.filter(c => c.vehicleId === v.id).forEach(c => {
      const ce = c.end || nowTs(); const segs = c.segments.length ? c.segments : [{ at: c.start, projectId: null }];
      segs.forEach((s, i) => { const sa = Math.max(i ? s.at : c.start, a), sb = Math.min(segs[i + 1]?.at ?? ce, ce, b); if (sb > sa) { per[s.projectId || '_'] = (per[s.projectId || '_'] || 0) + (sb - sa); used += sb - sa; } });
    });
    const span = b - a; per._ = (per._ || 0) + Math.max(0, span - used);
    Object.entries(per).forEach(([pid, ms]) => { if (ms > 0) rows.push({ kind: 'Locação', value: value * ms / span, vehicleId: v.id, driverId: null, projectId: pid === '_' ? null : pid }); });
  });
  return rows;
}
function incidentRows(from, to) {
  return S.issues.filter(i => i.at >= from && i.at < to && +i.cost > 0).map(i => { const c = custodyAt(i.vehicleId, i.at); return { kind: 'Incidentes', value: +i.cost, vehicleId: i.vehicleId, driverId: i.driverId || null, projectId: c ? segmentAt(c, i.at)?.projectId || null : null, issueId: i.id }; });
}
const kpiRows = (from, to) => [...periodCosts(from, to), ...rentalRows(from, to), ...incidentRows(from, to)].map(r => ({ ...r, cat: KIND_CAT[r.kind] || 'other' })).filter(r => +r.value);

/* ---------- filtros ---------- */
const kpiVehPass = v => !!v && (!KPI_F.v || v.id === KPI_F.v) && (!KPI_F.o || (KPI_F.o === 'locada') === isLeased(v)) && (!KPI_F.u || vFleet(v) === KPI_F.u);
const kpiProjPass = pid => !KPI_F.p || (KPI_F.p === '_' ? !pid : pid === KPI_F.p);
const kpiRowPass = r => (!KPI_F.v && !KPI_F.o && !KPI_F.u ? true : kpiVehPass(veh(r.vehicleId))) && kpiProjPass(r.projectId);

/* km de cada veículo em cada obra no período (posse dividida pelo tempo em cada obra) */
function kmSplit(from, to) {
  const out = {};
  S.custody.forEach(c => {
    const end = c.end || nowTs(); const v = veh(c.vehicleId); if (!v || end <= c.start) return;
    const endKm = c.endKm ?? v.odometer ?? c.startKm; const total = endKm - c.startKm; if (!(total > 0)) return;
    const perMs = total / (end - c.start); const segs = c.segments.length ? c.segments : [{ at: c.start, projectId: null }];
    segs.forEach((s, i) => {
      const a = Math.max(i ? s.at : c.start, from), b = Math.min(segs[i + 1]?.at ?? end, end, to);
      if (b > a) { const m = out[v.id] || (out[v.id] = {}); m[s.projectId || '_'] = (m[s.projectId || '_'] || 0) + perMs * (b - a); }
    });
  });
  return out;
}

/* ---------- consumo ---------- */
function fuelEff(vid, from, to) {
  const all = S.fuel.filter(f => f.vehicleId === vid).sort((a, b) => a.at - b.at);
  let dist = 0, liters = 0, n = 0, bad = 0;
  all.forEach((f, i) => {
    if (f.at < from || f.at >= to || !kpiProjPass(f.projectId)) return;
    const prev = all[i - 1]; if (!prev) return;
    const d = f.km - prev.km;
    if (!(d > 0) || !(f.liters > 0)) { bad++; return; }
    dist += d; liters += f.liters; n++;
  });
  return { dist, liters, n, bad, kmL: liters > 0 ? dist / liters : null };
}

/* ---------- utilização ---------- */
function maintIntervals(v) {
  const ks = S.checklists.filter(k => k.vehicleId === v.id && ['manut_entrada', 'manut_saida'].includes(k.type)).sort((a, b) => a.at - b.at);
  const out = []; let open = null;
  ks.forEach(k => { if (k.type === 'manut_entrada') open = open ?? k.at; else if (open != null) { out.push([open, k.at]); open = null; } });
  if (v.maintenance) out.push([v.maintenanceSince || open || 0, Infinity]); else if (open != null) out.push([open, Infinity]);
  return out;
}
function utilization(v, from, to) {
  const end = Math.min(to, nowTs());
  const reg = Math.min(...S.qrcodes.filter(q => q.vehicleId === v.id && q.createdAt).map(q => q.createdAt), ...S.custody.filter(c => c.vehicleId === v.id).map(c => c.start));
  const mi = maintIntervals(v); const cs = S.custody.filter(c => c.vehicleId === v.id);
  let avail = 0, used = 0, maint = 0;
  daysBetween(from, end).filter(isBizDay).forEach(d => {
    const de = nextDay(d); const noon = d + 12 * 36e5;
    if (isFinite(reg) && de <= reg) return;                         // ainda não cadastrado
    if (mi.some(([a, b]) => a <= noon && b > noon)) { maint++; return; } // em manutenção nesse dia
    avail++;
    if (cs.some(c => c.start < de && (c.end || nowTs()) > d)) used++;
  });
  return { avail, used, maint, pct: avail ? used / avail * 100 : null };
}

/* ---------- manutenção preventiva ---------- */
function odoPoints(vid) {
  const pts = [];
  S.checklists.forEach(k => { if (k.vehicleId === vid && k.km) pts.push([k.at, k.km]); });
  S.fuel.forEach(f => { if (f.vehicleId === vid && f.km) pts.push([f.at, f.km]); });
  S.custody.forEach(c => { if (c.vehicleId === vid) { if (c.startKm) pts.push([c.start, c.startKm]); if (c.end && c.endKm) pts.push([c.end, c.endKm]); } });
  S.maintRecords.forEach(r => { if (r.vehicleId === vid && r.km) pts.push([r.at, r.km]); });
  return pts.sort((a, b) => a[0] - b[0]);
}
function kmReachedAt(pts, v, km) { const p = pts.find(x => x[1] >= km); if (p) return p[0]; return v.odometer >= km ? nowTs() : null; }
// todas as tarefas preventivas (ciclos do plano) de um veículo, com vencimento e situação
function prevTasks(v) {
  const out = []; const pts = odoPoints(v.id);
  S.plans.filter(p => p.vehicleId === v.id && (p.everyKm || p.everyDays)).forEach(p => {
    const recs = S.maintRecords.filter(r => r.vehicleId === v.id && (r.items || []).includes(p.item)).sort((a, b) => a.at - b.at);
    const b0 = recs.length ? recs[0].planPrev?.[p.id] : { lastKm: p.lastKm, lastDate: p.lastDate };
    const bases = [];
    if (b0 && (b0.lastKm != null || b0.lastDate)) bases.push({ km: b0.lastKm, at: b0.lastDate });
    recs.forEach(r => bases.push({ km: r.km, at: r.at, rec: r }));
    bases.forEach((b, i) => {
      const dueKm = p.everyKm && b.km != null ? b.km + p.everyKm : null;
      const dueDate = p.everyDays && b.at ? startOfDay(b.at) + p.everyDays * DAY : null;
      const kmAt = dueKm != null ? kmReachedAt(pts, v, dueKm) : null;
      const cands = [dueDate, kmAt].filter(x => x != null); if (!cands.length) return; // ainda não venceu (km não alcançado)
      const dueAt = Math.min(...cands); const done = bases[i + 1]?.rec || null;
      const onTime = !!done && (done.at < startOfDay(dueAt) + DAY || (dueKm != null && done.km <= dueKm && (dueDate == null || done.at < dueDate + DAY)));
      out.push({ p, v, dueAt, dueKm, dueDate, done, onTime, byKm: kmAt != null && kmAt === dueAt });
    });
  });
  return out;
}

/* ---------- dados do mês com os filtros ---------- */
function kpiCompute(key) {
  const [from, to] = monthRange(key); const now = nowTs(); const cut = Math.min(to, now);
  const rows = kpiRows(from, to).filter(kpiRowPass);
  const split = kmSplit(from, to);
  const kmOf = vid => { const m = split[vid] || {}; return KPI_F.p ? (m[KPI_F.p] || 0) : sum(Object.values(m), x => x); };
  // veículos no recorte: filtro de veículo/tipo; com filtro de obra, só os que rodaram ou tiveram custo naquela obra
  const vehs = S.vehicles.filter(kpiVehPass).filter(v => !KPI_F.p || kmOf(v.id) > 0 || rows.some(r => r.vehicleId === v.id));
  const per = vehs.map(v => {
    const vr = rows.filter(r => r.vehicleId === v.id);
    const fuel = sum(vr.filter(r => r.cat === 'fuel'), r => r.value), maint = sum(vr.filter(r => r.cat === 'maint'), r => r.value);
    const km = Math.max(0, kmOf(v.id)); const fe = fuelEff(v.id, from, to); const ut = utilization(v, from, to);
    const ref = vehicleAvgKmL(v.id, from) || v.avgKmL || null;
    const high = fe.n >= 2 && ref && fe.kmL < ref * (1 - S.settings.fuelDeviationPct / 100);
    return { v, km, fuel, maint, total: sum(vr, r => r.value), costKm: km > 0 ? (fuel + maint) / km : null, noKm: km <= 0 && fuel + maint > 0, fe, ref, high, ut };
  });
  const withKm = per.filter(x => x.km > 0);
  const byOwn = own => { const l = withKm.filter(x => isLeased(x.v) === own); const k = sum(l, x => x.km); return k ? sum(l, x => x.fuel + x.maint) / k : null; };
  const dist = sum(per, x => x.fe.dist), lit = sum(per, x => x.fe.liters);
  // preventiva
  const tasks = vehs.flatMap(prevTasks);
  const due = tasks.filter(t => t.dueAt >= from && t.dueAt < to && t.dueAt <= now);
  const dueOk = due.filter(t => t.onTime);
  const openAtEnd = tasks.filter(t => t.dueAt < cut && (!t.done || t.done.at >= cut)).sort((a, b) => a.dueAt - b.dueAt);
  // multas e incidentes do mês
  const fines = liveFines().filter(f => f.at >= from && f.at < to).map(f => ({ f, m: fineMatch(f) })).filter(({ m }) => kpiRowPass({ vehicleId: m.vehicleId, projectId: m.projectId }));
  const incs = S.issues.filter(i => i.at >= from && i.at < to).map(i => { const c = custodyAt(i.vehicleId, i.at); return { i, projectId: c ? segmentAt(c, i.at)?.projectId || null : null }; })
    .filter(x => kpiRowPass({ vehicleId: x.i.vehicleId, projectId: x.projectId }));
  return {
    key, from, to, rows, per, vehs, total: sum(rows, r => r.value),
    costKm: sum(withKm, x => x.km) ? sum(withKm, x => x.fuel + x.maint) / sum(withKm, x => x.km) : null, costKmOwn: byOwn(false), costKmLeased: byOwn(true),
    kmL: lit > 0 ? dist / lit : null, km: sum(per, x => x.km),
    due, dueOk, compliance: due.length ? dueOk.length / due.length * 100 : null, openAtEnd,
    fines, incs
  };
}
function kpiMonthTotals(key) {
  const [from, to] = monthRange(key); const rows = kpiRows(from, to).filter(kpiRowPass);
  const o = Object.fromEntries(KPI_CATS.map(([k]) => [k, 0])); rows.forEach(r => { o[r.cat] += r.value; });
  o.total = sum(rows, r => r.value); o.key = key; return o;
}
function kpiFirstMonth() {
  const ts = [...S.fuel.map(f => f.at), ...S.maintRecords.map(r => r.at), ...liveFines().map(f => f.at), ...S.tolls.map(t => t.at), ...S.custody.map(c => c.start), ...S.issues.map(i => i.at)].filter(Boolean);
  return ts.length ? monthKey(Math.min(...ts)) : monthKey(nowTs());
}

/* ===================== componentes visuais ===================== */
const tipAttr = lines => `data-tip="${esc(lines.filter(Boolean).join('\n'))}" tabindex="0"`;
function vizEmpty(t, hint = '') { return `<div class="viz-empty">${ic('report')}<div><b>${t}</b>${hint ? `<span>${hint}</span>` : ''}</div></div>`; }
function statTile(label, value, sub = '', delta = '') { return `<div class="stat"><span class="stat-l">${label}</span><span class="stat-v">${value}</span>${delta}${sub ? `<span class="stat-s">${sub}</span>` : ''}</div>`; }
function deltaTag(cur, prev, label) {
  if (!prev || cur == null) return '';
  const d = (cur - prev) / prev * 100; const big = Math.abs(d) >= 10;
  const cls = !big ? 'flat' : d > 0 ? 'up' : 'down';
  return `<span class="delta ${cls}" title="Comparado com ${label}">${ic(d >= 0 ? 'up' : 'down')}${d > 0 ? '+' : ''}${nf(d, 0)}% <span>vs ${label}</span></span>`;
}
// barras horizontais: items = [{ label, sub, value, color, valueTxt, tip, flag, strong }]
function hbars(items, { fmt = money, legend = '' } = {}) {
  if (!items.length) return '';
  const max = Math.max(...items.map(x => x.value), 0) || 1;
  return `${legend}<ul class="hb">${items.map(x => `<li class="${x.strong ? 'strong' : ''}" ${tipAttr(x.tip || [x.label, x.valueTxt || fmt(x.value)])}>
    <div class="hb-l"><span class="hb-n">${x.label}</span>${x.sub ? `<span class="hb-s">${x.sub}</span>` : ''}</div>
    <div class="hb-t"><i style="width:${Math.max(x.value > 0 ? 1.5 : 0, x.value / max * 100)}%;background:${x.color || 'var(--viz-1)'}"></i><b>${x.valueTxt || fmt(x.value)}</b>${x.flag || ''}</div></li>`).join('')}</ul>`;
}
const legendHTML = list => `<div class="viz-legend">${list.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>`;
const ownLegend = () => legendHTML([['var(--viz-1)', 'Própria'], ['var(--viz-2)', 'Locada']]);
const tableView = (head, rows) => rows.length ? `<details class="viz-tbl"><summary>Ver tabela</summary>${tbl(head, rows)}</details>` : '';
function panel(title, sub, body, extra = '') { return `<section class="panel viz-panel"><div class="panel-h"><div><h3>${title}</h3>${sub ? `<p class="viz-sub">${sub}</p>` : ''}</div>${extra}</div><div class="panel-b">${body}</div></section>`; }

/* gráfico de colunas empilhadas (evolução mensal) em SVG */
function trendChart(months, curKey, W = 640) {
  W = Math.max(280, Math.round(W)); const H = W < 480 ? 200 : 240, L = 46, R = 8, T = 20, B = 26; const pw = W - L - R, ph = H - T - B;
  const maxV = Math.max(...months.map(m => m.total), 0);
  const step = niceStep(maxV / 4 || 1); const top = Math.max(step, Math.ceil(maxV / step) * step);
  const band = pw / months.length; const bw = Math.min(24, band * 0.62);
  const y = v => T + ph - v / top * ph;
  const ticks = []; for (let t = 0; t <= top + 1e-9; t += step) ticks.push(t);
  const grid = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="g"/><text x="${L - 6}" y="${y(t) + 3.5}" class="yt">${compactBRL(t)}</text>`).join('');
  const cols = months.map((m, i) => {
    const x = L + band * i + (band - bw) / 2; let acc = 0; const segs = [];
    const present = KPI_CATS.filter(([k]) => m[k] > 0);
    present.forEach(([k], j) => {
      const h = m[k] / top * ph; const yy = y(acc + m[k]); const isTop = j === present.length - 1;
      const gap = j > 0 ? 2 : 0; // 2px de espaço entre segmentos
      const hh = Math.max(0, h - gap);
      segs.push(isTop ? `<path d="${roundTop(x, yy, bw, hh)}" fill="${CAT_VAR[k]}"/>` : `<rect x="${x}" y="${yy}" width="${bw}" height="${hh}" fill="${CAT_VAR[k]}"/>`);
      acc += m[k];
    });
    const cur = m.key === curKey;
    const tip = [`${cap(monthName(m.key))}: ${money(m.total)}`, ...KPI_CATS.filter(([k]) => m[k] > 0).map(([k, l]) => `${l}: ${money(m[k])}`)];
    return `<g class="col ${cur ? 'cur' : ''}" ${tipAttr(tip)}><rect class="hit" x="${L + band * i}" y="${T}" width="${band}" height="${ph + B}"/>${segs.join('')}
      ${cur && m.total ? `<text x="${x + bw / 2}" y="${y(m.total) - 6}" class="cap">${moneyShort(m.total)}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 8}" class="xt ${cur ? 'on' : ''}">${shortMonth(m.key)}</text></g>`;
  }).join('');
  return `<svg class="trend" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Custo operacional por mês">${grid}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="base"/>${cols}</svg>`;
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function compactBRL(v) { return v >= 1e6 ? `${nf(v / 1e6, 1)} mi` : v >= 1e3 ? `${nf(v / 1e3, v % 1e3 ? 1 : 0)} mil` : nf(v); }
function roundTop(x, y, w, h) { const r = Math.min(4, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
function meter(pct) {
  const tone = pct >= 90 ? ['ok', 'Em dia', 'check'] : pct >= 70 ? ['warn', 'Atenção', 'alert'] : ['bad', 'Crítico', 'alert'];
  return `<div class="meter ${tone[0]}"><div class="meter-top"><span class="meter-v">${nf(pct, 0)}%</span><span class="meter-st">${ic(tone[2])}${tone[1]}</span></div><div class="meter-t"><i style="width:${Math.max(1, Math.min(100, pct))}%"></i></div><div class="meter-sc"><span>0</span><span>70</span><span>90</span><span>100%</span></div></div>`;
}

/* ===================== tela ===================== */
PAGES.indicadores = {
  title: 'Indicadores',
  render() {
    if (!KPI_F.m) KPI_F.m = monthKey(nowTs());
    const key = KPI_F.m; const curMonth = monthKey(nowTs()); const first = kpiFirstMonth();
    const K = kpiCompute(key); const prevKey = shiftMonth(key, -1);
    const partial = key === curMonth;
    // mês atual (parcial): compara com o mesmo período do mês anterior (do dia 1 até o mesmo dia e hora)
    const [pf] = monthRange(prevKey); const prevTot = partial ? sum(kpiRows(pf, Math.min(monthRange(prevKey)[1], pf + (nowTs() - K.from))).filter(kpiRowPass), r => r.value) : kpiMonthTotals(prevKey).total;
    const prevLabel = partial ? `1–${new Date().getDate()} ${MONTHS[+prevKey.slice(5) - 1].slice(0, 3)}` : MONTHS[+prevKey.slice(5) - 1];
    const sel = (id, all, opts) => `<select class="inp" id="${id}">${`<option value="">${all}</option>`}${opts}</select>`;
    const projOpts = S.projects.map(p => `<option value="${p.id}" ${KPI_F.p === p.id ? 'selected' : ''}>${esc(p.code)}</option>`).join('') + `<option value="_" ${KPI_F.p === '_' ? 'selected' : ''}>Sem obra</option>`;
    const vehOpts = S.vehicles.slice().sort((a, b) => a.plate.localeCompare(b.plate)).map(v => `<option value="${v.id}" ${KPI_F.v === v.id ? 'selected' : ''}>${esc(v.plate)}</option>`).join('');
    const nFil = [KPI_F.p, KPI_F.v, KPI_F.o, KPI_F.u].filter(Boolean).length;
    const head = `<div class="viz-filters">
      <div class="viz-month"><button class="icon-btn" data-act="kpi-m" data-d="-1" aria-label="Mês anterior" ${key <= first ? 'disabled' : ''}>${ic('back')}</button><b>${cap(monthName(key))}</b><button class="icon-btn" data-act="kpi-m" data-d="1" aria-label="Próximo mês" style="transform:scaleX(-1)" ${key >= curMonth ? 'disabled' : ''}>${ic('back')}</button>${partial ? '<span class="pill">parcial · até hoje</span>' : `<button class="btn sm" data-act="kpi-m" data-d="0">Mês atual</button>`}</div>
      <div class="viz-sel">${sel('kf-p', 'Todas as obras', projOpts)}${sel('kf-v', 'Todos os veículos', vehOpts)}${sel('kf-o', 'Própria e locada', `<option value="propria" ${KPI_F.o === 'propria' ? 'selected' : ''}>Própria</option><option value="locada" ${KPI_F.o === 'locada' ? 'selected' : ''}>Locada</option>`)}${sel('kf-u', 'Obra e comercial', `<option value="obra" ${KPI_F.u === 'obra' ? 'selected' : ''}>Frota de obra</option><option value="comercial" ${KPI_F.u === 'comercial' ? 'selected' : ''}>Frota comercial</option>`)}${nFil ? '<button class="btn sm" data-act="kpi-clear">Limpar</button>' : ''}</div></div>`;

    /* 1 · resumo */
    const cards = `<div class="stats">
      ${statTile('Custo total da frota', K.total ? money(K.total) : '—', K.total ? '' : 'Sem custos no mês', deltaTag(K.total, prevTot, prevLabel))}
      ${statTile('Custo médio por km', K.costKm != null ? rkmFmt(K.costKm) : '—', K.costKm != null ? 'Combustível + manutenção' : 'Sem km rodados')}
      ${statTile('Consumo médio', K.kmL != null ? kmlFmt(K.kmL) : '—', K.kmL != null ? `${nf(sum(K.per, x => x.fe.n))} abastecimento(s) válidos` : 'Sem leituras válidas')}
      ${statTile('Preventiva em dia', K.compliance != null ? pctFmt(K.compliance) : '—', K.compliance != null ? `${K.dueOk.length} de ${K.due.length} no prazo` : 'Nenhuma venceu no mês')}
    </div>`;

    /* 2 · custos */
    const byProj = {}; K.rows.forEach(r => { const k = r.projectId || '_'; const o = byProj[k] || (byProj[k] = { total: 0, cats: {} }); o.total += r.value; o.cats[r.cat] = (o.cats[r.cat] || 0) + r.value; });
    const projItems = Object.entries(byProj).sort((a, b) => b[1].total - a[1].total).map(([pid, o]) => ({
      label: pid === '_' ? 'Sem obra' : esc(prj(pid)?.code || '—'), sub: pid === '_' ? 'Sem posse no horário' : esc(prj(pid)?.name || ''), value: o.total, color: pid === '_' ? 'var(--viz-muted)' : 'var(--viz-1)',
      tip: [`${pid === '_' ? 'Sem obra' : prj(pid)?.code}: ${money(o.total)}`, ...KPI_CATS.filter(([k]) => o.cats[k]).map(([k, l]) => `${l}: ${money(o.cats[k])}`)]
    }));
    const projPanel = panel('Custo por obra', 'Combustível, manutenção, locação, multas, incidentes e outros',
      projItems.length ? hbars(projItems) + tableView(['Obra', ...KPI_CATS.map(([, l]) => '>' + l), '>Total'], Object.entries(byProj).sort((a, b) => b[1].total - a[1].total).map(([pid, o]) => `<tr><td>${pid === '_' ? 'Sem obra' : esc(prj(pid)?.code || '—')}</td>${KPI_CATS.map(([k]) => `<td class="r">${o.cats[k] ? money(o.cats[k]) : '—'}</td>`).join('')}<td class="r"><b>${money(o.total)}</b></td></tr>`))
        : vizEmpty('Sem custos neste mês', 'Abastecimentos, manutenções, multas e locação aparecem aqui.'));
    const mItems = K.per.filter(x => x.maint > 0).sort((a, b) => b.maint - a.maint).map((x, i) => ({ label: plateTxt(x.v), sub: `${ownName(x.v)} · ${esc(x.v.model || '')}`, value: x.maint, color: ownVar(x.v), strong: i === 0, flag: i === 0 && K.per.filter(y => y.maint > 0).length > 1 ? '<span class="pill">maior custo</span>' : '' }));
    const maintPanel = panel('Manutenção por veículo', 'Custo dos serviços registrados no mês',
      mItems.length ? hbars(mItems, { legend: ownLegend() }) + tableView(['Veículo', 'Frota', '>Manutenção'], mItems.map((x, i) => { const p = K.per.filter(y => y.maint > 0).sort((a, b) => b.maint - a.maint)[i]; return `<tr><td>${esc(p.v.plate)}</td><td>${ownName(p.v)}</td><td class="r">${money(p.maint)}</td></tr>`; }))
        : vizEmpty('Nenhuma manutenção com custo no mês', 'Registre o custo ao lançar o serviço em Manutenção.'));
    const ckItems = K.per.filter(x => x.costKm != null).sort((a, b) => b.costKm - a.costKm).map(x => ({ label: plateTxt(x.v), sub: `${ownName(x.v)} · ${kmFmt(Math.round(x.km))}`, value: x.costKm, valueTxt: rkmFmt(x.costKm), color: ownVar(x.v),
      tip: [`${x.v.plate}: ${rkmFmt(x.costKm)}`, `Combustível: ${money(x.fuel)}`, `Manutenção: ${money(x.maint)}`, `Km rodados: ${kmFmt(Math.round(x.km))}`] }));
    const noKm = K.per.filter(x => x.noKm);
    const ckPanel = panel('Custo por km', '(Combustível + manutenção) ÷ km rodados',
      (ckItems.length ? `<div class="viz-pair"><span><i style="background:var(--viz-1)"></i>Própria <b>${rkmFmt(K.costKmOwn)}</b></span><span><i style="background:var(--viz-2)"></i>Locada <b>${rkmFmt(K.costKmLeased)}</b></span></div>` + hbars(ckItems, { fmt: rkmFmt })
        + tableView(['Veículo', 'Frota', '>Combustível', '>Manutenção', '>Km', '>R$/km'], K.per.filter(x => x.costKm != null).sort((a, b) => b.costKm - a.costKm).map(x => `<tr><td>${esc(x.v.plate)}</td><td>${ownName(x.v)}</td><td class="r">${money(x.fuel)}</td><td class="r">${money(x.maint)}</td><td class="r">${nf(x.km)}</td><td class="r"><b>${money(x.costKm)}</b></td></tr>`))
        : vizEmpty('Sem custo por km neste mês', 'Precisa de km rodados (posses com km inicial e final) e de custos de combustível ou manutenção.'))
      + (noKm.length ? `<p class="viz-note">${ic('alert')}Fora da conta por falta de km no mês: ${noKm.map(x => esc(x.v.plate)).join(', ')}.</p>` : ''));

    /* 3 · desempenho */
    const fItems = K.per.filter(x => x.fe.kmL != null).sort((a, b) => b.fe.kmL - a.fe.kmL).map(x => ({ label: plateTxt(x.v), sub: `${ownName(x.v)} · ref. ${kmlFmt(x.ref)}`, value: x.fe.kmL, valueTxt: kmlFmt(x.fe.kmL), color: ownVar(x.v),
      flag: x.high ? `<span class="pill bad" title="Consumo abaixo da referência">${ic('alert')}consumo alto</span>` : x.fe.n < 2 ? '<span class="pill" title="Só uma leitura válida no mês">pouco dado</span>' : '',
      tip: [`${x.v.plate}: ${kmlFmt(x.fe.kmL)}`, `Referência: ${kmlFmt(x.ref)}`, `${nf(x.fe.dist)} km com ${nf(x.fe.liters, 1)} L`, `${x.fe.n} leitura(s) válida(s)`] }));
    const fuelPanel = panel('Consumo médio (km/l)', `Entre abastecimentos com km válido · alerta abaixo de ${S.settings.fuelDeviationPct}% da referência`,
      fItems.length ? hbars(fItems, { fmt: kmlFmt, legend: ownLegend() }) + tableView(['Veículo', 'Frota', '>Km', '>Litros', '>km/l', '>Referência', 'Situação'], K.per.filter(x => x.fe.kmL != null).sort((a, b) => b.fe.kmL - a.fe.kmL).map(x => `<tr><td>${esc(x.v.plate)}</td><td>${ownName(x.v)}</td><td class="r">${nf(x.fe.dist)}</td><td class="r">${nf(x.fe.liters, 1)}</td><td class="r"><b>${nf(x.fe.kmL, 1)}</b></td><td class="r">${nf(x.ref, 1)}</td><td>${x.high ? 'Consumo alto' : x.fe.n < 2 ? 'Pouco dado' : 'Normal'}</td></tr>`))
        : vizEmpty('Sem consumo calculado neste mês', 'São precisos dois abastecimentos seguidos do mesmo veículo com km informado.'));
    const uItems = K.per.slice().sort((a, b) => b.km - a.km || (b.ut.pct ?? -1) - (a.ut.pct ?? -1));
    const topKm = uItems[0]?.km > 0 ? uItems[0] : null;
    const useItems = uItems.map(x => ({ label: plateTxt(x.v), sub: `${ownName(x.v)} · uso ${pctFmt(x.ut.pct)}${x.ut.avail ? ` (${x.ut.used}/${x.ut.avail} dias)` : ''}`, value: x.km, valueTxt: kmFmt(Math.round(x.km)), color: ownVar(x.v), strong: x === topKm,
      flag: x === topKm && uItems.filter(y => y.km > 0).length > 1 ? `<span class="pill ok">${ic('trophy')}maior distância</span>` : '',
      tip: [`${x.v.plate}: ${kmFmt(Math.round(x.km))}`, `Utilização: ${pctFmt(x.ut.pct)}`, `${x.ut.used} de ${x.ut.avail} dias úteis em uso`, x.ut.maint ? `${x.ut.maint} dia(s) em manutenção` : ''] }));
    const usePanel = panel('Utilização e distância', 'Ranking por km rodados · uso = dias úteis em posse ÷ dias úteis disponíveis (fora de manutenção)',
      K.per.length && K.per.some(x => x.km > 0 || x.ut.used) ? hbars(useItems, { fmt: kmFmt, legend: ownLegend() }) + tableView(['Pos.', 'Veículo', 'Frota', '>Km', '>Uso', '>Dias em uso', '>Dias disponíveis', '>Em manutenção'], uItems.map((x, i) => `<tr><td>${i + 1}º</td><td>${esc(x.v.plate)}</td><td>${ownName(x.v)}</td><td class="r">${nf(x.km)}</td><td class="r">${pctFmt(x.ut.pct)}</td><td class="r">${x.ut.used}</td><td class="r">${x.ut.avail}</td><td class="r">${x.ut.maint}</td></tr>`))
        : vizEmpty('Sem uso registrado neste mês', 'O uso vem das posses (recebimento e entrega com km).'));

    /* 4 · manutenção preventiva */
    const st = t => t.onTime ? ['ok', 'No prazo'] : t.done ? ['warn', 'Com atraso'] : ['bad', 'Pendente'];
    const dueTxt = t => `${t.byKm ? `${nf(t.dueKm)} km (${fmtDate(t.dueAt)})` : fmtDate(t.dueAt)}`;
    const hasPlans = K.vehs.some(v => S.plans.some(p => p.vehicleId === v.id && (p.everyKm || p.everyDays)));
    const open = K.openAtEnd;
    const compPanel = panel('Manutenção preventiva', 'Tarefas que venceram no mês e foram feitas até o vencimento',
      !hasPlans ? vizEmpty('Nenhum plano de manutenção cadastrado', 'Cadastre os intervalos (km ou dias) na aba Manutenção de cada veículo.')
        : (K.compliance != null ? meter(K.compliance) + `<p class="viz-note plain">${K.dueOk.length} no prazo · ${K.due.length - K.dueOk.length} fora do prazo · ${K.due.length} venceram no mês</p>` : vizEmpty('Nenhuma tarefa venceu neste mês', 'Tarefas que ainda não venceram não entram na conta.'))
        + (open.length ? `<div class="viz-overdue"><h4>${ic('alert')}Vencidas em aberto <span class="pill bad">${open.length}</span></h4><ul>${open.slice(0, 8).map(t => `<li data-go="veiculo" data-id="${t.v.id}" data-tab="mnt"><span class="dot bad"></span><b>${esc(t.v.plate)}</b><span>${esc(t.p.item)}</span><small>venceu em ${dueTxt(t)}</small></li>`).join('')}</ul>${open.length > 8 ? `<p class="viz-note plain">e mais ${open.length - 8}.</p>` : ''}</div>` : (hasPlans ? '<p class="viz-note plain ok">Nenhuma tarefa vencida em aberto.</p>' : ''))
        + tableView(['Veículo', 'Serviço', 'Vencimento', 'Feito em', 'Situação'], K.due.map(t => { const [c, l] = st(t); return `<tr><td>${esc(t.v.plate)}</td><td>${esc(t.p.item)}</td><td>${dueTxt(t)}</td><td>${t.done ? `${fmtDate(t.done.at)} · ${nf(t.done.km)} km` : '—'}</td><td><span class="st"><span class="dot ${c}"></span>${l}</span></td></tr>`; })));

    /* 5 · multas e incidentes */
    const fCost = sum(K.fines, x => +x.f.value || 0); const iCost = sum(K.incs, x => +x.i.cost || 0); const iNoCost = K.incs.filter(x => !(+x.i.cost > 0));
    const grp = {}; const addG = (k, kind, val) => { const o = grp[k] || (grp[k] = { fn: 0, fv: 0, inn: 0, iv: 0 }); if (kind === 'f') { o.fn++; o.fv += val; } else { o.inn++; o.iv += val; } };
    let byKey = KPI_F.v ? 'p' : (ROUTE.p.by || 'v');
    K.fines.forEach(x => addG(byKey === 'p' ? x.m.projectId || '_' : x.m.vehicleId || '_', 'f', +x.f.value || 0));
    K.incs.forEach(x => addG(byKey === 'p' ? x.projectId || '_' : x.i.vehicleId || '_', 'i', +x.i.cost || 0));
    const gName = k => k === '_' ? (byKey === 'p' ? 'Sem obra' : 'Sem veículo') : byKey === 'p' ? esc(prj(k)?.code || '—') : esc(veh(k)?.plate || '—');
    const incPanel = panel('Multas e incidentes', 'Quantidade e custo no mês',
      (K.fines.length || K.incs.length) ? `<div class="mini-stats"><div><span>Multas</span><b>${K.fines.length}</b><small>${money(fCost)}</small></div><div><span>Incidentes</span><b>${K.incs.length}</b><small>${iCost ? money(iCost) : 'sem custo informado'}</small></div><div><span>Total</span><b>${K.fines.length + K.incs.length}</b><small>${money(fCost + iCost)}</small></div></div>
        <div class="seg sm viz-by"><label><input type="radio" name="kby" value="v" ${byKey === 'v' ? 'checked' : ''} ${KPI_F.v ? 'disabled' : ''}><span>Por veículo</span></label><label><input type="radio" name="kby" value="p" ${byKey === 'p' ? 'checked' : ''}><span>Por obra</span></label></div>
        ${tbl([byKey === 'p' ? 'Obra' : 'Veículo', '>Multas', '>R$ multas', '>Incidentes', '>R$ incidentes'], Object.entries(grp).sort((a, b) => (b[1].fv + b[1].iv) - (a[1].fv + a[1].iv)).map(([k, o]) => `<tr><td>${gName(k)}</td><td class="r">${o.fn}</td><td class="r">${o.fv ? money(o.fv) : '—'}</td><td class="r">${o.inn}</td><td class="r">${o.iv ? money(o.iv) : '—'}</td></tr>`))}
        ${iNoCost.length ? `<p class="viz-note">${ic('alert')}${iNoCost.length} incidente(s) sem custo informado. ${isManager() ? `<button class="link" data-act="kpi-inc-list">Informar custo</button>` : ''}</p>` : ''}`
        : vizEmpty('Nenhuma multa ou incidente no mês'));

    /* 6 · evolução */
    const startKey = [shiftMonth(key, -11), first].sort().at(-1);
    const months = []; for (let k = startKey; k <= key; k = shiftMonth(k, 1)) months.push(kpiMonthTotals(k));
    KPI_TREND = { months, key };
    const present = KPI_CATS.filter(([k]) => months.some(m => m[k] > 0));
    const prevM = months.at(-2);
    const trendPanel = panel('Evolução do custo operacional', partial ? 'Mês atual parcial (até hoje)' : `Últimos ${months.length} mes${months.length > 1 ? 'es' : ''}`,
      months.some(m => m.total) ? legendHTML(present.map(([k, l]) => [CAT_VAR[k], l])) + `<div class="trend-box" id="trend-box">${trendChart(months, key)}</div>`
        + (prevM && prevTot ? `<p class="viz-note plain">${cap(MONTHS[+key.slice(5) - 1])}: <b>${money(months.at(-1).total)}</b> ${deltaTag(months.at(-1).total, prevTot, prevLabel)}</p>` : '')
        + tableView(['Mês', ...present.map(([, l]) => '>' + l), '>Total'], months.slice().reverse().map(m => `<tr><td>${cap(monthName(m.key))}</td>${present.map(([k]) => `<td class="r">${m[k] ? money(m[k]) : '—'}</td>`).join('')}<td class="r"><b>${money(m.total)}</b></td></tr>`))
        : vizEmpty('Ainda não há custos registrados'));

    /* dados a completar */
    const gaps = [];
    if (noKm.length) gaps.push(`${noKm.length} veículo(s) com custo e sem km rodados no mês (falta posse com km inicial/final): ${noKm.map(x => `<button class="link" data-go="veiculo" data-id="${x.v.id}" data-tab="posses">${esc(x.v.plate)}</button>`).join(', ')}`);
    const noRent = K.vehs.filter(v => isLeased(v) && v.rental?.status !== 'devolvida' && !v.rental?.monthly);
    if (noRent.length) gaps.push(`${noRent.length} veículo(s) locado(s) sem valor mensal (a locação fica fora do custo): ${noRent.map(v => `<button class="link" data-go="veiculo" data-id="${v.id}">${esc(v.plate)}</button>`).join(', ')}`);
    if (iNoCost.length) gaps.push(`${iNoCost.length} incidente(s) sem custo informado${isManager() ? ` · <button class="link" data-act="kpi-inc-list">informar</button>` : ''}`);
    const badFuel = sum(K.per, x => x.fe.bad); if (badFuel) gaps.push(`${badFuel} abastecimento(s) com km igual ou menor que o anterior (fora do consumo) · <button class="link" data-go="abastecimento">ver abastecimentos</button>`);
    const noPlan = K.vehs.filter(v => !S.plans.some(p => p.vehicleId === v.id && (p.everyKm || p.everyDays)));
    if (noPlan.length) gaps.push(`${noPlan.length} veículo(s) sem plano de manutenção preventiva: ${noPlan.map(v => `<button class="link" data-go="veiculo" data-id="${v.id}" data-tab="mnt">${esc(v.plate)}</button>`).join(', ')}`);
    const gapsHTML = gaps.length ? `<details class="viz-gaps"><summary>${ic('alert')}Dados a completar <span class="pill">${gaps.length}</span></summary><ul>${gaps.map(g => `<li>${g}</li>`).join('')}</ul></details>` : '';

    return `<div class="stack viz">${head}${cards}${gapsHTML}
      <h2 class="viz-h">Custos</h2><div class="grid2">${projPanel}${maintPanel}</div>${ckPanel}
      <h2 class="viz-h">Desempenho da frota</h2><div class="grid2">${usePanel}${fuelPanel}</div>
      <h2 class="viz-h">Manutenção, multas e incidentes</h2><div class="grid2">${compPanel}${incPanel}</div>
      <h2 class="viz-h">Histórico</h2>${trendPanel}</div>`;
  },
  mount() {
    [['kf-p', 'p'], ['kf-v', 'v'], ['kf-o', 'o'], ['kf-u', 'u']].forEach(([id, k]) => $('#' + id)?.addEventListener('change', e => { KPI_F[k] = e.target.value; render(); }));
    $$('input[name=kby]').forEach(r => r.addEventListener('change', e => { ROUTE.p.by = e.target.value; render(); }));
    vizTipBind();
    const box = $('#trend-box');
    if (box && KPI_TREND) { const draw = () => { const w = box.clientWidth; if (w && Math.abs(w - (box._w || 0)) > 4) { box._w = w; box.innerHTML = trendChart(KPI_TREND.months, KPI_TREND.key, w); } }; draw(); try { new ResizeObserver(draw).observe(box); } catch (e) { } }
  }
};
const plateTxt = v => `<span class="mono">${esc(v.plate)}</span>`;
ACTIONS['kpi-m'] = a => { const d = +a.dataset.d; const cur = monthKey(nowTs()); KPI_F.m = d === 0 ? cur : [shiftMonth(KPI_F.m || cur, d), cur].sort()[0]; render(); };
ACTIONS['kpi-clear'] = () => { KPI_F.p = KPI_F.v = KPI_F.o = KPI_F.u = ''; render(); };

/* incidentes sem custo: informar o valor (gestor/administrador) */
ACTIONS['kpi-inc-list'] = () => {
  if (!isManager()) return;
  const [from, to] = monthRange(KPI_F.m || monthKey(nowTs()));
  const list = S.issues.filter(i => i.at >= from && i.at < to && !(+i.cost > 0)).sort((a, b) => b.at - a.at);
  openModal({
    title: 'Custo dos incidentes',
    body: list.length ? `<p class="muted small">Informe quanto cada incidente custou (conserto, franquia, guincho etc.). Deixe em branco se não houve custo.</p><div class="stack" style="gap:10px">${list.map(i => `<label class="field"><span>${esc(veh(i.vehicleId)?.plate || '—')} · ${esc(i.type)} · ${fmtShort(i.at)}</span><input class="inp num" inputmode="decimal" data-inc="${i.id}" placeholder="R$ 0,00"></label>`).join('')}</div><p class="err" id="ic-err"></p>` : '<p class="empty">Nenhum incidente sem custo neste mês.</p>',
    foot: `<button class="btn" data-act="modal-close">Cancelar</button>${list.length ? '<button class="btn ok" data-act="kpi-inc-save">Salvar</button>' : ''}`
  });
};
ACTIONS['kpi-inc-save'] = () => {
  if (!isManager()) return; let n = 0;
  $$('[data-inc]').forEach(el => {
    const v = parseFloat(String(el.value || '').replace(/\./g, '').replace(',', '.')); if (!(v > 0)) return;
    const i = byId(S.issues, el.dataset.inc); if (!i) return;
    i.cost = Math.round(v * 100) / 100; i.costBy = CUR.id; i.costAt = nowTs(); n++;
    log('problema', `Custo do incidente (${i.type}) informado por ${CUR.name}: ${money(i.cost)}`, { vehicleId: i.vehicleId, driverId: i.driverId });
  });
  if (!n) return $('#ic-err').textContent = 'Informe ao menos um valor.';
  save(); closeModal(); toast(`${n} custo(s) informado(s).`); render();
};

/* dica flutuante dos gráficos (texto sempre por textContent) */
function vizTipBind() {
  const root = $('.viz'); if (!root || root._tip) return; root._tip = true;
  let tip = $('#viz-tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'viz-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  const show = (el, x, y) => {
    const lines = (el.getAttribute('data-tip') || '').split('\n').filter(Boolean); if (!lines.length) return;
    tip.replaceChildren(...lines.map((l, i) => { const d = document.createElement(i ? 'div' : 'b'); d.textContent = l; return d; }));
    tip.style.display = 'block'; const r = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x + 12)) + 'px'; tip.style.top = Math.max(8, y - r.height - 12) + 'px';
  };
  const hide = () => { tip.style.display = 'none'; };
  root.addEventListener('pointermove', e => { const el = e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else hide(); });
  root.addEventListener('pointerleave', hide);
  root.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); } });
  root.addEventListener('focusout', hide);
  addEventListener('scroll', hide, { passive: true, once: true });
}
