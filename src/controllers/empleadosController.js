import { supabase } from "../supabase.js";
import dotenv from "dotenv";

dotenv.config();

const EMPLEADOS_TABLE = process.env.SUPABASE_EMPLEADOS_TABLE;
const USUARIOS_TABLE = process.env.SUPABASE_USUARIOS_TABLE || "usuario";
const DEFAULT_USER_PASSWORD = "123";

function buildBaseUsername({ username, nombre, apellido, ci }) {
  const raw = (username || `${nombre || ""}.${apellido || ""}`).trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

  if (normalized) return normalized;
  if (ci) return `user${ci}`;
  return `user${Date.now()}`;
}

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
      fecha_ingreso,
      id_rol,
      username,
      password,
      contrasena
    } = req.body;

    const clave = password || contrasena || DEFAULT_USER_PASSWORD;
    const rolId = id_rol ? Number(id_rol) : 2;
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

    if (!EMPLEADOS_TABLE) {
      return res.status(500).json({ error: "Tabla de empleados no configurada" });
    }

    if (!Number.isInteger(rolId) || rolId <= 0) {
      return res.status(400).json({ error: "id_rol invalido" });
    }

    if (!USUARIOS_TABLE) {
      return res.status(500).json({ error: "Tabla de usuarios no configurada" });
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

    const empleadoCreado = Array.isArray(data) ? data[0] : data;

    if (!empleadoCreado?.id_empleado) {
      return res.status(500).json({
        error: "No se pudo obtener el ID del empleado creado"
      });
    }

    const baseUsername = buildBaseUsername({ username, nombre, apellido, ci });
    const crearUsuario = rolId === 1; // solo admins reciben cuenta de panel
    let finalUsername = baseUsername;
    let usuarioCreado = null;

    if (crearUsuario) {
      let usuarioError = null;
      for (let i = 0; i < 3; i += 1) {
        const candidate = i === 0 ? finalUsername : `${baseUsername}${Math.floor(Math.random() * 900 + 100)}`;
        const { data: insertedUser, error: insertError } = await supabase.rpc("fn_crear_usuario", {
          p_username: candidate,
          p_password: clave,
          p_id_rol: rolId,
          p_id_empleado: empleadoCreado.id_empleado,
          p_id_estado: 1
        });

        if (!insertError && insertedUser) {
          usuarioCreado = Array.isArray(insertedUser) ? insertedUser[0] : insertedUser;
          finalUsername = candidate;
          break;
        }

        usuarioError = insertError || new Error("No se pudo crear el usuario");
        const pgCode = insertError?.code;
        if (pgCode !== "23505") {
          break;
        }
      }

      if (usuarioError) {
        console.error("Error creando usuario:", usuarioError);
        if (EMPLEADOS_TABLE) {
          await supabase.from(EMPLEADOS_TABLE).delete().eq("id_empleado", empleadoCreado.id_empleado);
        }
        const pgCode = usuarioError?.code;
        if (pgCode === "23505") {
          return res.status(409).json({
            error: "El nombre de usuario ya existe",
            detalle: usuarioError.message || usuarioError.hint || usuarioError
          });
        }
        return res.status(500).json({
          error: "Error creando usuario vinculado",
          detalle: usuarioError.message || usuarioError.hint || usuarioError
        });
      }
    }

    res.json({
      mensaje: "Empleado y usuario registrados correctamente",
      empleado: data,
      usuario: crearUsuario && usuarioCreado ? { ...usuarioCreado, username: finalUsername, contrasena: undefined } : null,
      foto_url: fotoURL
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
