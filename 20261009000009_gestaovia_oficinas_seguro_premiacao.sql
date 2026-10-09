-- =====================================================================
-- gestaovia · 9 · Oficinas credenciadas, seguro do veículo e
-- premiação conforme o Regulamento do Programa de Pontuação (versão 00)
-- Somente inclusões e ajustes; nada é apagado.
-- =====================================================================

-- ---------- oficinas credenciadas ----------
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  cnpj text, phone text, contact text, email text,
  address text, city text,
  services jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  extra jsonb not null default '{}'
);
alter table public.workshops enable row level security;
revoke all on public.workshops from anon;
grant select, insert, update, delete on public.workshops to authenticated;
create policy "equipe le" on public.workshops for select to authenticated using ((select private.is_staff()));
create policy "gestao grava" on public.workshops for insert to authenticated with check ((select private.is_manager()));
create policy "gestao altera" on public.workshops for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy "gestao exclui sem uso" on public.workshops for delete to authenticated using ((select private.is_manager()));

-- oficina credenciada (ativa) obrigatória
create or replace function private.workshop_ok(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p is not null and p ~ '^[0-9a-f-]{36}$' and exists (select 1 from public.workshops w where w.id = p::uuid and w.active)
$$;
revoke all on function private.workshop_ok(text) from public, anon;
grant execute on function private.workshop_ok(text) to authenticated;

-- serviço realizado só em oficina credenciada (registros antigos continuam valendo)
create or replace function private.maint_record_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or (new.extra->>'workshopId') is distinct from (old.extra->>'workshopId') then
    if not private.workshop_ok(new.extra->>'workshopId') then
      raise exception 'Manutenção só pode ser feita em oficina credenciada.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create or replace trigger maint_record_guard before insert or update on public.maintenance_records
  for each row execute function private.maint_record_guard();

-- veículo só entra em manutenção numa oficina credenciada
create or replace function private.vehicle_maint_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.maintenance and (tg_op = 'INSERT' or not coalesce(old.maintenance, false)
      or (new.extra->>'maintenanceWorkshopId') is distinct from (old.extra->>'maintenanceWorkshopId')) then
    if not private.workshop_ok(new.extra->>'maintenanceWorkshopId') then
      raise exception 'O veículo só pode ser enviado para uma oficina credenciada.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create or replace trigger vehicle_maint_guard before insert or update on public.vehicles
  for each row execute function private.vehicle_maint_guard();

-- ---------- seguro e contato de emergência do veículo ----------
alter table public.vehicles add column if not exists insurance jsonb;
-- condutor vê só o necessário para acionar o seguro do veículo que está com ele
create or replace function public.vehicle_emergency()
returns table (id uuid, insurance jsonb)
language sql stable security definer set search_path = '' as $$
  select v.id, case when v.insurance is null then null else jsonb_strip_nulls(jsonb_build_object(
           'insurer', v.insurance->'insurer', 'policy', v.insurance->'policy', 'end', v.insurance->'end',
           'assist', v.insurance->'assist', 'claim', v.insurance->'claim', 'broker', v.insurance->'broker',
           'brokerPhone', v.insurance->'brokerPhone', 'contactName', v.insurance->'contactName',
           'contactPhone', v.insurance->'contactPhone', 'notes', v.insurance->'notes')) end
    from public.vehicles v
   where private.is_active() and (private.is_staff() or private.has_vehicle(v.id))
$$;
revoke all on function public.vehicle_emergency() from public, anon;
grant execute on function public.vehicle_emergency() to authenticated;

-- ---------- horário do registro gravado pelo servidor (evidência da premiação) ----------
-- registros antigos ficam sem horário do servidor (o app usa o horário do aparelho deles)
alter table public.checklists add column if not exists server_at timestamptz;
alter table public.checklists alter column server_at set default now();
alter table public.fuel_records add column if not exists server_at timestamptz;
alter table public.fuel_records alter column server_at set default now();
create or replace function private.stamp_server_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.server_at := now(); else new.server_at := old.server_at; end if;
  return new;
end $$;
create or replace trigger stamp_server_at before insert or update on public.checklists for each row execute function private.stamp_server_at();
create or replace trigger stamp_server_at before insert or update on public.fuel_records for each row execute function private.stamp_server_at();

-- ---------- abonos, ocorrências e ajustes manuais da premiação ----------
-- nunca são apagados: uma correção cancela o registro (voided_*) e o original continua visível
create table if not exists public.bonus_adjustments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) deferrable initially deferred,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('abono','ocorrencia','ajuste')),
  modality text check (modality in ('A','B','C')),
  key text, points numeric not null default 0,
  at timestamptz, vehicle_id uuid,
  reason text not null check (length(btrim(reason)) >= 5),
  created_by text, created_at timestamptz not null default now(),
  voided_at timestamptz, voided_by text, void_reason text,
  extra jsonb not null default '{}'
);
create index if not exists bonus_adjustments_driver_period on public.bonus_adjustments(driver_id, period);
alter table public.bonus_adjustments enable row level security;
revoke all on public.bonus_adjustments from anon;
grant select, insert, update on public.bonus_adjustments to authenticated;
create policy "equipe ou o proprio le" on public.bonus_adjustments for select to authenticated
  using ((select private.is_staff()) or driver_id = (select private.my_driver_id()));
create policy "gestao registra" on public.bonus_adjustments for insert to authenticated with check ((select private.is_manager()));
create policy "gestao cancela" on public.bonus_adjustments for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create or replace function private.bonus_adj_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid())::text; new.created_at := now(); new.voided_at := null; new.voided_by := null; new.void_reason := null;
    return new;
  end if;
  if (new.driver_id, new.period, new.kind, new.modality, new.key, new.points, new.at, new.reason, new.created_by, new.created_at)
     is distinct from (old.driver_id, old.period, old.kind, old.modality, old.key, old.points, old.at, old.reason, old.created_by, old.created_at) then
    raise exception 'Registro da premiação não pode ser alterado; cancele e registre outro.' using errcode = '42501';
  end if;
  if old.voided_at is not null then raise exception 'Registro já cancelado.' using errcode = '42501'; end if;
  if new.voided_at is not null then
    if length(btrim(coalesce(new.void_reason, ''))) < 5 then raise exception 'Informe o motivo do cancelamento.' using errcode = '22023'; end if;
    new.voided_at := now(); new.voided_by := (select auth.uid())::text;
  end if;
  return new;
end $$;
create or replace trigger bonus_adj_guard before insert or update on public.bonus_adjustments for each row execute function private.bonus_adj_guard();

-- ---------- extrato do condutor: só o próprio, a partir da data de divulgação ----------
create or replace function public.my_bonus_statements()
returns table (month text, closed_at timestamptz, release_at timestamptz, statement jsonb)
language sql stable security definer set search_path = '' as $$
  select c.month, c.closed_at, to_timestamp((c.extra->>'releaseAt')::numeric / 1000), r.value
    from public.bonus_closings c
    cross join lateral jsonb_array_elements(c.rows) r
   where private.is_active()
     and r.value->>'driverId' = (select private.my_driver_id())::text
     and coalesce(to_timestamp((c.extra->>'releaseAt')::numeric / 1000), c.closed_at) <= now()
   order by c.month desc
$$;
revoke all on function public.my_bonus_statements() from public, anon;
grant execute on function public.my_bonus_statements() to authenticated;

-- ---------- gravação em lote passa a aceitar as novas tabelas ----------
create or replace function public.sync_apply(ops jsonb)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  op jsonb; t text; k text; r jsonb;
  cols text; sets text; upd text; n int; total int := 0;
  allowed constant text[] := array['cost_centers','projects','drivers','vehicles','qr_codes','custody','transfers',
    'checklists','issues','fuel_records','maintenance_plans','maintenance_records','tolls','fines',
    'vehicle_last_location','tracker_events','notifications','audit_logs','app_settings','bonus_closings','workshops','bonus_adjustments'];
begin
  if not private.is_active() then
    raise exception 'Seu acesso está inativo.' using errcode = '42501';
  end if;
  if jsonb_typeof(ops) is distinct from 'array' or jsonb_array_length(ops) > 1000 then
    raise exception 'Lote inválido.' using errcode = '22023';
  end if;
  set constraints all deferred;
  for op in select value from jsonb_array_elements(ops) loop
    t := op->>'t'; k := op->>'op'; r := op->'row';
    if t is null or not (t = any(allowed)) then
      raise exception 'Tabela não permitida: %', t using errcode = '42501';
    end if;
    if k = 'delete' then
      execute format('delete from public.%I where id::text = $1', t) using op->>'id';
      get diagnostics n = row_count;
      if n = 0 then raise exception 'Sem permissão para excluir (%).', t using errcode = '42501'; end if;
    elsif k in ('insert','upsert','update') then
      if jsonb_typeof(r) is distinct from 'object' or not (r ? 'id') then
        raise exception 'Registro sem id (%).', t using errcode = '22023';
      end if;
      select string_agg(quote_ident(a.attname), ',' order by a.attnum),
             string_agg(case when a.attname <> 'id' then format('%1$I = excluded.%1$I', a.attname) end, ',' order by a.attnum),
             string_agg(case when a.attname <> 'id' then format('%1$I = p.%1$I', a.attname) end, ',' order by a.attnum)
        into cols, sets, upd
        from pg_catalog.pg_attribute a
       where a.attrelid = format('public.%I', t)::regclass
         and a.attnum > 0 and not a.attisdropped and a.attidentity = '' and a.attgenerated = ''
         and r ? a.attname;
      if k = 'insert' then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', t, cols, cols, t) using r;
      elsif k = 'upsert' then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) on conflict (id) do update set %s',
                       t, cols, cols, t, coalesce(sets, 'id = excluded.id')) using r;
      elsif upd is not null then
        execute format('update public.%I x set %s from jsonb_populate_record(null::public.%I, $1) p where x.id = p.id', t, upd, t) using r;
        get diagnostics n = row_count;
        if n = 0 then raise exception 'Sem permissão para alterar (%).', t using errcode = '42501'; end if;
      end if;
    else
      raise exception 'Operação inválida: %', k using errcode = '22023';
    end if;
    total := total + 1;
  end loop;
  return total;
end $$;
revoke all on function public.sync_apply(jsonb) from public, anon;
grant execute on function public.sync_apply(jsonb) to authenticated;

-- ---------- parâmetros iniciais do programa (regulamento versão 00), vigentes a partir do período atual ----------
with k as (
  select to_char(case when extract(day from (now() at time zone 'America/Sao_Paulo')) >= 26
                      then (now() at time zone 'America/Sao_Paulo') + interval '1 month'
                      else (now() at time zone 'America/Sao_Paulo') end, 'YYYY-MM') as per,
         (extract(epoch from now()) * 1000)::bigint as ms
)
update public.app_settings s set data = jsonb_set(s.data, '{bonus}', jsonb_build_object(
    'startPeriod', k.per,
    'versions', jsonb_build_array(jsonb_build_object('from', k.per, 'at', k.ms, 'by', 'sistema', 'p', jsonb_build_object(
       'startDay', 26, 'ptsA', 50, 'ptsB', 30, 'ptsC', 20, 'discA', 50, 'discLate', 10, 'discAbsent', 15, 'deadline', '10:00',
       'discC', 10, 'zeroPenalty', 10, 'baseValue', 300, 'add100', 100, 'add90', 50, 'addMinDays', 15, 'releaseDays', 3))),
    'closing', jsonb_build_object('auto', true), 'holidays', '[]'::jsonb, 'odoSince', k.ms), true)
  from k where s.id = 1 and not (s.data ? 'bonus');
