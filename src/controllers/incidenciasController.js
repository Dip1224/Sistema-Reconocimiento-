import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const INCIDENCIAS_TABLE = process.env.SUPABASE_INCIDENCIAS_TABLE || "incidencia";

export async function registrarIncidencia(req, res) {
  try {
    const { id_asistencia, descripcion, tipo } = req.body;

    if (!INCIDENCIAS_TABLE) {
      return res.status(500).json({ error: "Tabla de incidencias no configurada" });
    }

    if (!id_asistencia) {
      return res.status(400).json({ error: "id_asistencia es obligatorio" });
    }

    if (!tipo) {
      return res.status(400).json({ error: "tipo es obligatorio" });
    }

    const { data, error } = await supabase
      .from(INCIDENCIAS_TABLE)
      .insert([
        {
          id_asistencia: Number(id_asistencia),
          tipo,
          descripcion: descripcion || null,
          actualizado: true
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error registrando incidencia" });
    }

    res.json({ mensaje: "Incidencia registrada", incidencia: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
