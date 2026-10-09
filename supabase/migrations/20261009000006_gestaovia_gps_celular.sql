-- =====================================================================
-- gestaovia · 6 · Localização pelo GPS do celular do condutor (sem Traccar)
-- O condutor que está com o veículo grava o histórico de posições e os
-- alertas de velocidade medidos pelo celular. A gestão lê tudo.
-- Nada é apagado: as tabelas e funções antigas do Traccar ficam sem uso.
-- =====================================================================
alter table public.vehicle_positions add column if not exists driver_id uuid references public.drivers(id) on delete set null;
alter table public.vehicle_positions add column if not exists source text not null default 'celular';
create index if not exists vehicle_positions_driver_at on public.vehicle_positions(driver_id, at desc);

grant insert on public.vehicle_positions to authenticated;
create policy "gestao ou condutor com o veiculo grava posicoes" on public.vehicle_positions for insert to authenticated
  with check ((select private.is_manager())
              or (driver_id = (select private.my_driver_id()) and private.has_vehicle(vehicle_id)));

create policy "condutor com o veiculo grava alertas" on public.tracker_events for insert to authenticated
  with check (driver_id = (select private.my_driver_id()) and private.has_vehicle(vehicle_id));
