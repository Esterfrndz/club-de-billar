-- ============================================================================
-- Club de Billar Paterna — Rotación a códigos de 6 dígitos + límite de intentos
-- ============================================================================
--
-- QUÉ ARREGLA
--   1. Los códigos de 4 dígitos (9000 combinaciones) eran fuerza-brutables en
--      segundos. Pasan a 6 dígitos (900.000 combinaciones).
--   2. Los códigos actuales estuvieron expuestos públicamente antes de la
--      migración 001 (cualquiera podía leerlos con `select *`), así que subir
--      de dígitos no basta: hay que asumir que pudieron copiarse y ROTARLOS.
--      Esta migración genera un código nuevo para cada socio.
--   3. Sin límite de intentos, 900.000 combinaciones se agotan igual con
--      tiempo y automatización. Se añade un límite de 10 intentos fallidos
--      por IP cada 15 minutos, aplicado en el único punto por el que pasa
--      toda autenticación (`_require_member`), así que cubre tanto el login
--      como cualquier RPC llamado con un código adivinado.
--
-- IMPORTANTE — ACCIÓN REQUERIDA DESPUÉS DE EJECUTAR
--   Todos los socios reciben un código nuevo. Sus códigos actuales dejan de
--   funcionar en el momento en que ejecutes esto. La consulta final del
--   fichero (PASO 4) te da la tabla completa nombre → código nuevo para que
--   se la repartas al club antes de anunciar el cambio.
--
-- CÓMO EJECUTARLO
--   Igual que la 001: SQL Editor → pegar entero → Run. Transaccional.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PASO 1 · Rotar todos los códigos a 6 dígitos
-- ---------------------------------------------------------------------------

do $$
declare
  m          record;
  v_new_code text;
  v_attempts int;
begin
  for m in select id from members loop
    v_attempts := 0;
    loop
      v_new_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
      exit when not exists (select 1 from members x where x.access_code = v_new_code);
      v_attempts := v_attempts + 1;
      if v_attempts > 500 then
        raise exception 'No se encontró un código de 6 dígitos libre para el socio %', m.id;
      end if;
    end loop;

    update members set access_code = v_new_code where id = m.id;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASO 2 · admin_add_member genera códigos de 6 dígitos para los nuevos socios
-- ---------------------------------------------------------------------------

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

  loop
    v_new_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from members m where m.access_code = v_new_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 500 then
      raise exception 'No quedan códigos de 6 dígitos libres';
    end if;
  end loop;

  insert into members (name, access_code)
  values (btrim(p_name), v_new_code)
  returning * into v_row;

  return query select v_row.id::text, v_row.name, v_row.photo_url,
                      coalesce(v_row.is_admin, false), v_row.access_code;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASO 3 · Límite de intentos por IP
-- ---------------------------------------------------------------------------

create table if not exists public.access_attempts (
  id          bigserial primary key,
  ip          text not null,
  occurred_at timestamptz not null default now(),
  success     boolean not null
);

create index if not exists access_attempts_ip_time_idx
  on public.access_attempts (ip, occurred_at);

alter table public.access_attempts enable row level security;
-- Sin políticas: cero acceso directo, ni siquiera de lectura. Solo lo tocan
-- las funciones internas de más abajo.
revoke all on table public.access_attempts from anon, authenticated;

-- IP del cliente tal como la ve el proxy de Supabase. Sin ella (llamadas
-- directas a Postgres, poco probable aquí) se agrupa todo bajo 'desconocida',
-- lo que en el peor caso comparte el límite entre llamadas sin IP en vez de
-- dejarlas sin límite.
create or replace function public._client_ip()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    'desconocida'
  );
$$;

create or replace function public._check_rate_limit()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ip     text := public._client_ip();
  v_fallos int;
begin
  select count(*) into v_fallos
  from access_attempts
  where ip = v_ip
    and success = false
    and occurred_at > now() - interval '15 minutes';

  if v_fallos >= 10 then
    raise exception 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.'
      using errcode = '28000';
  end if;
end;
$$;

create or replace function public._record_attempt(p_success boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into access_attempts (ip, success) values (public._client_ip(), p_success);
$$;

-- Limpieza perezosa: en cada intento fallido se aprovecha para borrar el
-- historial de más de una hora. A este volumen de tráfico no hace falta un
-- cron aparte.
create or replace function public._prune_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from access_attempts where occurred_at < now() - interval '1 hour';
$$;

revoke all on function public._client_ip()         from public, anon, authenticated;
revoke all on function public._check_rate_limit()   from public, anon, authenticated;
revoke all on function public._record_attempt(boolean) from public, anon, authenticated;
revoke all on function public._prune_attempts()     from public, anon, authenticated;

-- `_require_member` es el único punto por el que pasa toda operación
-- autenticada (login incluido, vía verify_access_code más abajo), así que
-- limitar aquí cubre a la vez el formulario de acceso y cualquier intento de
-- adivinar un código llamando directamente a otro RPC.
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
  perform public._check_rate_limit();

  v_member := public._member_by_code(p_code);

  if v_member.id is null then
    perform public._record_attempt(false);
    perform public._prune_attempts();
    raise exception 'Código de acceso no válido' using errcode = '28000';
  end if;

  perform public._record_attempt(true);
  return v_member;
end;
$$;

-- verify_access_code no pasaba por _require_member (no quería lanzar excepción
-- en un intento fallido normal de login, solo devolver 0 filas). Se le añade
-- el mismo límite y registro de intentos por separado.
create or replace function public.verify_access_code(p_code text)
returns table (id text, name text, is_admin boolean, photo_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member members;
begin
  perform public._check_rate_limit();

  v_member := public._member_by_code(p_code);

  if v_member.id is null then
    perform public._record_attempt(false);
    perform public._prune_attempts();
    return;
  end if;

  perform public._record_attempt(true);
  return query select v_member.id::text, v_member.name,
                      coalesce(v_member.is_admin, false), v_member.photo_url;
end;
$$;

grant execute on function public.verify_access_code(text) to anon, authenticated;

commit;


-- ============================================================================
-- PASO 4 · CÓDIGOS NUEVOS — ejecuta esto en una consulta aparte y guarda el
-- resultado. Es la única vez que estos códigos aparecen en texto plano.
-- ============================================================================
--
--   select name as socio, access_code as codigo_nuevo
--   from members
--   order by name asc;
--
-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
--
-- 1. Los códigos deben tener 6 dígitos:
--      select access_code, length(access_code) from members limit 5;
--
-- 2. Simular 11 intentos fallidos seguidos con la RPC (usa un código que no
--    exista) — el 11º debe devolver "Demasiados intentos fallidos...":
--      select * from verify_access_code('000000');  -- repetir 11 veces
--
-- 3. Pasados 15 minutos (o borrando manualmente sus filas de access_attempts
--    en local si solo estás probando), el límite se libera solo.
-- ============================================================================
