-- gestaovia v1.14.0 — frota comercial e motorista administrativo
-- drivers.kind: 'obra' (participa da premiação) ou 'administrativo' (função comercial: sem premiação, diário opcional)
-- vehicles.fleet: 'obra' ou 'comercial' (classificação do veículo para filtros e indicadores)
-- projects: obra reservada COMERCIAL (id fixo), usada como "obra" padrão do motorista administrativo

alter table public.drivers add column if not exists kind text not null default 'obra' constraint drivers_kind_check check (kind in ('obra', 'administrativo'));
alter table public.vehicles add column if not exists fleet text not null default 'obra' constraint vehicles_fleet_check check (fleet in ('obra', 'comercial'));

comment on column public.drivers.kind is 'obra = motorista de obra (premiação); administrativo = função comercial, sem premiação, checklist diário opcional';
comment on column public.vehicles.fleet is 'obra = frota de obra; comercial = frota comercial (classificação)';

-- obra reservada para o uso comercial (o código e a descrição podem ser trocados pela gestão; fica sempre ativa)
insert into public.projects (id, code, name, active, extra)
select '00000000-0000-4000-a000-00000000c0e1', 'COMERCIAL', 'Frota comercial', true, '{"system": "comercial"}'::jsonb
where not exists (select 1 from public.projects where id = '00000000-0000-4000-a000-00000000c0e1')
  and not exists (select 1 from public.projects where code = 'COMERCIAL');

-- a obra COMERCIAL não pode ser encerrada nem excluída
create or replace function private.guard_commercial_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.id = '00000000-0000-4000-a000-00000000c0e1'::uuid then
    if tg_op = 'DELETE' then
      raise exception 'A obra reservada da frota comercial não pode ser excluída.' using errcode = '42501';
    end if;
    if new.active is distinct from true then
      raise exception 'A obra reservada da frota comercial fica sempre ativa.' using errcode = '23514';
    end if;
    new.extra := coalesce(new.extra, '{}'::jsonb) || '{"system": "comercial"}'::jsonb;
  end if;
  return coalesce(new, old);
end $$;
create or replace trigger guard_commercial_project before update or delete on public.projects
  for each row execute function private.guard_commercial_project();
