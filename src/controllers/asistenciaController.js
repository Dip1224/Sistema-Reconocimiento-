import { supabase } from "../supabase.js";
import dotenv from "dotenv";
import {
  registrarEntradaAsistencia,
  registrarSalidaAsistencia
} from "../services/asistenciaService.js";

dotenv.config();

const ASISTENCIAS_TABLE = process.env.SUPABASE_ASISTENCIAS_TABLE;

export async function registrarEntrada(req, res) {
  try {
    const {
      id_empleado,
      id_dispositivo,
      fecha,
      hora_entrada,
      numero_turno,
      metodo_registro
    } = req.body;

    const result = await registrarEntradaAsistencia({
      id_empleado,
      id_dispositivo,
      fecha,
      hora_entrada,
      numero_turno,
      metodo_registro
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    return res.status(201).json({
      mensaje: "Asistencia de entrada registrada correctamente",
      asistencia: result.data
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}

export async function registrarSalida(req, res) {
  try {
    const { id_empleado, fecha, hora_salida, numero_turno } = req.body;

    const result = await registrarSalidaAsistencia({
      id_empleado,
      fecha,
      hora_salida,
      numero_turno
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    return res.json({
      mensaje: "Salida registrada correctamente",
      asistencia: result.data
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}

export async function obtenerAsistencias(req, res) {
  try {
    if (!ASISTENCIAS_TABLE) {
      return res.status(500).json({ error: "Tabla de asistencias no configurada" });
    }

    const idEmpleado = Number(req.params.id_empleado);
    if (!idEmpleado) {
      return res.status(400).json({ error: "id_empleado invalido" });
    }

    const { data, error } = await supabase
      .from(ASISTENCIAS_TABLE)
      .select("*")
      .eq("id_empleado", idEmpleado)
      .order("fecha", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error obteniendo asistencias" });
    }

    return res.json({ asistencias: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}
