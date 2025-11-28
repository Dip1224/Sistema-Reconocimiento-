import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const EMPLEADOS_TABLE = process.env.SUPABASE_EMPLEADOS_TABLE;

export async function listarEmpleados(_req, res) {
  try {
    if (!EMPLEADOS_TABLE) {
      return res.status(500).json({ error: "Tabla de empleados no configurada" });
    }

    const { data, error } = await supabase.from(EMPLEADOS_TABLE).select("*");

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error obteniendo empleados" });
    }

    res.json({ empleados: data || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}

export async function registrarEmpleado(req, res) {
  try {
    const {
      ci,
      nombre,
      apellido,
      cargo,
      id_departamento,
      fecha_ingreso
    } = req.body;

    const faltantes = [];
    if (!ci) faltantes.push("ci");
    if (!nombre) faltantes.push("nombre");
    if (!apellido) faltantes.push("apellido");
    if (!cargo) faltantes.push("cargo");
    if (!id_departamento) faltantes.push("id_departamento");
    if (!fecha_ingreso) faltantes.push("fecha_ingreso");

    if (faltantes.length) {
      return res.status(400).json({ error: `Campos requeridos faltantes: ${faltantes.join(", ")}` });
    }

    const fotoArchivo = req.file;

    if (!fotoArchivo) {
      return res.status(400).json({ error: "Debe enviar una foto" });
    }

    if (!process.env.SUPABASE_BUCKET) {
      return res.status(500).json({ error: "Bucket de Supabase no configurado" });
    }

    const fileName = `empleado_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, fotoArchivo.buffer, {
        contentType: fotoArchivo.mimetype
      });

    if (uploadError) {
      console.error(uploadError);
      return res.status(500).json({ error: "Error subiendo imagen", detalle: uploadError.message });
    }

    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    const fotoURL = urlData.publicUrl;

    const { data, error } = await supabase.rpc("fn_registrar_empleado", {
      p_ci: ci,
      p_nombre: nombre,
      p_apellido: apellido,
      p_cargo: cargo,
      p_id_departamento: Number(id_departamento),
      p_foto: fotoURL,
      p_fecha_ingreso: fecha_ingreso
    });

    if (error) {
      console.error("Error registrando empleado:", error);
      const pgCode = error?.code;
      const status = pgCode === "23505" ? 409 : 500;
      return res.status(status).json({
        error: "Error registrando empleado",
        detalle: error.message || error.hint || error
      });
    }

    res.json({
      mensaje: "Empleado registrado correctamente",
      empleado: data,
      foto_url: fotoURL
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
