-- ============================================================================
-- Hotfix — 002 marcó como STABLE funciones que escriben
-- ============================================================================
-- `verify_access_code`, `_require_member` y `_require_admin` registran cada
-- intento en `access_attempts` (INSERT/DELETE), pero quedaron marcadas
-- STABLE. Postgres enruta las funciones STABLE a una transacción de solo
-- lectura, así que toda escritura dentro de ellas falla con:
--   "cannot execute INSERT in a read-only transaction"
-- Efecto real: nadie podía entrar, ni con código viejo ni nuevo, desde que se
-- aplicó 002. Se corrige quitando STABLE (quedan VOLATILE, su valor por
-- defecto) de las tres funciones.
-- ============================================================================

begin;

create or replace function public._require_member(p_code text)
returns members
language plpgsql
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

create or replace function public._require_admin(p_code text)
returns members
language plpgsql
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

create or replace function public.verify_access_code(p_code text)
returns table (id text, name text, is_admin boolean, photo_url text)
language plpgsql
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

revoke all on function public._require_member(text) from public, anon, authenticated;
revoke all on function public._require_admin(text)  from public, anon, authenticated;
grant execute on function public.verify_access_code(text) to anon, authenticated;

commit;

-- Verificación: debe devolver una fila (o ninguna si el código no existe),
-- nunca el error de "read-only transaction":
--   select * from verify_access_code('000000');
