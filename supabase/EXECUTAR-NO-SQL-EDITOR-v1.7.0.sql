-- gestaovia v1.7.0 · função de exclusão de veículo (somente o proprietário)
-- COMO USAR: Supabase › projeto gestaovia › SQL Editor › New query › cole TODO este arquivo › Run.
-- Pode rodar mais de uma vez sem problema. As demais mudanças da v1.7.0 já foram aplicadas no banco.
-- O que faz: cria a função delete_vehicle, que só funciona para o usuário marcado como proprietário
-- e apaga o veículo escolhido junto com o histórico DELE (nenhum outro veículo é alterado).

create or replace function public.delete_vehicle(p_vehicle uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v record; n jsonb := '{}'::jsonb; c int;
begin
  if not private.is_owner() then
    raise exception 'Somente o proprietário do sistema pode excluir veículos.' using errcode = '42501';
  end if;
  select id, plate into v from public.vehicles where id = p_vehicle for update;
  if not found then raise exception 'Veículo não encontrado.' using errcode = 'P0002'; end if;
  set constraints all deferred;
  delete from public.transfers where vehicle_id = p_vehicle;            get diagnostics c = row_count; n := n || jsonb_build_object('transferencias', c);
  delete from public.fuel_records where vehicle_id = p_vehicle;         get diagnostics c = row_count; n := n || jsonb_build_object('abastecimentos', c);
  delete from public.checklists where vehicle_id = p_vehicle;           get diagnostics c = row_count; n := n || jsonb_build_object('checklists', c);
  delete from public.custody where vehicle_id = p_vehicle;              get diagnostics c = row_count; n := n || jsonb_build_object('posses', c);
  delete from public.issues where vehicle_id = p_vehicle;               get diagnostics c = row_count; n := n || jsonb_build_object('problemas', c);
  delete from public.maintenance_records where vehicle_id = p_vehicle;  get diagnostics c = row_count; n := n || jsonb_build_object('manutencoes', c);
  delete from public.maintenance_plans where vehicle_id = p_vehicle;
  delete from public.qr_codes where vehicle_id = p_vehicle;
  delete from public.tracker_events where vehicle_id = p_vehicle;
  delete from public.vehicle_positions where vehicle_id = p_vehicle;
  delete from public.vehicle_last_location where id = p_vehicle;
  delete from public.audit_logs where vehicle_id = p_vehicle;
  update public.bonus_adjustments set vehicle_id = null where vehicle_id = p_vehicle; -- lançamentos da premiação ficam (são do condutor)
  delete from public.vehicles where id = p_vehicle;
  insert into public.audit_logs (at, type, text, vehicle_id, user_id, data)
  values (now(), 'exclusao', format('Veículo %s excluído pelo proprietário (com o histórico do veículo)', v.plate), null, (select auth.uid())::text,
          n || jsonb_build_object('placa', v.plate));
  return n;
end $$;
revoke all on function public.delete_vehicle(uuid) from public, anon;
grant execute on function public.delete_vehicle(uuid) to authenticated;
