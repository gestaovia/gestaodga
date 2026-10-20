-- gestaovia v1.13.0 · premiação: decisão da gestão sobre checklist diário em dia não útil (sábado, domingo ou feriado)
-- Fica em bonus_adjustments (mesmas regras: só a gestão grava; não se altera; desfazer = cancelar com motivo):
--   kind 'diaextra'  = dia considerado (conta como um dia útil a mais: soma nos dias com posse e nos dias úteis do condutor)
--   kind 'diarecusa' = dia não considerado (motivo obrigatório)
--   key 'N:AAAA-MM-DD' = o dia avaliado
alter table public.bonus_adjustments drop constraint if exists bonus_adjustments_kind_check;
alter table public.bonus_adjustments add constraint bonus_adjustments_kind_check
  check (kind in ('abono','ocorrencia','ajuste','diaextra','diarecusa'));
alter table public.bonus_adjustments drop constraint if exists bonus_adjustments_nb_key_check;
alter table public.bonus_adjustments add constraint bonus_adjustments_nb_key_check
  check (kind not in ('diaextra','diarecusa') or key ~ '^N:[0-9]{4}-[0-9]{2}-[0-9]{2}$');
