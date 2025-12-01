import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const HORARIOS_TABLE = process.env.SUPABASE_HORARIOS_TABLE;

export async function listarHorarios(req, res) {
  try {
    if (!HORARIOS_TABLE) {
      return res.status(500).json({ error: "Tabla de horarios no configurada" });
    }

    const idEmpleado = Number(req.params.id_empleado);
    if (!idEmpleado) {
      return res.status(400).json({ error: "id_empleado invalido" });
    }

    const { data, error } = await supabase
      .from(HORARIOS_TABLE)
      .select("*")
      .eq("id_empleado", idEmpleado)
      .order("dia_semana", { ascending: true })
      .order("hora_entrada", { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error obteniendo horarios" });
    }

    res.json({ horarios: data || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}

export async function registrarHorario(req, res) {
  try {
    if (!HORARIOS_TABLE) {
      return res.status(500).json({ error: "Tabla de horarios no configurada" });
    }

    const {
      id_empleado,
      dia_semana,
      hora_entrada,
      hora_salida,
      tolerancia_minutos = 0
    } = req.body;

    if (!id_empleado || !dia_semana || !hora_entrada || !hora_salida) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const { data, error } = await supabase
      .from(HORARIOS_TABLE)
      .insert([
        {
          id_empleado: Number(id_empleado),
          dia_semana: Number(dia_semana),
          hora_entrada,
          hora_salida,
          tolerancia_minutos: Number(tolerancia_minutos)
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ese empleado ya tiene horario asignado para ese dia" });
      }
      return res.status(500).json({ error: "Error registrando horario" });
    }

    res.json({
      mensaje: "Horario registrado correctamente",
      horario: data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}

export async function actualizarHorario(req, res) {
  try {
    if (!HORARIOS_TABLE) {
      return res.status(500).json({ error: "Tabla de horarios no configurada" });
    }

    const idHorario = Number(req.params.id_horario);
    if (!idHorario) {
      return res.status(400).json({ error: "id_horario invalido" });
    }

    const {
      id_empleado,
      dia_semana,
      hora_entrada,
      hora_salida,
      tolerancia_minutos = 0
    } = req.body;

    if (!id_empleado || !dia_semana || !hora_entrada || !hora_salida) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const { data, error } = await supabase
      .from(HORARIOS_TABLE)
      .update({
        id_empleado: Number(id_empleado),
        dia_semana: Number(dia_semana),
        hora_entrada,
        hora_salida,
        tolerancia_minutos: Number(tolerancia_minutos)
      })
      .eq("id_horario", idHorario)
      .select()
      .single();

    if (error) {
      console.error(error);
      if (error.code === "23505") {
        return res.status(409).json({ error: "Ese empleado ya tiene horario asignado para ese dia" });
      }
      return res.status(500).json({ error: "Error actualizando horario" });
    }

    res.json({
      mensaje: "Horario actualizado correctamente",
      horario: data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}

export async function eliminarHorario(req, res) {
  try {
    if (!HORARIOS_TABLE) {
      return res.status(500).json({ error: "Tabla de horarios no configurada" });
    }

    const idHorario = Number(req.params.id_horario);
    if (!idHorario) {
      return res.status(400).json({ error: "id_horario invalido" });
    }

    const { error } = await supabase.from(HORARIOS_TABLE).delete().eq("id_horario", idHorario);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error eliminando horario" });
    }

    res.json({ mensaje: "Horario eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
