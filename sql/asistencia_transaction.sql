-- Función transaccional para registrar entrada/salida de asistencia
-- Maneja concurrencia usando SELECT ... FOR UPDATE y respeta el índice único
-- (id_empleado, fecha, numero_turno) en la tabla asistencia.
-- Ajusta nombres de tabla/columna si tu esquema difiere.

create or replace function fn_registrar_asistencia(
  p_id_empleado      integer,
  p_fecha            date,
  p_hora             time without time zone,
  p_tipo             text, -- 'entrada' | 'salida'
  p_numero_turno     integer default 1,
  p_id_dispositivo   integer default 1,
  p_metodo_registro  text default 'manual'
)
returns table (
  id_asistencia      integer,
  accion             text,
  id_empleado        integer,
  fecha              date,
  hora_entrada       time without time zone,
  hora_salida        time without time zone,
  numero_turno       integer,
  estado             text,
  metodo_registro    text
) as $$
declare
  v_horario record;
  v_asistencia record;
  v_dia_semana integer;
begin
  if p_tipo not in ('entrada','salida') then
    raise exception 'Tipo invalido. Use entrada o salida' using errcode = 'P0001';
  end if;

  -- validar horario del dia (1=lunes .. 7=domingo)
  v_dia_semana := extract(isodow from p_fecha);
  select h.*
  into v_horario
  from horario h
  where h.id_empleado = p_id_empleado
    and h.dia_semana = v_dia_semana;

  if not found then
    raise exception 'No tienes un horario programado para hoy' using errcode = 'P403';
  end if;

  -- bloquear asistencia del dia/turno
  select *
  into v_asistencia
  from asistencia a
  where a.id_empleado = p_id_empleado
    and a.fecha = p_fecha
    and a.numero_turno = coalesce(p_numero_turno, 1)
  for update;

  if p_tipo = 'entrada' then
    if found then
      raise exception 'La asistencia de hoy ya fue registrada' using errcode = 'P409';
    end if;

    insert into asistencia (
      id_empleado,
      fecha,
      hora_entrada,
      hora_salida,
      numero_turno,
      estado,
      metodo_registro,
      id_dispositivo
    ) values (
      p_id_empleado,
      p_fecha,
      p_hora,
      null,
      coalesce(p_numero_turno, 1),
      'presente',
      p_metodo_registro,
      p_id_dispositivo
    )
    returning * into v_asistencia;

    return query select
      v_asistencia.id_asistencia,
      'entrada'::text as accion,
      v_asistencia.id_empleado,
      v_asistencia.fecha,
      v_asistencia.hora_entrada,
      v_asistencia.hora_salida,
      v_asistencia.numero_turno,
      v_asistencia.estado,
      v_asistencia.metodo_registro;
    return;
  end if;

  -- salida
  if not found then
    raise exception 'No hay una asistencia abierta para este turno' using errcode = 'P404';
  end if;

  if v_asistencia.hora_salida is not null then
    raise exception 'Ya se registro la salida de este turno' using errcode = 'P409';
  end if;

  update asistencia
  set hora_salida = p_hora,
      fecha_modificacion = now()
  where id_asistencia = v_asistencia.id_asistencia
  returning * into v_asistencia;

  return query select
    v_asistencia.id_asistencia,
    'salida'::text as accion,
    v_asistencia.id_empleado,
    v_asistencia.fecha,
    v_asistencia.hora_entrada,
    v_asistencia.hora_salida,
    v_asistencia.numero_turno,
    v_asistencia.estado,
    v_asistencia.metodo_registro;
end;
$$ language plpgsql;

-- Notas de manejo de errores:
--  * P403: sin horario => mapear a HTTP 403.
--  * P404: sin asistencia abierta => mapear a HTTP 404.
--  * P409: duplicado/ya registrado => mapear a HTTP 409.
--  * P0001: validaciones varias => mapear a 400/409 segun mensaje.
