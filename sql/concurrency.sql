-- Índices únicos para garantizar integridad y manejar concurrencia

-- Horario: un día por empleado
CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_empleado_dia
ON horario (id_empleado, dia_semana);

-- Asistencia: una asistencia por empleado/fecha/turno
CREATE UNIQUE INDEX IF NOT EXISTS ux_asistencia_empleado_fecha_turno
ON asistencia (id_empleado, fecha, numero_turno);

-- Nota: ejecutar con el mismo esquema/basedatos configurado en Supabase.
