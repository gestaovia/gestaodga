// estado de teste (sem servidor): 1 obra, 2 veículos, 2 condutores, gestor e admin
window.FIX = () => {
  const T = (s) => new Date(s).getTime();
  const st = fillDefaults({}, DEFAULT_SETTINGS());
  S = {
    version: 6, cloud: true, locations: {}, settings: st,
    costCenters: [{ id: 'cc1', code: 'CC1', name: 'Centro', active: true }],
    projects: [{ id: 'p1', code: 'OB-01', name: 'Obra Um', ccId: 'cc1', active: true }, { id: 'p2', code: 'OB-02', name: 'Obra Dois', ccId: 'cc1', active: true }],
    drivers: [{ id: 'd1', name: 'Ana Souza', active: true }, { id: 'd2', name: 'Bruno Lima', active: true }],
    users: [{ id: 'u_adm', name: 'Mauricio', role: 'admin', active: true, owner: true }, { id: 'u_d1', name: 'Ana Souza', role: 'condutor', driverId: 'd1', active: true }, { id: 'u_d2', name: 'Bruno Lima', role: 'condutor', driverId: 'd2', active: true }],
    vehicles: [{ id: 'v1', plate: 'ABC1D23', brand: 'Fiat', model: 'Strada', year: 2024, fuelType: 'flex', avgKmL: 10, odometer: 15000, ownership: 'propria', active: true, tollTag: true },
               { id: 'v2', plate: 'XYZ9K88', brand: 'VW', model: 'Saveiro', year: 2023, fuelType: 'flex', avgKmL: 10, odometer: 30000, ownership: 'propria', active: true, tollTag: true }],
    qrcodes: [], plans: [{ id: 'pl1', vehicleId: 'v1', item: 'Troca de óleo', everyKm: 10000, everyDays: 180, lastKm: 12000, lastDate: T('2026-08-01T10:00') }],
    maintRecords: [], custody: [], transfers: [], checklists: [], issues: [], fuel: [], tolls: [], fines: [],
    trackerEvents: [], notifications: [], audit: [], closings: [], bonusAdj: [], tollClosings: [], workshops: []
  };
  S.vehicles.forEach(v => docsOf(v)); docSet(); CLOUD.signed = {};
  return T;
};
// v1.13.0: posse de 13/10 a 19/10 com diário nos dias úteis 13–16 e no sábado 17/10
window.NBSET = () => {
  const T = FIX(); CUR = S.users[0];
  S.checklists.push({ id: 'r1', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-13T08:00'), serverAt: T('2026-10-13T08:00'), km: 15000, items: {}, photos: {} });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-13T08:00'), end: T('2026-10-19T18:00'), startKm: 15000, endKm: 15500, receiveChecklistId: 'r1', segments: [{ at: T('2026-10-13T08:00'), projectId: 'p1' }] });
  ['13', '14', '15', '16'].forEach((d, i) => S.checklists.push({ id: 'k' + i, type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T(`2026-10-${d}T08:30`), serverAt: T(`2026-10-${d}T08:30`), km: 15010 + i, ok: true }));
  S.checklists.push({ id: 'ks', type: 'diario', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-17T09:00'), serverAt: T('2026-10-17T09:00'), km: 15100, ok: true });
  return T;
};
// v1.14.0: frota comercial — obra reservada COMERCIAL, motorista administrativo (d3) e veículo comercial (v3)
window.ADMSET = () => {
  const T = FIX();
  S.users.forEach(u => { u.email = u.email || u.id + '@x.com'; });
  S.projects.push({ id: COM_ID, code: 'COMERCIAL', name: 'Frota comercial', ccId: null, active: true, system: 'comercial' });
  S.drivers.push({ id: 'd3', name: 'Carla Dias', kind: 'administrativo', active: true, cnh: '12345678901', cnhCat: 'B', cnhExp: T('2030-01-01T00:00'), phone: '' });
  S.users.push({ id: 'u_d3', name: 'Carla Dias', role: 'condutor', driverId: 'd3', active: true, email: 'carla@x.com' });
  S.vehicles.push({ id: 'v3', plate: 'COM1A23', brand: 'Fiat', model: 'Cronos', year: 2025, fuelType: 'flex', avgKmL: 12, odometer: 5000, ownership: 'propria', fleet: 'comercial', active: true, tollTag: true });
  docsOf(S.vehicles[2]);
  return T;
};
window.ADMCUST = T => { // posse da Carla (administrativo) no v3 de 05/10 a 09/10 com diários e um sábado
  S.checklists.push({ id: 'ra', type: 'recebimento', vehicleId: 'v3', driverId: 'd3', custodyId: 'ca', at: T('2026-10-05T08:00'), serverAt: T('2026-10-05T08:00'), km: 5000, items: {}, photos: {} });
  S.custody.push({ id: 'ca', vehicleId: 'v3', driverId: 'd3', start: T('2026-10-05T08:00'), end: T('2026-10-10T18:00'), startKm: 5000, endKm: 5600, receiveChecklistId: 'ra', segments: [{ at: T('2026-10-05T08:00'), projectId: COM_ID }] });
  ['06', '07', '10'].forEach((d, i) => S.checklists.push({ id: 'ka' + i, type: 'diario', vehicleId: 'v3', driverId: 'd3', custodyId: 'ca', at: T(`2026-10-${d}T09:00`), serverAt: T(`2026-10-${d}T09:00`), km: 5100 + i }));
};
// v1.15.0: oficina para o envio à manutenção e transferência forçada desfeita
window.MSET = () => { const T = FIX(); CUR = S.users[0]; S.workshops = [{ id: 'w1', name: 'Oficina Central', active: true }]; return T; };
window.MSEND = (vid, why) => { ACTIONS['maint-direct']({ dataset: { id: vid } }); $('#md-form [name=workshopId]').value = 'w1'; $('#md-form [name=shop]').value = why; ACTIONS['maint-direct-ok']({ dataset: { id: vid } }); };
window.FSET = (T, disc) => { // posse da Ana (d1) encerrada por transferência forçada, liberada para o Bruno (d2)
  S.checklists.push({ id: 'r1', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-19T08:00'), serverAt: T('2026-10-19T08:00'), km: 15000, items: {}, photos: {} });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-19T08:00'), end: T('2026-10-20T09:00'), startKm: 15000, endKm: 15100, receiveChecklistId: 'r1', segments: [{ at: T('2026-10-19T08:00'), projectId: 'p1' }], closedReason: 'forcada', forcedDiscount: disc, transferId: 'tf' });
  if (disc) S.custody[0].forcedAdjId = newAdj({ driverId: 'd1', period: '2026-10', kind: 'ocorrencia', modality: 'A', points: 50, at: T('2026-10-20T09:00'), vehicleId: 'v1', reason: 'Transferência forçada' }).id;
  S.transfers.push({ id: 'tf', vehicleId: 'v1', fromDriverId: 'd1', toDriverId: 'd2', status: 'aguardando_recebimento', requestedAt: T('2026-10-20T09:00'), forced: true, justification: 'teste', discount: disc, fromCustodyId: 'c1', events: [] });
};
window.FUNDO = why => { ACTIONS['forced-undo']({ dataset: { id: 'v1' } }); const w = $('#fu-why'); if (w) w.value = why; ACTIONS['forced-undo-ok']({ dataset: { id: 'v1' } }); };
// v1.17.0: veículo v2 locado
window.RENT = (T, o) => { const v = veh('v2'); v.ownership = 'locada'; v.rental = { company: 'Locadora X', pickupDate: T('2026-08-05T00:00'), dueDate: T('2027-08-05T00:00'), monthly: 3000, status: 'ativa', history: [], ...o }; return v; };
// v1.18.0: transferência entregue (Ana → Bruno) com checklist de recebimento em andamento
window.TSET = () => { // Ana (d1) entregou o v1; Bruno (d2) começou o checklist de recebimento e parou
  const T = FIX(); CUR = S.users[0]; DRAFT = null;
  S.checklists.push({ id: 'r1', type: 'recebimento', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-19T08:00'), serverAt: T('2026-10-19T08:00'), km: 15000, items: {}, photos: {} });
  S.checklists.push({ id: 'e1', type: 'entrega', vehicleId: 'v1', driverId: 'd1', custodyId: 'c1', at: T('2026-10-20T09:00'), serverAt: T('2026-10-20T09:00'), km: 15100, items: {}, photos: {} });
  S.custody.push({ id: 'c1', vehicleId: 'v1', driverId: 'd1', start: T('2026-10-19T08:00'), end: T('2026-10-20T09:00'), startKm: 15000, endKm: 15100, receiveChecklistId: 'r1', deliverChecklistId: 'e1', segments: [{ at: T('2026-10-19T08:00'), projectId: 'p1' }], closedReason: 'transferencia', transferId: 'tt' });
  S.transfers.push({ id: 'tt', vehicleId: 'v1', fromDriverId: 'd1', toDriverId: 'd2', status: 'recebimento_andamento', requestedAt: T('2026-10-20T08:00'), forced: false, requestedBy: 'u_d2', fromCustodyId: 'c1', toCustodyId: null, deliverChecklistId: 'e1', receiveChecklistId: null, events: [] });
  S.vehicles[0].odometer = 15100; return T;
};
window.TCANCEL = (dest, why = 'Bruno desistiu de receber') => {
  ACTIONS['t-adm-cancel']({ dataset: { id: 'tt' } });
  const r = $(`input[name="tac-dest"][value="${dest}"]`); if (r && !r.disabled) r.checked = true;
  $('#tac-why').value = why; ACTIONS['t-adm-cancel-ok']({ dataset: { id: 'tt' } });
};
