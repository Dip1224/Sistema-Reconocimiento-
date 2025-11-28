import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const ROLES_TABLE = process.env.SUPABASE_ROLES_TABLE || "rol";

export async function listarRoles(_req, res) {
  try {
    if (!ROLES_TABLE) {
      return res.status(500).json({ error: "Tabla de roles no configurada" });
    }

    const { data, error } = await supabase.from(ROLES_TABLE).select("*");

    if (error) {
      console.error("Error obteniendo roles:", error);
      const fallback = [
        { id_rol: 1, nombre: "Admin" },
        { id_rol: 2, nombre: "Empleado" }
      ];
      return res.json({ roles: fallback });
    }

    const roles = (data || []).map(item => ({
      id_rol: item.id_rol ?? item.id ?? null,
      nombre: item.nombre ?? item.rol ?? "Sin nombre"
    }));

    res.json({ roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
