-- ============================================================================
-- No repetir la misma franja horaria en la misma semana
-- ============================================================================
-- Regla del club: si un socio ya ha jugado (como titular o acompañante) a
-- las 16:00 esta semana, no puede volver a reservar las 16:00 hasta la
-- semana siguiente. Es para que nadie se quede siempre con "las horas
-- buenas" reservando la misma franja todas las semanas por adelantado.
--
-- La semana es de lunes a domingo (date_trunc('week', ...) en Postgres ya
-- usa ISO, es decir, empieza en lunes).
-- ============================================================================

begin;

create or replace function public._member_has_weekly_slot(p_member_id text, p_date date, p_time text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from reservations r
    where r.time = p_time
      and date_trunc('week', r.date::date::timestamp) = date_trunc('week', p_date::timestamp)
      and (r.member_id = p_member_id or r.companion_member_id = p_member_id)
  );
$$;

revoke all on function public._member_has_weekly_slot(text, date, text) from public, anon, authenticated;

-- create_reservation: se añaden las comprobaciones de franja semanal, además
-- del límite diario ya existente (migración 004).
create or replace function public.create_reservation(
  p_code         text,
  p_table_id     int,
  p_date         date,
  p_time         text,
  p_is_solo      boolean,
  p_companion_id text default null
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
    is_solo, companion_name, companion_member_id
  )
  values (
    p_table_id, p_date, p_time, v_caller.name, v_caller.id::text,
    p_is_solo,
    case when p_is_solo then null else v_companion.name end,
    case when p_is_solo then null else v_companion.id::text end
  )
  returning * into v_row;

  return v_row;
exception
  -- Lo lanza el índice único del PASO 2 cuando otra persona se adelantó.
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado por otro socio';
end;
$$;

-- join_reservation: quien se une también tiene que cumplir la regla de la
-- franja semanal (y el límite diario, migración 004).
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

  if public._member_daily_hours(v_caller.id::text, v_res.date::date) + 0.5 > 1.0 then
    raise exception 'Ya has alcanzado tu límite de 1 hora de mesa para ese día';
  end if;

  if public._member_has_weekly_slot(v_caller.id::text, v_res.date::date, v_res.time) then
    raise exception 'Ya tienes una reserva a las % esta semana. Prueba otra hora o espera a la semana que viene.', v_res.time;
  end if;

  update reservations
  set is_solo = false,
      companion_name = v_caller.name,
      companion_member_id = v_caller.id::text
  where id = v_res.id
    and is_solo = true
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
--   1. Un socio reserva las 16:00 el lunes de esta semana. Si intenta
--      reservar las 16:00 el jueves de la MISMA semana (aunque sea otra
--      mesa), debe fallar con el mensaje de franja semanal repetida.
--   2. La semana siguiente, reservar las 16:00 debe funcionar sin problema.
--   3. Si alguien intenta unirse (join_reservation) a una partida de las
--      16:00 y ya tiene otra reserva a las 16:00 esa misma semana, debe
--      fallar igual.
