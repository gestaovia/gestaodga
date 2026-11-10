-- gestaovia v1.17.0 — checklist diário só entra no banco com quilometragem e foto do painel (hodômetro)
-- Motivo: celulares com o aplicativo antigo aberto (sem a regra da v1.16.0) ainda gravavam diários sem foto.
-- Vale só para inclusões novas (diários já gravados não mudam). A gestão continua podendo alterar registros.
create or replace function private.guard_daily_photo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.type = 'diario' then
    if coalesce(new.km, 0) <= 0 then
      raise exception 'Checklist diário sem quilometragem. Feche e abra o aplicativo para atualizar e faça o checklist de novo.' using errcode = '23514';
    end if;
    if coalesce(new.photos->>'painel', '') = '' or (new.photos->>'painel') like 'removida%' then
      raise exception 'Checklist diário sem a foto do painel com o hodômetro. Feche e abra o aplicativo para atualizar e faça o checklist de novo.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_daily_photo on public.checklists;
create trigger guard_daily_photo before insert on public.checklists
  for each row execute function private.guard_daily_photo();
