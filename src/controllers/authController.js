import { supabase } from "../supabase.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const USUARIOS_TABLE = process.env.SUPABASE_USUARIOS_TABLE || "usuario";
const EMPLEADOS_TABLE = process.env.SUPABASE_EMPLEADOS_TABLE || "empleado";
const ROLES_TABLE = process.env.SUPABASE_ROLES_TABLE || "rol";

export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username y password son obligatorios" });
    }

    const { data: isValid, error } = await supabase.rpc("fn_validar_login", {
      p_username: username,
      p_password: password
    });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error validando credenciales" });
    }

    if (isValid !== true) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const { data: userRow, error: userError } = await supabase
      .from(USUARIOS_TABLE)
      .select("id_usuario, id_empleado, id_rol, username, id_estado")
      .eq("username", username)
      .single();

    if (userError || !userRow) {
      console.error("No se pudo obtener el usuario luego de validar login", userError);
      return res.status(500).json({ error: "No se pudo recuperar los datos del usuario" });
    }

    let empleadoNombre = null;
    let empleadoApellido = null;
    let empleadoFoto = null;
    let rolNombre = null;

    if (userRow.id_empleado && EMPLEADOS_TABLE) {
      const { data: empleadoData } = await supabase
        .from(EMPLEADOS_TABLE)
        .select("*")
        .eq("id_empleado", userRow.id_empleado)
        .single();

      empleadoNombre = empleadoData?.nombre ?? null;
      empleadoApellido = empleadoData?.apellido ?? null;
      empleadoFoto =
        empleadoData?.foto ||
        empleadoData?.ruta_imagen ||
        empleadoData?.foto_url ||
        empleadoData?.imagen ||
        null;
    }

    if (userRow.id_rol && ROLES_TABLE) {
      const { data: rolData } = await supabase
        .from(ROLES_TABLE)
        .select("nombre")
        .eq("id_rol", userRow.id_rol)
        .single();

      rolNombre = rolData?.nombre ?? null;
    }

    const tokenPayload = {
      id_usuario: userRow.id_usuario,
      id_empleado: userRow.id_empleado,
      id_rol: userRow.id_rol || null,
      rol_nombre: rolNombre
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h"
    });

    res.json({
      id_usuario: userRow.id_usuario,
      id_empleado: userRow.id_empleado,
      id_rol: userRow.id_rol || null,
      rol_nombre: rolNombre,
      empleado_nombre: empleadoNombre,
      empleado_apellido: empleadoApellido,
      foto: empleadoFoto,
      ruta_imagen: empleadoFoto,
      foto_url: empleadoFoto,
      usuario_estado: userRow.id_estado ?? null,
      username: userRow.username,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}

export async function changePassword(req, res) {
  try {
    const { username, current_password: currentPassword, new_password: newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "username, current_password y new_password son obligatorios" });
    }

    // Verificar contraseña actual
    const { data: isValid, error: validateError } = await supabase.rpc("fn_validar_login", {
      p_username: username,
      p_password: currentPassword
    });

    if (validateError) {
      console.error(validateError);
      return res.status(500).json({ error: "Error validando la contraseña actual" });
    }

    if (isValid !== true) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }

    // Generar hash bcrypt compatible con pgcrypto/crypt('bf')
    const hashed = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from(USUARIOS_TABLE)
      .update({ contrasena: hashed })
      .eq("username", username);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ error: "No se pudo actualizar la contraseña" });
    }

    return res.json({ success: true, message: "Contraseña actualizada" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}
