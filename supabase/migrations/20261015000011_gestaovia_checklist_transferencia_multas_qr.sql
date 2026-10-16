-- =====================================================================
-- gestaovia · 11 · v1.9.0
-- 1. Transferência: o condutor que está com o veículo pode NEGAR a entrega
--    (motivo obrigatório) e quem pediu pode CANCELAR a solicitação.
-- 2. Recebimento confere o checklist anterior (função vehicle_checklist_reference).
-- 3. Multa apagada pelo gestor = cancelada com motivo (fica no histórico).
-- 4. QR Code do veículo é único: não pode ser gerado de novo nem trocado.
-- =====================================================================

-- ---------- 1. transferência: nova situação "negada" ----------
alter table public.transfers drop constraint if exists transfers_status_check;
alter table public.transfers add constraint transfers_status_check check (status in
  ('solicitada','aguardando_entrega','entrega_andamento','aguardando_recebimento','recebimento_andamento','concluida','cancelada','negada'));

create or replace function private.guard_transfer_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_driver_id();
begin
  if private.is_manager() or (select auth.role()) = 'service_role' or (select auth.uid()) is null then return new; end if;
  if new.vehicle_id <> old.vehicle_id or new.from_driver_id is distinct from old.from_driver_id
     or new.to_driver_id is distinct from old.to_driver_id or new.forced <> old.forced then
    raise exception 'Somente a gestão altera condutores ou força uma transferência.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status in ('concluida','cancelada','negada') then
      raise exception 'Esta transferência já foi encerrada.' using errcode = '42501';
    end if;
    -- negar: só o condutor que está com o veículo, antes de concluir a entrega, com motivo
    if new.status = 'negada' then
      if me is distinct from old.from_driver_id or old.status not in ('solicitada','aguardando_entrega','entrega_andamento') then
        raise exception 'Somente o condutor que está com o veículo pode negar a entrega, antes de entregá-lo.' using errcode = '42501';
      end if;
      if length(trim(coalesce(new.extra->>'denyReason', ''))) < 5 then
        raise exception 'Informe o motivo para negar a entrega.' using errcode = '23514';
      end if;
    end if;
    -- cancelar: só quem pediu (novo condutor), antes de concluir a entrega
    if new.status = 'cancelada' then
      if me is distinct from old.to_driver_id or old.status not in ('solicitada','aguardando_entrega','entrega_andamento') then
        raise exception 'Somente quem pediu o veículo pode cancelar a solicitação, antes da entrega.' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------- 2. referência para o checklist de recebimento ----------
-- último checklist completo do veículo e a última posse encerrada (para quem vai receber conferir)
create or replace function public.vehicle_checklist_reference(p_vehicle uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; pc jsonb; me uuid := private.my_driver_id();
begin
  if not private.is_active() then raise exception 'Seu acesso está inativo.' using errcode = '42501'; end if;
  if not (private.is_staff() or (me is not null and (
        not exists (select 1 from public.custody c where c.vehicle_id = p_vehicle and c.ended_at is null)
        or exists (select 1 from public.custody c where c.vehicle_id = p_vehicle and c.ended_at is null and c.driver_id = me)
        or exists (select 1 from public.transfers t where t.vehicle_id = p_vehicle and t.to_driver_id = me
                    and t.status not in ('concluida','cancelada','negada'))))) then
    raise exception 'Sem permissão para consultar este veículo.' using errcode = '42501';
  end if;
  select jsonb_build_object('id', k.id, 'type', k.type, 'at', k.at, 'km', k.km, 'items', k.items, 'avarias', k.avarias,
                            'fuelLevel', k.fuel_level, 'driverId', k.driver_id, 'driverName', dr.name)
    into r
    from public.checklists k left join public.drivers dr on dr.id = k.driver_id
   where k.vehicle_id = p_vehicle and jsonb_typeof(k.items) = 'object' and k.items <> '{}'::jsonb
   order by k.at desc limit 1;
  select jsonb_build_object('id', c.id, 'driverId', c.driver_id, 'driverName', dr.name, 'endedAt', c.ended_at, 'closedReason', c.closed_reason,
                            'deliverChecklistId', c.deliver_checklist_id, 'quick', coalesce((k.extra->>'quick')::boolean, false), 'deliverAt', k.at, 'deliverKm', k.km)
    into pc
    from public.custody c left join public.drivers dr on dr.id = c.driver_id left join public.checklists k on k.id = c.deliver_checklist_id
   where c.vehicle_id = p_vehicle and c.ended_at is not null
   order by c.ended_at desc limit 1;
  return jsonb_build_object('ref', r, 'prev', pc);
end $$;
revoke all on function public.vehicle_checklist_reference(uuid) from public, anon;
grant execute on function public.vehicle_checklist_reference(uuid) to authenticated;

-- ---------- 3. multas: apagar = cancelar com motivo (sem perder o histórico) ----------
create or replace function private.guard_fine_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'service_role' or (select auth.uid()) is null then return new; end if;
  if nullif(old.extra->>'voidedAt', '') is not null and not private.is_admin() then
    raise exception 'Multa apagada não pode ser alterada.' using errcode = '42501';
  end if;
  if nullif(new.extra->>'voidedAt', '') is not null and nullif(old.extra->>'voidedAt', '') is null
     and length(trim(coalesce(new.extra->>'voidReason', ''))) < 5 then
    raise exception 'Informe o motivo para apagar a multa.' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace trigger guard_fine_update before update on public.fines for each row execute function private.guard_fine_update();
-- exclusão definitiva só pelo administrador (o gestor apaga cancelando com motivo)
alter policy "gestao exclui" on public.fines using ((select private.is_admin()));

-- ---------- 4. QR Code único por veículo ----------
create or replace function private.guard_qr_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'service_role' or (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.qr_codes q where q.vehicle_id = new.vehicle_id) then
      raise exception 'O QR Code deste veículo é único e não pode ser gerado de novo. Use Imprimir QR Code.' using errcode = '42501';
    end if;
  elsif new.token is distinct from old.token or new.vehicle_id is distinct from old.vehicle_id or new.active is distinct from old.active then
    raise exception 'O QR Code do veículo é único e não pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace trigger guard_qr_code before insert or update on public.qr_codes for each row execute function private.guard_qr_code();
-- ninguém exclui QR Code pela API (a exclusão do veículo pelo proprietário apaga junto, pela função delete_vehicle)
alter policy "admin exclui" on public.qr_codes using (false);
