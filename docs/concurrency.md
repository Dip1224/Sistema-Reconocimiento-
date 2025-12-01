## Transacciones y concurrencia

Estrategia: concurrencia optimista con claves unicas y validacion previa. Las operaciones criticas se encapsulan en funciones/consultas atomicas y devuelven codigos claros para el backend.

### Indices unicos (integridad + contencion de duplicados)
- `horario(id_empleado, dia_semana)` -> evita dos horarios el mismo dia por empleado.
- `asistencia(id_empleado, fecha, numero_turno)` -> evita duplicar la asistencia de un turno diario.
Script: `backend/sql/concurrency.sql`.

### Funcion transaccional de asistencia
Archivo: `backend/sql/asistencia_transaction.sql`.

Flujo:
1. Valida que exista horario para el dia (isodow 1-7); si no, lanza 403.
2. Selecciona asistencia del dia/turno `FOR UPDATE`.
3. Si `tipo=entrada`: si ya existe, 409; si no, inserta.
4. Si `tipo=salida`: si no existe, 404; si ya tiene salida, 409; si no, actualiza.
5. Devuelve la asistencia y la accion (`entrada`/`salida`).

Codigos SQLSTATE/hints usados por la funcion:
- 22023 + hint `HTTP 400`: tipo invalido.
- P0001 + hint `HTTP 403`: no hay horario para ese dia.
- P0002 + hint `HTTP 404`: no existe asistencia abierta para ese turno.
- 23505 + hint `HTTP 409`: duplicado o ya registrado.

**Uso en backend (supabase-js)**
```js
const { data, error } = await supabase.rpc("fn_registrar_asistencia", {
  p_id_empleado,
  p_fecha: fechaISO,     // 'YYYY-MM-DD'
  p_hora: hora,          // 'HH:MM:SS'
  p_tipo: "entrada",     // o "salida"
  p_numero_turno: numero_turno || 1,
  p_id_dispositivo: id_dispositivo || 1,
  p_metodo_registro: metodo_registro || "facial"
});

if (error) {
  const hint = (error.hint || "").toUpperCase();
  if (hint.includes("HTTP 403")) return res.status(403).json({ error: error.message });
  if (hint.includes("HTTP 404")) return res.status(404).json({ error: error.message });
  if (hint.includes("HTTP 409")) return res.status(409).json({ error: "La asistencia ya fue registrada" });
  return res.status(500).json({ error: "Error registrando asistencia" });
}

return res.json({ accion: data?.[0]?.accion, asistencia: data?.[0] });
```

### Endpoints y respuestas
- Horarios: POST/PUT devuelven 409 si el indice unico detecta duplicado.
- Asistencia: al usar la funcion transaccional, se captura el hint/SQLSTATE y se responde con el HTTP correspondiente.

### Como probar la concurrencia (manual)
1. Crear un horario y luego intentar crear otro mismo dia/empleado -> debe devolver 409.
2. Marcar entrada y volver a marcar entrada mismo dia/turno -> 409.
3. Marcar salida sin entrada -> 404.
4. Marcar salida dos veces -> 409.

### Notas de implementacion (backend)
- Al llamar la RPC `fn_registrar_asistencia` desde Node, mapear primero por `error.hint` (HTTP 400/403/404/409) y luego por `error.code` (`P0001`, `P0002`, `23505`).
- Mantener `numero_turno` en la peticion para soportar multiples turnos; si solo hay uno, usa 1 por defecto.
