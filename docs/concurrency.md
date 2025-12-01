## Transacciones y concurrencia

Estrategia: concurrencia optimista con claves únicas y validación previa. Las operaciones críticas se encapsulan en funciones/consultas que se ejecutan de forma atómica y devuelven códigos claros.

### Índices únicos (integridad + contención de duplicados)
- `horario(id_empleado, dia_semana)` → evita dos horarios el mismo día por empleado.
- `asistencia(id_empleado, fecha, numero_turno)` → evita duplicar la asistencia de un turno diario.
Script: `backend/sql/concurrency.sql`.

### Función transaccional de asistencia
Archivo: `backend/sql/asistencia_transaction.sql`.

Flujo:
1. Valida que exista horario para el día (isodow 1-7); si no, lanza error `P403`.
2. Selecciona asistencia del día/turno `FOR UPDATE`.
3. Si `tipo=entrada`: si ya existe, `P409`; si no, inserta.
4. Si `tipo=salida`: si no existe, `P404`; si ya tiene salida, `P409`; si no, actualiza.
5. Devuelve la asistencia y la acción (`entrada`/`salida`).

Mapeo sugerido de errores a HTTP:
- `P403` → 403 (sin horario).
- `P404` → 404 (no hay asistencia abierta para ese turno).
- `P409` → 409 (duplicado o ya completado).
- `P0001` → 400/409 según el mensaje.

### Endpoints y respuestas
- Horarios: POST/PUT devuelven 409 si el índice único detecta duplicado.
- Asistencia: al usar la función transaccional, se captura `unique_violation` o los códigos `P403/P404/P409` y se responde con el HTTP correspondiente.

### Cómo probar la concurrencia (manual)
1. Crear un horario y luego intentar crear otro mismo día/empleado → debe devolver 409.
2. Marcar entrada y volver a marcar entrada mismo día/turno → 409.
3. Marcar salida sin entrada → 404.
4. Marcar salida dos veces → 409.

### Notas de implementación (backend)
- Al llamar la RPC `fn_registrar_asistencia` desde Node, capturar `error.code` y mapear según arriba.  
- Mantener `numero_turno` en la petición para soportar múltiples turnos; si solo hay uno, usa 1 por defecto.
