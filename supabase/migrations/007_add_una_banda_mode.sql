-- ============================================================================
-- Cuarta modalidad de juego: una banda
-- ============================================================================
-- Las modalidades del club son cuatro, no tres. Se añade 'una_banda' a los
-- valores admitidos por la migración 006.
--
--   tres_bandas | libre | una_banda | cuadro
-- ============================================================================

begin;

alter table reservations drop constraint if exists reservations_game_mode_check;
alter table reservations add constraint reservations_game_mode_check
  check (game_mode is null or game_mode in ('libre', 'cuadro', 'tres_bandas', 'una_banda'));

comment on column reservations.game_mode is 'Modalidad de juego: tres_bandas | libre | una_banda | cuadro';

-- La validación también vive dentro de create_reservation, así que hay que
-- reescribir la función: el resto del cuerpo es idéntico al de la 006.
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
  when unique_violation then
    raise exception 'Ese horario acaba de ser reservado por otro socio';
end;
$$;

commit;

-- Verificación manual:
--   Reservar con modalidad "Una banda" desde la app debe guardarse sin error.
