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

async function resolverEstadoEntrada({ id_empleado, fecha, hora_entrada }) {
  if (!HORARIOS_TABLE || !id_empleado || !fecha || !hora_entrada) {
    return "presente";
  }

  try {
    const diaSemana = obtenerDiaSemana(fecha);
    let horario = null;

    if (diaSemana !== null) {
      const { data } = await supabase
        .from(HORARIOS_TABLE)
        .select("hora_entrada, tolerancia_minutos")
        .eq("id_empleado", id_empleado)
        .eq("dia_semana", diaSemana)
        .maybeSingle();
      horario = data;
    }

    if (!horario) {
      const { data } = await supabase
        .from(HORARIOS_TABLE)
        .select("hora_entrada, tolerancia_minutos")
        .eq("id_empleado", id_empleado)
        .order("dia_semana", { ascending: true })
        .limit(1)
        .maybeSingle();
      horario = data;
    }

    if (horario?.hora_entrada) {
      const tolerancia = Number(horario.tolerancia_minutos) || 0;
      const horaProgramada = timeToMinutes(horario.hora_entrada);
      const horaReal = timeToMinutes(hora_entrada);
      if (
        horaProgramada !== null &&
        horaReal !== null &&
        horaReal > horaProgramada + tolerancia
      ) {
        return "retraso";
      }
    }
  } catch (err) {
    console.error("Error evaluando horario:", err);
  }

  return "presente";
}

export async function registrarEntradaAsistencia({
  id_empleado,
  id_dispositivo,
  fecha,
  hora_entrada,
  numero_turno,
  metodo_registro
}) {
  if (!ASISTENCIAS_TABLE) {
    return { error: "Tabla de asistencias no configurada" };
  }

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

  const estado = await resolverEstadoEntrada({ id_empleado, fecha, hora_entrada });

  const { data, error } = await supabase
    .from(ASISTENCIAS_TABLE)
    .insert([
      {
        id_empleado,
        id_dispositivo,
        fecha,
        hora_entrada,
        hora_salida: null,
        numero_turno,
        estado,
        metodo_registro
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    return { error: "Error registrando asistencia de entrada" };
  }

  return { data };
}

export async function registrarSalidaAsistencia({
  id_empleado,
  fecha,
  hora_salida,
  numero_turno
}) {
  if (!ASISTENCIAS_TABLE) {
    return { error: "Tabla de asistencias no configurada" };
  }

  if (!id_empleado || !fecha || !hora_salida || !numero_turno) {
    return {
      error: "id_empleado, fecha, hora_salida y numero_turno son obligatorios",
      status: 400
    };
  }

  const { data, error } = await supabase
    .from(ASISTENCIAS_TABLE)
    .update({
      hora_salida,
      fecha_modificacion: new Date().toISOString()
    })
    .eq("id_empleado", id_empleado)
    .eq("fecha", fecha)
    .eq("numero_turno", numero_turno)
    .is("hora_salida", null)
    .select()
    .single();

  if (error) {
    console.error(error);
    return { error: "Error registrando salida de asistencia" };
  }

  if (!data) {
    return { error: "No se encontró una asistencia abierta para ese empleado/fecha/turno", status: 404 };
  }

  return { data };
}
