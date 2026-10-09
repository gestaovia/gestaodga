/* ===================== Localização pelo celular do condutor (sem rastreador externo) =====================
   Enquanto o condutor está com um veículo e o gestaovia aberto no celular, o navegador envia a posição:
   - última posição do veículo (vehicle_last_location), a cada intervalo configurado ou ao andar ~300 m;
   - histórico do trajeto (vehicle_positions), usado para desenhar o caminho do dia;
   - alerta de excesso de velocidade (tracker_events) quando o GPS mede velocidade acima do limite.
   Limite natural da web: com a tela bloqueada ou o app fechado o navegador deixa de enviar. */
const ALARM_LABEL = { overspeed: 'Excesso de velocidade' };
const TELEMETRY_ALARMS = ['overspeed'];
const GPS_DEF = () => ({ enabled: true, intervalSec: 120, speedLimit: 100, maxAccuracy: 150 });
const gpsCfg = () => S.settings.gps || (S.settings.gps = GPS_DEF());
const distKm = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos(a.lat * Math.PI / 180)) * 111.2;

const GPS = {
  watch: null, last: null, prev: null, state: 'off', msg: '', lastOver: {},
  myCustody() { const d = myDriver(); return d ? driverCustodies(d.id)[0] || null : null; },
  start() {
    if (CUR?.role !== 'condutor' || !gpsCfg().enabled) return this.stop('off');
    if (!this.myCustody()) return this.stop('sem_veiculo');
    if (!navigator.geolocation) return this.stop('indisponivel');
    if (this.watch != null) return;
    this.state = 'aguardando'; this.paint();
    this.watch = navigator.geolocation.watchPosition(p => this.onPos(p), e => {
      this.state = e.code === 1 ? 'negado' : 'erro'; this.msg = e.message || ''; this.paint();
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 60000 });
  },
  stop(state = 'off') { if (this.watch != null) { try { navigator.geolocation.clearWatch(this.watch); } catch (e) { } } this.watch = null; this.state = state; this.paint(); },
  refresh() { if (this.myCustody() && gpsCfg().enabled && CUR?.role === 'condutor') this.start(); else this.stop(this.myCustody() ? 'off' : 'sem_veiculo'); },
  onPos(p) {
    const c = this.myCustody(); if (!c) return this.stop('sem_veiculo');
    const cfg = gpsCfg(); const { latitude: lat, longitude: lng, accuracy, speed } = p.coords; const at = p.timestamp || nowTs();
    if (accuracy && accuracy > cfg.maxAccuracy) { this.state = 'impreciso'; this.paint(); return; }
    const here = { lat, lng, at };
    // velocidade: a medida pelo GPS do aparelho; sem ela, estimada entre duas leituras
    let kmh = speed != null && !isNaN(speed) ? speed * 3.6 : null;
    if (kmh == null && this.prev && at > this.prev.at) { const h = (at - this.prev.at) / 36e5; if (h > 0) kmh = distKm(this.prev, here) / h; }
    this.prev = here; this.state = 'ativo'; this.paint();
    const v = veh(c.vehicleId); if (!v) return;
    if (kmh != null && speed != null && kmh > cfg.speedLimit && (!accuracy || accuracy <= 50)) this.overspeed(v, c, here, Math.round(kmh));
    const due = !this.last || this.last.vid !== v.id || at - this.last.at >= cfg.intervalSec * 1000 || (distKm(this.last, here) > .3 && at - this.last.at > 20000);
    if (!due) return;
    this.last = { ...here, vid: v.id };
    const spd = kmh != null ? Math.round(kmh) : null;
    S.locations[v.id] = { lat, lng, speed: spd, ignition: null, km: v.odometer, at, source: 'celular' };
    // grava primeiro a posse/posição pendentes (o banco confere se o veículo está com o condutor)
    if (CLOUD.on) CLOUD.flush().then(() => CLOUD.client().from('vehicle_positions').insert({ vehicle_id: v.id, driver_id: c.driverId, lat, lng, speed: spd, km: v.odometer, at: new Date(at).toISOString(), source: 'celular' }).then(({ error }) => { if (error) { this.msg = friendlyError(error); } }));
  },
  overspeed(v, c, here, kmh) {
    if (nowTs() - (this.lastOver[v.id] || 0) < 10 * MIN) return; // no máximo um alerta a cada 10 min por veículo
    this.lastOver[v.id] = nowTs();
    S.trackerEvents.push({ id: uid(), extId: null, vehicleId: v.id, driverId: c.driverId, type: 'overspeed', at: here.at, speed: kmh, lat: here.lat, lng: here.lng });
    log('telemetria', `Excesso de velocidade (${kmh} km/h) medido pelo GPS do celular`, { vehicleId: v.id, driverId: c.driverId, at: here.at });
    notify('gestao', `${v.plate}: excesso de velocidade a ${kmh} km/h · ${drv(c.driverId)?.name || ''}.`, { level: 'warn', link: { page: 'veiculo', id: v.id } });
    save();
  },
  paint() { const el = $('#gps-chip'); if (el) el.outerHTML = gpsChip(); }
};
function gpsChip() {
  if (CUR?.role !== 'condutor') return '';
  const m = { ativo: ['ok', 'Localização ativa'], aguardando: ['warn', 'Procurando sinal de GPS…'], impreciso: ['warn', 'GPS com pouca precisão'], negado: ['bad', 'Localização bloqueada: permita nas configurações do navegador'], erro: ['bad', 'GPS indisponível no momento'], indisponivel: ['bad', 'Este aparelho não informa localização'] }[GPS.state];
  if (!m) return '<span id="gps-chip"></span>';
  return `<span id="gps-chip" class="st small" style="white-space:normal"><span class="dot ${m[0]}"></span>${m[1]}</span>`;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CUR?.role === 'condutor') { GPS.stop(GPS.state); GPS.refresh(); } });

/* ---------- gestão: quantos veículos enviaram posição recentemente ---------- */
function tcBadge() {
  const on = gpsCfg().enabled; const recent = Object.values(S.locations || {}).filter(l => nowTs() - l.at < 15 * MIN).length;
  return `<span id="tc-badge" class="pill ${on && recent ? 'ok' : ''}" title="Posições enviadas pelo celular dos condutores">${ic('pin')} ${on ? `${recent} com posição nos últimos 15 min` : 'Localização desligada'}</span>`;
}

/* ---------- trajeto do dia (histórico gravado pelo celular) ---------- */
async function drawTodayRoute(map, vid) {
  if (!map || !window.L || !CLOUD.on) return;
  const { data } = await CLOUD.client().from('vehicle_positions').select('lat,lng,at,speed').eq('vehicle_id', vid).gte('at', new Date(startOfDay(nowTs())).toISOString()).order('at').limit(3000);
  const pts = (data || []).map(p => ({ lat: +p.lat, lng: +p.lng, at: Date.parse(p.at) }));
  if (!MAPS.includes(map) || pts.length < 2) return;
  const line = L.polyline(pts.map(p => [p.lat, p.lng]), { color: cssVar('--blue'), weight: 4, opacity: .75 }).addTo(map);
  L.circleMarker([pts[0].lat, pts[0].lng], { radius: 5, color: '#fff', weight: 2, fillColor: cssVar('--green'), fillOpacity: 1 }).bindTooltip(`Início ${fmtTime(pts[0].at)}`).addTo(map);
  map.fitBounds(line.getBounds(), { padding: [20, 20], animate: false, maxZoom: 14 });
  const kmTot = pts.reduce((s, p, i) => i ? s + distKm(pts[i - 1], p) : 0, 0);
  const el = $('#route-info'); if (el) el.textContent = `Trajeto de hoje · ${nf(kmTot, 0)} km · ${pts.length} posições`;
}

/* ---------- configuração (administrador) ---------- */
function gpsSettings() {
  const c = gpsCfg(); const recent = S.vehicles.filter(v => v.active !== false).map(v => {
    const l = S.locations[v.id];
    return `<tr><td>${plate(v.plate)}</td><td class="small">${l ? `${fmtShort(l.at)}${l.speed != null ? ` · ${l.speed} km/h` : ''}` : '<span class="muted">sem posição</span>'}</td><td class="small">${l ? esc(nearestPlace(l)) : '—'}</td></tr>`;
  });
  const ev = S.trackerEvents.slice().sort((a, b) => b.at - a.at).slice(0, 8);
  return `<div class="panel-b stack" style="padding-top:14px">
    <div class="note">${ic('pin')}<div>A localização vem do <b>GPS do celular do condutor</b> enquanto ele está com um veículo e o gestaovia aberto. Não depende de rastreador nem de serviço externo. Com a tela bloqueada ou o app fechado, o navegador para de enviar; a posição volta a ser enviada quando o condutor abre o app.</div></div>
    <form id="gps-form" class="form-grid three">
      <label class="field"><span>Envio de localização</span><select class="inp" name="enabled"><option value="1" ${c.enabled ? 'selected' : ''}>Ligado</option><option value="0" ${!c.enabled ? 'selected' : ''}>Desligado</option></select></label>
      <label class="field"><span>Enviar a cada (minutos)</span><input class="inp num" name="interval" inputmode="numeric" value="${nf(c.intervalSec / 60, 0)}"><small>Também envia ao andar cerca de 300 m</small></label>
      <label class="field"><span>Velocidade máxima (km/h)</span><input class="inp num" name="speedLimit" inputmode="numeric" value="${c.speedLimit}"><small>Acima disso gera alerta e conta na premiação</small></label>
      <div class="full"><button class="btn ok">Salvar</button></div>
    </form>
    <div><h3 style="margin-bottom:8px">Última posição de cada veículo</h3>${tbl(['Veículo', 'Recebida', 'Local'], recent)}</div>
    <div><h3 style="margin-bottom:8px">Últimos alertas de velocidade</h3>${ev.length ? `<ul class="att" style="padding:0">${ev.map(e => `<li data-go="veiculo" data-id="${e.vehicleId}"><span class="ic urg">${ic('gauge')}</span><div><b>${veh(e.vehicleId)?.plate || '—'} · ${ALARM_LABEL[e.type] || e.type}${e.speed ? ` · ${e.speed} km/h` : ''}</b><small>${e.driverId ? esc(drv(e.driverId)?.name || '') : 'Sem condutor'}</small></div><span class="when">${fmtShort(e.at)}</span></li>`).join('')}</ul>` : empty('Nenhum alerta ainda.')}</div>
  </div>`;
}
function mountGpsSettings() {
  const f = $('#gps-form'); if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault(); const d = formData(f); const c = gpsCfg();
    const mins = Math.max(1, Math.min(60, parseInt(d.interval, 10) || 2)); const lim = Math.max(40, Math.min(200, parseInt(d.speedLimit, 10) || 100));
    Object.assign(c, { enabled: d.enabled === '1', intervalSec: mins * 60, speedLimit: lim });
    log('config', `Localização pelo celular ${c.enabled ? 'ligada' : 'desligada'} (a cada ${mins} min, limite ${lim} km/h) por ${CUR.name}`, {}); save(); toast('Configuração salva.'); render();
  });
}
