import { Router } from "express";
import { supabase } from "../supabase.js";

const router = Router();
const BRANCHES_TABLE = process.env.SUPABASE_BRANCHES_TABLE || "branches";

router.get("/", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from(BRANCHES_TABLE)
      .select("id, name, address, is_active, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error obteniendo sucursales" });
    }

    res.json({ branches: data || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

router.post("/", async (req, res) => {
  const { name, address = null, is_active = true } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: "name es requerido" });
  }

  try {
    const { data, error } = await supabase
      .from(BRANCHES_TABLE)
      .insert([
        {
          name,
          address,
          is_active: Boolean(is_active)
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "No se pudo crear la sucursal" });
    }

    res.json({ branch: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
