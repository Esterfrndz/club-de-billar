-- ============================================================================
-- Partidas en solitario abiertas o cerradas
-- ============================================================================
-- Al reservar en modo "juego solo", el socio decide si permite que otro se
-- una a su partida. Si no lo permite, la reserva no ofrece el botón "Unirse"
-- y join_reservation la rechaza.
--
-- El reparto de horas NO cambia y sigue calculándose desde `is_solo`
-- (migración 004): mientras la partida siga en solitario el titular gasta 1h;
-- en cuanto alguien se une pasa a 0,5h para cada uno.
--
-- Las reservas ya existentes se quedan en `true`, que es como se comportaban
-- hasta ahora: cualquier partida en solitario era abierta.
-- ============================================================================

begin;

alter table reservations
  add column if not exists allow_join boolean not null default true;

comment on column reservations.allow_join is 'Solo aplica a partidas con is_solo=true: si es false, nadie puede unirse';

create or replace function public.create_reservation(
  p_code         text,
  p_table_id     int,
  p_date         date,
  p_time         text,
  p_is_solo      boolean,
  p_companion_id text default null,
  p_category     text default null,
  p_game_mode    text default null,
  p_allow_join   boolean default true
)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    members;
  v_companion members;
  v_row       reservations;
begin
  v_caller := public._require_member(p_code);

  if p_table_id is null or p_date is null or p_time is null then
    raise exception 'Faltan datos obligatorios';
  end if;

  if p_category is null or p_category not in ('principiante', 'avanzado', 'competitivo') then
    raise exception 'Debes indicar tu categoría: principiante, avanzado o competitivo';
  end if;

  if p_game_mode is null or p_game_mode not in ('libre', 'cuadro', 'tres_bandas', 'una_banda') then
    raise exception 'Debes indicar la modalidad de juego: tres bandas, libre, una banda o cuadro';
  end if;

  if p_date < current_date then
    raise exception 'No se pueden crear reservas en fechas pasadas';
  end if;

  if public._member_has_weekly_slot(v_caller.id::text, p_date, p_time) then
    raise exception 'Ya tienes una reserva a las % esta semana. Prueba otra hora o espera a la semana que viene.', p_time;
  end if;

  if p_is_solo then
    if public._member_daily_hours(v_caller.id::text, p_date) + 1.0 > 1.0 then
      raise exception 'Ya has alcanzado tu límite de 1 hora de mesa para ese día';
    end if;
  else
    if p_companion_id is null or p_companion_id = '' then
      raise exception 'Debes seleccionar un acompañante';
    end if;
    select * into v_companion from members m where m.id::text = p_companion_id;
    if v_companion.id is null then
      raise exception 'El acompañante seleccionado no existe';
    end if;
    if v_companion.id = v_caller.id then
      raise exception 'No puedes seleccionarte a ti mismo como acompañante';
    end if;

    if public._member_daily_hours(v_caller.id::text, p_date) + 0.5 > 1.0 then
      raise exception 'Ya has alcanzado tu límite de 1 hora de mesa para ese día';
    end if;
    if public._member_daily_hours(v_companion.id::text, p_date) + 0.5 > 1.0 then
      raise exception 'Tu acompañante ya ha alcanzado su límite de 1 hora de mesa para ese día';
    end if;
    if public._member_has_weekly_slot(v_companion.id::text, p_date, p_time) then
      raise exception 'Tu acompañante ya tiene una reserva a las % esta semana.', p_time;
    end if;
  end if;

  insert into reservations (
    table_id, date, time, customer_name, member_id,
    is_solo, companion_name, companion_member_id,
    category, game_mode, allow_join
  )
  values (
    p_table_id, p_date, p_time, v_caller.name, v_caller.id::text,
    p_is_solo,
    case when p_is_solo then null else v_companion.name end,
    case when p_is_solo then null else v_companion.id::text end,
    p_category, p_game_mode,
    -- En una reserva acompañada el permiso no significa nada: la plaza ya
    -- está ocupada. Se guarda false para que no confunda al leer la tabla.
    case when p_is_solo then coalesce(p_allow_join, true) else false end
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado por otro socio';
end;
$$;

-- La versión de 8 argumentos deja de usarse.
drop function if exists public.create_reservation(text, int, date, text, boolean, text, text, text);

-- join_reservation: se respeta la decisión del titular. La comprobación va
-- también dentro del UPDATE para que dos personas a la vez no puedan colarse.
create or replace function public.join_reservation(p_code text, p_id text)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller members;
  v_res    reservations;
  v_row    reservations;
begin
  v_caller := public._require_member(p_code);

  select * into v_res from reservations r where r.id::text = p_id;
  if v_res.id is null then
    raise exception 'Reserva no encontrada';
  end if;
  if v_res.member_id = v_caller.id::text then
    raise exception 'Ya eres el titular de esta reserva';
  end if;
  if not v_res.allow_join then
    raise exception 'El titular de esta partida no permite que se unan otros socios';
  end if;

  if public._member_daily_hours(v_caller.id::text, v_res.date::date) + 0.5 > 1.0 then
    raise exception 'Ya has alcanzado tu límite de 1 hora de mesa para ese día';
  end if;

  if public._member_has_weekly_slot(v_caller.id::text, v_res.date::date, v_res.time) then
    raise exception 'Ya tienes una reserva a las % esta semana. Prueba otra hora o espera a la semana que viene.', v_res.time;
  end if;

  update reservations
  set is_solo = false,
      companion_name = v_caller.name,
      companion_member_id = v_caller.id::text,
      allow_join = false
  where id = v_res.id
    and is_solo = true
    and allow_join = true
    and companion_member_id is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Alguien se ha unido a esta partida antes que tú';
  end if;

  return v_row;
end;
$$;

commit;

-- Verificación manual:
--   1. Reservar solo permitiendo unirse -> en "Partidas de Hoy" sale "Unirse".
--   2. Reservar solo SIN permitir unirse -> no sale el botón, y llamar a
--      join_reservation a mano debe fallar con el mensaje del titular.
--   3. Tras unirse alguien: el titular pasa de 1h a 0,5h y quien se une suma
--      0,5h (esto lo da `is_solo`, no hace falta tocar nada más).
