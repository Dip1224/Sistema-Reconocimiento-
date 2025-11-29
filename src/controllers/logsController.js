import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const LOGS_TABLE = process.env.SUPABASE_LOGS_EMPLEADOS_TABLE || "log_empleado";

export async function listarLogsEmpleado(req, res) {
  try {
    if (!LOGS_TABLE) {
      return res.status(500).json({ error: "Tabla de logs no configurada" });
    }

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 && requestedLimit <= 1000 ? requestedLimit : 200;

    const { data, error } = await supabase
      .from(LOGS_TABLE)
      .select("id_log, fecha_evento, id_empleado, data, usuario, ip, evento")
      .order("fecha_evento", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error obteniendo logs de empleado:", error);
      return res.status(500).json({ error: "Error obteniendo logs de empleado" });
    }

    res.json({ logs: data || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
