/* ===================== Núcleo: utilitários, estado e rótulos ===================== */
const DAY = 864e5, MIN = 6e4;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => window.crypto?.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
const pad = n => String(n).padStart(2, '0');
const nowTs = () => Date.now();
const fmtDate = t => { if (!t) return '—'; const d = new Date(t); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtTime = t => { if (!t) return '—'; const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDT = t => t ? `${fmtDate(t)} às ${fmtTime(t)}` : '—';
const fmtShort = t => { if (!t) return '—'; const d = new Date(t); return isToday(t) ? `hoje ${fmtTime(t)}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${fmtTime(t)}`; };
const nf = (n, d = 0) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const km = n => n == null ? '—' : nf(n) + ' km';
const money = n => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isToday = t => startOfDay(t) === startOfDay(nowTs());
const startOfMonth = t => { const d = new Date(t); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dur = ms => { if (ms < 0) ms = 0; const m = Math.floor(ms / MIN); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 48) return `${h} h ${pad(m % 60)} min`; return `${Math.floor(h / 24)} dias`; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const initials = n => n.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const sum = (a, f = x => x) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const byId = (arr, id) => arr.find(x => x.id === id);

/* ----- rótulos ----- */
const ROLES = { admin: 'Administrador', gestor: 'Gestor de Frota', supervisor: 'Supervisor', condutor: 'Condutor' };
const V_STATUS = {
  disponivel: { l: 'Disponível', c: 'ok' }, em_uso: { l: 'Em uso', c: 'neu' }, deslocamento: { l: 'Em deslocamento', c: 'neu' },
  parado: { l: 'Parado', c: 'gray' }, aguardando_transferencia: { l: 'Aguardando transferência', c: 'warn' },
  manutencao: { l: 'Em manutenção', c: 'gray' }, bloqueado: { l: 'Bloqueado', c: 'bad' }, pendencia: { l: 'Com pendência', c: 'warn' }
};
const T_STATUS = [
  ['posse', 'Posse ativa'], ['solicitada', 'Transferência solicitada'], ['aguardando_entrega', 'Aguardando entrega'],
  ['entrega_andamento', 'Checklist de entrega em andamento'], ['aguardando_recebimento', 'Aguardando recebimento'],
  ['recebimento_andamento', 'Checklist de recebimento em andamento'], ['concluida', 'Transferência concluída']
];
const T_LABEL = Object.fromEntries([...T_STATUS, ['cancelada', 'Cancelada']]);
const CK_TYPES = {
  recebimento: 'Recebimento', entrega: 'Entrega', devolucao: 'Devolução', diario: 'Diário',
  manut_entrada: 'Entrada em manutenção', manut_saida: 'Saída de manutenção', avaria: 'Registro de avaria'
};
const CK_ITEMS = [
  ['pneus', 'Estado dos pneus'], ['farois', 'Faróis e lanternas'], ['vidros', 'Vidros'], ['retrovisores', 'Retrovisores'],
  ['lataria', 'Lataria'], ['limpeza', 'Limpeza'], ['estepe', 'Estepe'], ['ferramentas', 'Ferramentas (macaco, chave, triângulo)'], ['documentacao', 'Documentação (CRLV)']
];
const PHOTO_SLOTS = [['frontal', 'Frontal'], ['traseira', 'Traseira'], ['lat_dir', 'Lateral direita'], ['lat_esq', 'Lateral esquerda'], ['painel', 'Painel com hodômetro']];
const FUEL_LEVELS = ['Reserva', '1/4', '1/2', '3/4', 'Cheio'];
const PURPOSES = ['Deslocamento para obra', 'Transporte de equipe', 'Transporte de materiais', 'Visita técnica', 'Serviço administrativo', 'Retorno à matriz'];
const PROBLEM_TYPES = ['Freios', 'Pneus', 'Motor', 'Elétrica / painel', 'Iluminação', 'Lataria / avaria', 'Vazamento', 'Suspensão / direção', 'Documentação', 'Outro'];
const SEVERITY = { baixa: { l: 'Baixa', c: 'gray' }, media: { l: 'Média', c: 'warn' }, alta: { l: 'Alta', c: 'urg' }, critica: { l: 'Crítica', c: 'bad' } };
const MAINT_ITEMS = ['Troca de óleo', 'Filtros', 'Alinhamento', 'Balanceamento', 'Pneus', 'Revisão', 'Correia dentada', 'Freios', 'Bateria', 'Outros'];
const M_LEVEL = { normal: { l: 'Normal', c: 'gray', r: 0 }, atencao: { l: 'Atenção', c: 'warn', r: 1 }, urgente: { l: 'Urgente', c: 'urg', r: 2 }, vencido: { l: 'Vencido', c: 'bad', r: 3 } };
const FINE_TYPES = { leve: 88.38, media: 130.16, grave: 195.23, gravissima: 293.47 };


/* ----- estado (carregado do Supabase em 11-cloud.js) ----- */
let S = null;
// toda alteração é enviada ao servidor (só as diferenças, numa transação)
function save() { if (CLOUD.on) CLOUD.queue(); }

function log(type, text, o = {}) {
  S.audit.push({ id: uid('log'), at: o.at || nowTs(), type, text, vehicleId: o.vehicleId || null, driverId: o.driverId || null, userId: o.userId ?? (CUR?.id || 'sistema'), data: o.data || null });
}
function notify(to, text, o = {}) {
  S.notifications.push({ id: uid('ntf'), to, text, at: o.at || nowTs(), read: false, level: o.level || 'info', link: o.link || null });
}
