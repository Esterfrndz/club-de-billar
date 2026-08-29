-- ============================================================================
-- Límite diario de 1 hora por socio
-- ============================================================================
-- Regla del club: cada socio puede "gastar" como máximo 1 hora de mesa al
-- día. Si juega solo se le descuenta la hora completa; si juega acompañado
-- se le descuentan solo 0:30 (la otra mitad la "paga" el compañero).
--
-- El gasto diario de un socio no se guarda en una columna aparte: se calcula
-- sumando sus reservas de ese día, tanto como titular como acompañante,
-- usando `is_solo` para saber si cada una cuenta 1h o 0.5h. Así no hay
-- ningún contador que se pueda desincronizar de las reservas reales.
-- ============================================================================

begin;

create or replace function public._member_daily_hours(p_member_id text, p_date date)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(
    case
      when r.member_id = p_member_id then (case when r.is_solo then 1.0 else 0.5 end)
      else 0.5
    end
  ), 0)
  from reservations r
  where r.date::date = p_date
    and (r.member_id = p_member_id or r.companion_member_id = p_member_id);
$$;

revoke all on function public._member_daily_hours(text, date) from public, anon, authenticated;

-- create_reservation: se añade la comprobación del límite diario antes de
-- insertar. Si es solo, la hora nueva es 1.0; si es acompañado, cuesta 0.5
-- tanto al titular como al acompañante, y se comprueba a los dos.
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

-- join_reservation: quien se une pasa a ser acompañante y "gasta" 0.5h ese
-- día. Al titular no hace falta comprobarle nada: su gasto baja de 1.0 a 0.5.
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
--   1. Un socio reserva solo un hueco un día -> select create_reservation(...)
--      con is_solo=true. Si intenta reservar otro hueco ESE MISMO día
--      (solo o acompañado), debe fallar con el mensaje del límite diario.
--   2. Un socio juega acompañado (0.5h) y luego intenta otra reserva solo
--      (1.0h) el mismo día -> 0.5 + 1.0 > 1.0, debe fallar.
--   3. Un socio juega acompañado (0.5h) y luego se une a otra partida como
--      acompañante (0.5h) el mismo día -> 0.5 + 0.5 = 1.0, debe permitirse.
