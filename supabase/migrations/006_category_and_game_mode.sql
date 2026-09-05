-- ============================================================================
-- Categoría del jugador y modalidad de juego en cada reserva
-- ============================================================================
-- Al reservar, el socio indica ahora dos datos más:
--   * category  : 'principiante' | 'avanzado' | 'competitivo'
--   * game_mode : 'libre' | 'cuadro' | 'tres_bandas'
--
-- Se guardan en la propia reserva (y no en el socio) porque la categoría con
-- la que se juega y la modalidad pueden cambiar de una partida a otra.
-- ============================================================================

begin;

alter table reservations
  add column if not exists category  text,
  add column if not exists game_mode text;

comment on column reservations.category  is 'Categoría del jugador en esta partida: principiante | avanzado | competitivo';
comment on column reservations.game_mode is 'Modalidad de juego: libre | cuadro | tres_bandas';

-- Las reservas antiguas se quedan con NULL, así que las restricciones sólo
-- pueden validar el valor, no exigir que exista.
alter table reservations drop constraint if exists reservations_category_check;
alter table reservations add constraint reservations_category_check
  check (category is null or category in ('principiante', 'avanzado', 'competitivo'));

alter table reservations drop constraint if exists reservations_game_mode_check;
alter table reservations add constraint reservations_game_mode_check
  check (game_mode is null or game_mode in ('libre', 'cuadro', 'tres_bandas'));

-- create_reservation: mismos controles que en la migración 005, más los dos
-- campos nuevos, que sí son obligatorios para las reservas que se creen desde
-- ahora.
create or replace function public.create_reservation(
  p_code         text,
  p_table_id     int,
  p_date         date,
  p_time         text,
  p_is_solo      boolean,
  p_companion_id text default null,
  p_category     text default null,
  p_game_mode    text default null
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

  if p_game_mode is null or p_game_mode not in ('libre', 'cuadro', 'tres_bandas') then
    raise exception 'Debes indicar la modalidad de juego: libre, cuadro o tres bandas';
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
    category, game_mode
  )
  values (
    p_table_id, p_date, p_time, v_caller.name, v_caller.id::text,
    p_is_solo,
    case when p_is_solo then null else v_companion.name end,
    case when p_is_solo then null else v_companion.id::text end,
    p_category, p_game_mode
  )
  returning * into v_row;

  return v_row;
exception
  -- Lo lanza el índice único del PASO 2 cuando otra persona se adelantó.
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado por otro socio';
end;
$$;

-- La versión de 6 argumentos deja de usarse: si sigue existiendo, PostgREST
-- podría elegirla y guardar reservas sin categoría ni modalidad.
drop function if exists public.create_reservation(text, int, date, text, boolean, text);

commit;

-- Verificación manual:
--   1. Reservar desde la app: la fila nueva debe tener category y game_mode.
--   2. Llamar a create_reservation con p_category => 'otra' debe fallar.
--   3. Las reservas anteriores a esta migración siguen leyéndose (NULL).
