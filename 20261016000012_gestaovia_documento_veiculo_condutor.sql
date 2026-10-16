-- gestaovia v1.10.0 — documento do veículo (CRLV) para o condutor apresentar à fiscalização
-- O condutor vê somente o CRLV mais recente do veículo que está com ele (mesma regra do seguro:
-- posse aberta ou encerrada há menos de 2 h). IPVA, taxas e exercícios anteriores continuam só com a gestão.

-- CRLV mais recente (maior exercício) guardado em vehicles.docs.crlv
create or replace function private.vehicle_crlv(p_docs jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select c from jsonb_array_elements(case when jsonb_typeof(p_docs->'crlv') = 'array' then p_docs->'crlv' else '[]'::jsonb end) c
   order by case when (c->>'year') ~ '^[0-9]{4}$' then (c->>'year')::int end desc nulls last
   limit 1
$$;
revoke all on function private.vehicle_crlv(jsonb) from public, anon;
grant execute on function private.vehicle_crlv(jsonb) to authenticated, service_role;

-- dados do CRLV atual para o aplicativo do condutor (só o arquivo já enviado ao Storage)
create or replace function public.vehicle_document()
returns table (id uuid, crlv jsonb)
language sql stable security definer set search_path = '' as $$
  select v.id,
         case when x.c is null then null else jsonb_strip_nulls(jsonb_build_object(
           'year', x.c->'year', 'renavam', x.c->'renavam', 'issuedAt', x.c->'issuedAt', 'licDue', x.c->'licDue',
           'file', case when x.c->'file'->>'data' like 'sb:vehicles/%' then jsonb_build_object(
                     'name', x.c->'file'->'name', 'size', x.c->'file'->'size', 'type', x.c->'file'->'type', 'data', x.c->'file'->'data') end)) end
    from public.vehicles v
    cross join lateral (select private.vehicle_crlv(v.docs) as c) x
   where private.is_active() and (private.is_staff() or private.has_vehicle(v.id))
$$;
revoke all on function public.vehicle_document() from public, anon;
grant execute on function public.vehicle_document() to authenticated;

-- o arquivo pedido é o CRLV atual de um veículo que está com o condutor
create or replace function private.can_read_vehicle_doc(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(p_name, '/', 1) = 'vehicles' and exists (
    select 1 from public.vehicles v
     where v.id::text = split_part(p_name, '/', 2)
       and private.has_vehicle(v.id)
       and private.vehicle_crlv(v.docs)->'file'->>'data' = 'sb:' || p_name)
$$;
revoke all on function private.can_read_vehicle_doc(text) from public, anon;
grant execute on function private.can_read_vehicle_doc(text) to authenticated, service_role;

drop policy if exists "gestaovia: condutor le o CRLV do veiculo com ele" on storage.objects;
create policy "gestaovia: condutor le o CRLV do veiculo com ele" on storage.objects for select to authenticated
  using (bucket_id = 'vialink-arquivos' and (select private.is_active()) and private.can_read_vehicle_doc(name));
