import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const DEPARTAMENTOS_TABLE = process.env.SUPABASE_DEPARTAMENTOS_TABLE || "departamento";

export async function listarDepartamentos(_req, res) {
  try {
    if (!DEPARTAMENTOS_TABLE) {
      return res.status(500).json({ error: "Tabla de departamentos no configurada" });
    }

    const { data, error } = await supabase.from(DEPARTAMENTOS_TABLE).select("*");

    if (error) {
      console.error("Error obteniendo departamentos:", error);
      return res.status(500).json({ error: "Error obteniendo departamentos" });
    }

    const departamentos = (data || []).map(item => ({
      id_departamento: item.id_departamento ?? item.id ?? null,
      nombre: item.nombre ?? item.descripcion ?? item.nombre_departamento ?? "Sin nombre"
    }));

    res.json({ departamentos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
