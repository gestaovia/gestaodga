-- =====================================================================
-- gestaovia · 8 · Fechamento mensal da premiação (para o RH)
-- Cada mês fechado guarda a pontuação e o prêmio de cada condutor como
-- estavam no fechamento; mudanças posteriores não alteram o que foi pago.
-- Somente inclusões e substituição de função (sem exclusões).
-- =====================================================================
create table if not exists public.bonus_closings (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  closed_at timestamptz not null default now(),
  closed_by text,
  auto boolean not null default false,
  rows jsonb not null default '[]',
  total numeric not null default 0,
  extra jsonb not null default '{}'
);
alter table public.bonus_closings enable row level security;
revoke all on public.bonus_closings from anon;
grant select, insert, update, delete on public.bonus_closings to authenticated;
create policy "equipe le" on public.bonus_closings for select to authenticated using ((select private.is_staff()));
create policy "gestao fecha" on public.bonus_closings for insert to authenticated with check ((select private.is_manager()));
create policy "gestao altera" on public.bonus_closings for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy "admin reabre" on public.bonus_closings for delete to authenticated using ((select private.is_admin()));

-- gravação em lote passa a aceitar a nova tabela
create or replace function public.sync_apply(ops jsonb)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  op jsonb; t text; k text; r jsonb;
  cols text; sets text; upd text; n int; total int := 0;
  allowed constant text[] := array['cost_centers','projects','drivers','vehicles','qr_codes','custody','transfers',
    'checklists','issues','fuel_records','maintenance_plans','maintenance_records','tolls','fines',
    'vehicle_last_location','tracker_events','notifications','audit_logs','app_settings','bonus_closings'];
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
