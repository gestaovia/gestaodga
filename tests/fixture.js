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
