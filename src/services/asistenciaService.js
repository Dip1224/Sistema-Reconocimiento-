import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const ASISTENCIAS_TABLE = process.env.SUPABASE_ASISTENCIAS_TABLE;
const HORARIOS_TABLE = process.env.SUPABASE_HORARIOS_TABLE;

function obtenerDiaSemana(fechaISO) {
  if (typeof fechaISO !== "string" || fechaISO.length < 10) return null;
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  if ([anio, mes, dia].some(Number.isNaN)) return null;
  const date = new Date(Date.UTC(anio, mes - 1, dia));
  if (Number.isNaN(date.getTime())) return null;
  const diaLocal = date.getUTCDay();
  return diaLocal === 0 ? 7 : diaLocal;
}

function timeToMinutes(timeString) {
  if (typeof timeString !== "string") return null;
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const secs = Number.isNaN(seconds) ? 0 : seconds;
  return hours * 60 + minutes + secs / 60;
}

async function obtenerHorarioPorDia(id_empleado, fechaISO) {
  if (!HORARIOS_TABLE || !id_empleado || !fechaISO) return null;
  try {
    const diaSemana = obtenerDiaSemana(fechaISO);
    if (diaSemana === null) return null;

    const { data, error } = await supabase
      .from(HORARIOS_TABLE)
      .select("hora_entrada, hora_salida, tolerancia_minutos")
      .eq("id_empleado", id_empleado)
      .eq("dia_semana", diaSemana)
      .maybeSingle();

    if (error) {
      console.error("Error obteniendo horario por dia:", error);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error("Error obteniendo horario por dia:", err);
    return null;
  }
}

async function resolverEstadoEntrada({ id_empleado, fecha, hora_entrada, horarioDelDia }) {
  const fallback = { estado: "presente", horario: null };

  if (!HORARIOS_TABLE || !id_empleado || !fecha || !hora_entrada) {
    return fallback;
  }

  try {
    const horario = horarioDelDia || (await obtenerHorarioPorDia(id_empleado, fecha));

    if (!horario) return fallback;

    if (horario?.hora_entrada) {
      const tolerancia = Number(horario.tolerancia_minutos) || 0;
      const horaProgramada = timeToMinutes(horario.hora_entrada);
      const horaReal = timeToMinutes(hora_entrada);
      if (
        horaProgramada !== null &&
        horaReal !== null &&
        horaReal > horaProgramada + tolerancia
      ) {
        return { estado: "retraso", horario };
      }
    }

    return { estado: "presente", horario };
  } catch (err) {
    console.error("Error evaluando horario:", err);
  }

  return fallback;
}

export async function registrarEntradaAsistencia({
  id_empleado,
  id_dispositivo,
  fecha,
  hora_entrada,
  numero_turno,
  metodo_registro
}) {
  const faltantes = [];
  if (!id_empleado) faltantes.push("id_empleado");
  if (!id_dispositivo) faltantes.push("id_dispositivo");
  if (!fecha) faltantes.push("fecha");
  if (!hora_entrada) faltantes.push("hora_entrada");
  if (!numero_turno) faltantes.push("numero_turno");
  if (!metodo_registro) faltantes.push("metodo_registro");

  if (faltantes.length) {
    return { error: `Campos obligatorios faltantes: ${faltantes.join(", ")}`, status: 400 };
  }

  try {
    const { data, error } = await supabase.rpc("fn_registrar_asistencia", {
      p_id_empleado: Number(id_empleado),
      p_fecha: fecha,
      p_hora: hora_entrada,
      p_tipo: "entrada",
      p_numero_turno: Number(numero_turno) || 1,
      p_id_dispositivo: Number(id_dispositivo) || 1,
      p_metodo_registro: metodo_registro || "manual"
    });

    if (error) {
      console.error(error);
      if (error.code === "P403") return { error: error.message, status: 403 };
      if (error.code === "P404") return { error: error.message, status: 404 };
      if (error.code === "P409" || error.code === "23505") {
        return { error: "La asistencia de hoy ya fue registrada", status: 409 };
      }
      return { error: "Error registrando asistencia de entrada" };
    }

    const asistencia = Array.isArray(data) ? data[0] : data;
    return { data: asistencia };
  } catch (err) {
    console.error(err);
    return { error: "Error registrando asistencia de entrada" };
  }
}

export async function registrarSalidaAsistencia({
  id_empleado,
  fecha,
  hora_salida,
  numero_turno
}) {
  if (!id_empleado || !fecha || !hora_salida || !numero_turno) {
    return {
      error: "id_empleado, fecha, hora_salida y numero_turno son obligatorios",
      status: 400
    };
  }

  try {
    const { data, error } = await supabase.rpc("fn_registrar_asistencia", {
      p_id_empleado: Number(id_empleado),
      p_fecha: fecha,
      p_hora: hora_salida,
      p_tipo: "salida",
      p_numero_turno: Number(numero_turno) || 1
    });

    if (error) {
      console.error(error);
      if (error.code === "P403") return { error: error.message, status: 403 };
      if (error.code === "P404") {
        return { error: "No se encontro una asistencia abierta para ese empleado/fecha/turno", status: 404 };
      }
      if (error.code === "P409" || error.code === "23505") {
        return { error: "Ya se registro la salida de este turno", status: 409 };
      }
      return { error: "Error registrando salida de asistencia" };
    }

    const asistencia = Array.isArray(data) ? data[0] : data;
    return { data: asistencia };
  } catch (err) {
    console.error(err);
    return { error: "Error registrando salida de asistencia" };
  }
}
