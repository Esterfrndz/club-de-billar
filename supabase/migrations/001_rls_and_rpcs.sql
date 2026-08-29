-- ============================================================================
-- Club de Billar Paterna — Blindaje de la base de datos (RLS + API por RPC)
-- ============================================================================
--
-- QUÉ ARREGLA
--   1. `members` dejaba de ser legible: hoy cualquier visitante puede leer
--      TODOS los códigos de acceso con `select *`.
--   2. `reservations.member_id` guardaba el código de acceso, y esa tabla se
--      lee entera desde el navegador → segunda vía de fuga. Pasa a guardar
--      `members.id`.
--   3. `is_admin` deja de ser una decisión del cliente: cada operación
--      sensible verifica el rol en el servidor.
--   4. `updateMember` aceptaba un objeto arbitrario (se podía uno mismo poner
--      `is_admin: true`). Se sustituye por una función que solo toca la foto.
--
-- CÓMO EJECUTARLO
--   Supabase Dashboard → SQL Editor → pega este fichero entero → Run.
--   Va todo en una transacción: si algo falla, no se aplica nada.
--
-- NOTA SOBRE EL TIPO DE `members.id`
--   Todas las funciones usan `text` para los ids y comparan con `id::text`,
--   así funciona igual si la columna es uuid o bigint. Con 35 socios el coste
--   de no usar el índice es irrelevante.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PASO 1 · Normalizar los identificadores en `reservations`
-- ---------------------------------------------------------------------------
-- `member_id` guardaba el código de acceso. Lo convertimos a members.id.
-- La guarda `not exists` evita reconvertir filas que ya estuvieran migradas
-- (importante si `members.id` es bigint y algún id coincide con un código).

update reservations r
set member_id = m.id::text
from members m
where r.member_id = m.access_code
  and not exists (
    select 1 from members m2 where m2.id::text = r.member_id
  );

-- `companion_member_id` contiene una mezcla: las reservas creadas desde el
-- wizard guardaban members.id, y las creadas al pulsar "Unirse" guardaban el
-- código. Convertimos únicamente las segundas.

update reservations r
set companion_member_id = m.id::text
from members m
where r.companion_member_id = m.access_code
  and not exists (
    select 1 from members m2 where m2.id::text = r.companion_member_id
  );


-- ---------------------------------------------------------------------------
-- PASO 2 · Integridad de datos
-- ---------------------------------------------------------------------------
-- Códigos de acceso únicos. `addMember` los generaba con Math.random() sin
-- comprobar colisiones; si dos socios comparten código, el login falla para
-- ambos (usa .single()). Si esta línea da error, hay duplicados: localízalos
-- con la consulta del final del fichero y corrígelos antes de reintentar.

create unique index if not exists members_access_code_key
  on members (access_code);

-- Una mesa no puede tener dos reservas a la misma hora. Hoy la comprobación
-- es solo en el cliente contra un estado que no se refresca, así que dos
-- personas en dispositivos distintos reservan el mismo hueco sin problema.

create unique index if not exists reservations_slot_key
  on reservations (table_id, date, time);

-- `mobile` nunca llegó a usarse (el cliente siempre mandaba cadena vacía) y ya
-- no se rellena. Si estaba declarada NOT NULL, los inserts fallarían.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reservations'
      and column_name = 'mobile' and is_nullable = 'NO'
  ) then
    alter table reservations alter column mobile drop not null;
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASO 3 · Helpers internos (NO expuestos al cliente)
-- ---------------------------------------------------------------------------

create or replace function public._member_by_code(p_code text)
returns members
language sql
stable
security definer
set search_path = public
as $$
  select * from members where access_code = p_code limit 1;
$$;

create or replace function public._require_member(p_code text)
returns members
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member members;
begin
  v_member := public._member_by_code(p_code);
  if v_member.id is null then
    raise exception 'Código de acceso no válido' using errcode = '28000';
  end if;
  return v_member;
end;
$$;

create or replace function public._require_admin(p_code text)
returns members
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member members;
begin
  v_member := public._require_member(p_code);
  if not coalesce(v_member.is_admin, false) then
    raise exception 'Se requieren permisos de administrador' using errcode = '42501';
  end if;
  return v_member;
end;
$$;

-- Estas tres nunca deben poder llamarse desde el navegador: devuelven la fila
-- completa, códigos incluidos.
revoke all on function public._member_by_code(text)  from public, anon, authenticated;
revoke all on function public._require_member(text)  from public, anon, authenticated;
revoke all on function public._require_admin(text)   from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- PASO 4 · API pública de socios
-- ---------------------------------------------------------------------------

-- Login. Devuelve solo la fila que coincide con el código introducido.
create or replace function public.verify_access_code(p_code text)
returns table (id text, name text, is_admin boolean, photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id::text, m.name, coalesce(m.is_admin, false), m.photo_url
  from members m
  where m.access_code = p_code
  limit 1;
$$;

-- Listado de socios. `access_code` solo viaja al navegador si quien pregunta
-- es administrador; `is_admin` solo para admins o para la propia fila.
create or replace function public.list_members(p_code text default null)
returns table (
  id          text,
  name        text,
  photo_url   text,
  is_admin    boolean,
  access_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller  members;
  v_isadmin boolean := false;
begin
  if p_code is not null then
    v_caller := public._member_by_code(p_code);
    v_isadmin := coalesce(v_caller.is_admin, false);
  end if;

  return query
    select
      m.id::text,
      m.name,
      m.photo_url,
      case when v_isadmin or m.id = v_caller.id
           then coalesce(m.is_admin, false) else false end,
      case when v_isadmin or m.id = v_caller.id
           then m.access_code else null end
    from members m
    order by m.name asc;
end;
$$;

create or replace function public.admin_add_member(p_code text, p_name text)
returns table (id text, name text, photo_url text, is_admin boolean, access_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_code text;
  v_attempts int := 0;
  v_row      members;
begin
  perform public._require_admin(p_code);

  if p_name is null or btrim(p_name) = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  -- Código único: reintenta hasta encontrar uno libre en vez de confiar en
  -- que Math.random() no colisione.
  loop
    v_new_code := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from members m where m.access_code = v_new_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 200 then
      raise exception 'No quedan códigos de 4 dígitos libres';
    end if;
  end loop;

  insert into members (name, access_code)
  values (btrim(p_name), v_new_code)
  returning * into v_row;

  return query select v_row.id::text, v_row.name, v_row.photo_url,
                      coalesce(v_row.is_admin, false), v_row.access_code;
end;
$$;

create or replace function public.admin_delete_member(p_code text, p_target_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller members;
begin
  v_caller := public._require_admin(p_code);

  if v_caller.id::text = p_target_id then
    raise exception 'No puedes eliminar tu propia cuenta de administrador';
  end if;

  delete from members m where m.id::text = p_target_id;
end;
$$;

-- Sustituye al viejo `updateMember(id, updates)`, que aceptaba cualquier
-- columna. Solo toca la foto, y solo si eres admin o es tu propia ficha.
create or replace function public.set_member_photo(
  p_code      text,
  p_target_id text,
  p_photo_url text
)
returns table (id text, name text, photo_url text, is_admin boolean, access_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller members;
  v_row    members;
begin
  v_caller := public._require_member(p_code);

  if not coalesce(v_caller.is_admin, false) and v_caller.id::text <> p_target_id then
    raise exception 'Solo puedes cambiar tu propia foto' using errcode = '42501';
  end if;

  update members m
  set photo_url = nullif(btrim(coalesce(p_photo_url, '')), '')
  where m.id::text = p_target_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Socio no encontrado';
  end if;

  return query select v_row.id::text, v_row.name, v_row.photo_url,
                      coalesce(v_row.is_admin, false),
                      case when coalesce(v_caller.is_admin, false) or v_caller.id = v_row.id
                           then v_row.access_code else null end;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASO 5 · API pública de reservas
-- ---------------------------------------------------------------------------

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

  if not p_is_solo then
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

-- Devuelve 'left' si el que llama era el acompañante (se sale y la reserva
-- sigue viva), o 'deleted' si era el titular o un admin.
create or replace function public.delete_reservation(p_code text, p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller members;
  v_res    reservations;
begin
  v_caller := public._require_member(p_code);

  select * into v_res from reservations r where r.id::text = p_id;
  if v_res.id is null then
    raise exception 'Reserva no encontrada';
  end if;

  if v_res.companion_member_id = v_caller.id::text then
    update reservations
    set is_solo = true, companion_name = null, companion_member_id = null
    where id = v_res.id;
    return 'left';
  end if;

  if v_res.member_id = v_caller.id::text or coalesce(v_caller.is_admin, false) then
    delete from reservations where id = v_res.id;
    return 'deleted';
  end if;

  raise exception 'No puedes cancelar una reserva que no es tuya' using errcode = '42501';
end;
$$;

-- Atómica: el `where` solo acierta si la reserva sigue libre, así que dos
-- personas pulsando "Unirse" a la vez ya no se pisan.
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


-- ---------------------------------------------------------------------------
-- PASO 6 · Activar RLS y cerrar el acceso directo
-- ---------------------------------------------------------------------------

alter table members      enable row level security;
alter table reservations enable row level security;

-- Borra cualquier política permisiva previa.
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('members', 'reservations')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end;
$$;

-- `members`: CERO políticas. Sin política, RLS deniega todo. El único acceso
-- es a través de las funciones security definer de arriba.
-- (No se crea ninguna a propósito.)

-- `reservations`: lectura abierta. Tras el PASO 1 ya no contiene códigos de
-- acceso, y la app necesita ver la ocupación de las mesas y las partidas del
-- día. Escritura solo por RPC.
create policy reservations_public_read
  on reservations for select
  to anon, authenticated
  using (true);

-- Retirar los permisos de tabla que la anon key trae por defecto.
revoke all on table members      from anon, authenticated;
revoke all on table reservations from anon, authenticated;
grant select on table reservations to anon, authenticated;


-- ---------------------------------------------------------------------------
-- PASO 7 · Exponer solo la API prevista
-- ---------------------------------------------------------------------------

grant execute on function public.verify_access_code(text)               to anon, authenticated;
grant execute on function public.list_members(text)                     to anon, authenticated;
grant execute on function public.admin_add_member(text, text)           to anon, authenticated;
grant execute on function public.admin_delete_member(text, text)        to anon, authenticated;
grant execute on function public.set_member_photo(text, text, text)     to anon, authenticated;
grant execute on function public.create_reservation(text, int, date, text, boolean, text) to anon, authenticated;
grant execute on function public.delete_reservation(text, text)         to anon, authenticated;
grant execute on function public.join_reservation(text, text)           to anon, authenticated;

commit;


-- ============================================================================
-- VERIFICACIÓN (ejecuta esto después, en una consulta aparte)
-- ============================================================================
--
-- 1. Debe fallar con "permission denied for table members":
--      select * from members;
--
-- 2. Debe devolver tu ficha y nada más:
--      select * from verify_access_code('TU_CODIGO');
--
-- 3. Como socio normal, `access_code` debe venir null salvo en tu propia fila:
--      select * from list_members('CODIGO_DE_SOCIO_NORMAL');
--
-- 4. Buscar códigos duplicados (si el índice único del PASO 2 falló):
--      select access_code, count(*), string_agg(name, ', ')
--      from members group by access_code having count(*) > 1;
--
-- 5. Buscar reservas duplicadas (si el otro índice único falló):
--      select table_id, date, time, count(*)
--      from reservations group by table_id, date, time having count(*) > 1;
-- ============================================================================
