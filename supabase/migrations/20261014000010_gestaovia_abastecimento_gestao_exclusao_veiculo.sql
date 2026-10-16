-- gestaovia v1.7.0
-- 1) Exclusão de veículo: somente o PROPRIETÁRIO do sistema (profiles.is_owner), conferido no banco.
-- 2) Abastecimento lançado pela gestão (administrador, gestor de frota e supervisor/assistente administrativo)
--    em nome do condutor/veículo; registro do condutor passa a ser opcional.
--    Quem lançou (entered_by) e a origem (source) são gravados pelo servidor; bloqueio de duplicidade.

-- ---------- proprietário ----------
create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.is_owner)
$$;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated, service_role;

-- exclusão direta da tabela de veículos: antes qualquer administrador; agora só o proprietário
alter policy "admin exclui" on public.vehicles using ((select private.is_owner()));
alter policy "admin exclui" on public.vehicles rename to "proprietario exclui";

-- exclusão completa de um veículo e do histórico DELE (posses, checklists, abastecimentos, QR Code etc.)
-- Nada de outros veículos é tocado. Pedágios e multas (ligados à placa, não ao cadastro) ficam como estão.
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

-- ---------- abastecimento ----------
alter table public.fuel_records add column if not exists entered_by uuid references public.profiles(id) on delete set null;
alter table public.fuel_records add column if not exists source text;
update public.fuel_records set source = 'condutor' where source is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fuel_records_source_chk') then
    alter table public.fuel_records add constraint fuel_records_source_chk check (source in ('condutor', 'gestao'));
  end if;
end $$;
create index if not exists fuel_records_vehicle_at_idx on public.fuel_records (vehicle_id, at);

-- quem lançou e a origem são definidos pelo servidor (o aplicativo não consegue forjar)
-- + bloqueio de duplicidade: mesmo veículo, até 24 h de diferença, km a até 5 e litros a até 0,5
create or replace function private.fuel_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.entered_by := (select auth.uid());
      new.source := case when private.is_staff() then 'gestao' else 'condutor' end;
    else
      new.source := coalesce(new.source, 'gestao');
    end if;
  else
    new.entered_by := old.entered_by; new.source := old.source;
  end if;
  if new.km is null or new.km <= 0 then raise exception 'Informe a quilometragem do abastecimento.' using errcode = '23514'; end if;
  if new.liters is null or new.liters <= 0 then raise exception 'Informe os litros do abastecimento.' using errcode = '23514'; end if;
  if new.at > now() + interval '10 minutes' then raise exception 'A data do abastecimento não pode ser no futuro.' using errcode = '23514'; end if;
  if exists (select 1 from public.fuel_records f
              where f.vehicle_id = new.vehicle_id and f.id <> new.id
                and f.at between new.at - interval '24 hours' and new.at + interval '24 hours'
                and abs(f.km - new.km) <= 5 and abs(f.liters - new.liters) <= 0.5) then
    raise exception 'Este abastecimento já foi registrado (mesmo veículo, quilometragem e litros).' using errcode = '23505';
  end if;
  return new;
end $$;
create or replace trigger fuel_guard before insert or update on public.fuel_records for each row execute function private.fuel_guard();

-- a quilometragem do veículo acompanha o abastecimento (também quando lançado pelo supervisor/assistente)
create or replace function private.fuel_bump_odometer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.vehicles set odometer = new.km where id = new.vehicle_id and coalesce(odometer, 0) < new.km;
  return new;
end $$;
create or replace trigger fuel_bump_odometer after insert on public.fuel_records for each row execute function private.fuel_bump_odometer();

-- quem registra: gestão (administrador, gestor e supervisor/assistente) para qualquer veículo;
-- condutor só o próprio, no veículo que está com ele (como antes)
alter policy "gestao ou o proprio registra" on public.fuel_records
  with check ((select private.is_staff()) or ((driver_id = (select private.my_driver_id())) and private.has_vehicle(vehicle_id)));
alter policy "gestao ou o proprio registra" on public.fuel_records rename to "equipe ou o proprio registra";
