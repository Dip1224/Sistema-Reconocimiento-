import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const ASISTENCIAS_TABLE = process.env.SUPABASE_ASISTENCIAS_TABLE;

export async function registrarIncidencia(req, res) {
  try {
    const { id_asistencia, id_empleado, descripcion, fecha, tipo } = req.body;

    if (!descripcion || !tipo) {
      return res.status(400).json({ error: "descripcion y tipo son obligatorios" });
    }

    let empleadoId = id_empleado ? Number(id_empleado) : null;
    let fechaIncidencia = fecha || null;

    if ((!empleadoId || !fechaIncidencia) && !id_asistencia) {
      return res.status(400).json({
        error: "Debe enviar id_empleado y fecha, o bien id_asistencia"
      });
    }

    if ((!empleadoId || !fechaIncidencia) && id_asistencia) {
      if (!ASISTENCIAS_TABLE) {
        return res.status(500).json({ error: "Tabla de asistencias no configurada" });
      }

      const { data: asistencia, error: asistenciaError } = await supabase
        .from(ASISTENCIAS_TABLE)
        .select("id_empleado, fecha")
        .eq("id_asistencia", Number(id_asistencia))
        .maybeSingle();

      if (asistenciaError) {
        console.error(asistenciaError);
        return res.status(500).json({ error: "Error consultando asistencia" });
      }

      if (!asistencia) {
        return res.status(404).json({ error: "Asistencia no encontrada" });
      }

      if (!empleadoId) {
        empleadoId = asistencia.id_empleado;
      }

      if (!fechaIncidencia) {
        fechaIncidencia = asistencia.fecha;
      }
    }

    if (!empleadoId || !fechaIncidencia) {
      return res.status(400).json({ error: "id_empleado y fecha son obligatorios" });
    }

    const { data, error } = await supabase.rpc("sp_registrar_incidencia", {
      p_id_empleado: Number(empleadoId),
      p_descripcion: descripcion,
      p_fecha: fechaIncidencia,
      p_tipo: tipo
    });

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
