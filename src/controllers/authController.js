import { supabase } from "../supabase.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username y password son obligatorios" });
    }

    const { data, error } = await supabase.rpc("fn_validar_login", {
      p_username: username,
      p_contrasena: password
    });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error validando credenciales" });
    }

    if (!data || !data.length) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const payload = Array.isArray(data) ? data[0] : data;

    const tokenPayload = {
      id_usuario: payload.id_usuario,
      id_empleado: payload.id_empleado,
      id_rol: payload.id_rol || payload.rol_id || null
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h"
    });

    res.json({
      id_usuario: payload.id_usuario,
      id_empleado: payload.id_empleado,
      id_rol: payload.id_rol || payload.rol_id || null,
      rol_nombre: payload.rol_nombre || payload.rol || null,
      empleado_nombre: payload.empleado_nombre || payload.nombre || null,
      empleado_apellido: payload.empleado_apellido || payload.apellido || null,
      usuario_estado: payload.usuario_estado ?? payload.estado ?? null,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
