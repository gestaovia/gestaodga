-- =====================================================================
-- gestaovia · 7 · Perfil do usuário (nome e foto) e revisão de segurança
-- Somente inclusões e ajustes (ALTER); nada é apagado.
-- =====================================================================

-- ---------- foto de perfil (imagem pequena, já reduzida pelo app) ----------
alter table public.profiles add column if not exists avatar text;
alter table public.profiles add constraint profiles_avatar_ok
  check (avatar is null or (length(avatar) < 400000 and avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'));

-- o próprio usuário altera nome e foto (o resto do perfil continua só pelo servidor)
create or replace function public.update_my_profile(p_name text, p_avatar text default null, p_clear_avatar boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; n text := btrim(coalesce(p_name, ''));
begin
  select * into me from public.profiles where id = (select auth.uid()) and active;
  if me.id is null then raise exception 'Seu acesso está inativo.' using errcode = '42501'; end if;
  if length(n) < 3 or length(n) > 80 then raise exception 'Informe o nome (3 a 80 caracteres).' using errcode = '22023'; end if;
  update public.profiles
     set name = n,
         avatar = case when p_clear_avatar then null when p_avatar is not null then p_avatar else avatar end
   where id = me.id;
  if me.driver_id is not null then update public.drivers set name = n where id = me.driver_id; end if;
  return (select jsonb_build_object('name', p.name, 'avatar', p.avatar) from public.profiles p where p.id = me.id);
end $$;
revoke all on function public.update_my_profile(text, text, boolean) from public, anon;
grant execute on function public.update_my_profile(text, text, boolean) to authenticated;

-- ---------- veículos: condutor não lê locação, documentos nem custos ----------
-- a gestão lê a tabela; o condutor lê o veículo que está com ele e, para escanear qualquer
-- QR Code, uma lista só com dados de identificação (vehicle_directory)
alter policy "ativos leem" on public.vehicles using ((select private.is_staff()) or private.has_vehicle(id));
create or replace function public.vehicle_directory()
returns table (id uuid, plate text, brand text, model text, year numeric, fuel_type text, avg_km_l numeric, odometer numeric,
               seats numeric, ownership text, maintenance boolean, active boolean, tracker boolean)
language sql stable security definer set search_path = '' as $$
  select v.id, v.plate, v.brand, v.model, v.year, v.fuel_type, v.avg_km_l, v.odometer, v.seats, v.ownership, v.maintenance, v.active, v.tracker
    from public.vehicles v where private.is_active() order by v.plate
$$;
revoke all on function public.vehicle_directory() from public, anon;
grant execute on function public.vehicle_directory() to authenticated;

-- ---------- checklists são evidência: depois de gravados, só a gestão altera ----------
alter policy "gestao ou o proprio altera" on public.checklists
  using ((select private.is_manager())) with check ((select private.is_manager()));

-- ---------- abastecimento só no veículo que está com o condutor ----------
alter policy "gestao ou o proprio registra" on public.fuel_records
  with check ((select private.is_manager()) or (driver_id = (select private.my_driver_id()) and private.has_vehicle(vehicle_id)));

-- ---------- notificações: condutor só avisa a gestão ou quem está na mesma transferência ----------
create or replace function private.can_notify(p_target text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff()
      or p_target = 'gestao'
      or exists (select 1 from public.transfers t
                  where (t.status not in ('concluida','cancelada') or t.requested_at > now() - interval '2 days')
                    and (t.from_driver_id = private.my_driver_id() or t.to_driver_id = private.my_driver_id())
                    and p_target in (t.from_driver_id::text, t.to_driver_id::text))
$$;
revoke all on function private.can_notify(text) from public, anon;
grant execute on function private.can_notify(text) to authenticated;
alter policy "ativos enviam" on public.notifications
  with check ((select private.is_active()) and private.can_notify(to_target));

-- ---------- integração Traccar desativada ----------
revoke execute on function public.traccar_status() from authenticated;
revoke execute on function public.set_traccar_config(text, text) from authenticated;
