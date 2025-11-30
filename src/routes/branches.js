import { Router } from "express";
import { supabase } from "../supabase.js";

const router = Router();
const BRANCHES_TABLE = process.env.SUPABASE_BRANCHES_TABLE || "branches";
const ZONES_TABLE = process.env.SUPABASE_ZONES_TABLE || "zones";

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

router.delete("/:id", async (req, res) => {
  const branchId = Number(req.params.id);
  if (!branchId) {
    return res.status(400).json({ error: "id invalido" });
  }

  try {
    if (ZONES_TABLE) {
      const { error: zonesError } = await supabase.from(ZONES_TABLE).delete().eq("branch_id", branchId);
      if (zonesError) {
        console.error("Error eliminando zonas de la sucursal:", zonesError);
        return res.status(500).json({ error: "No se pudieron eliminar las zonas de la sucursal" });
      }
    }

    const { data, error } = await supabase.from(BRANCHES_TABLE).delete().eq("id", branchId).select().maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "No se pudo eliminar la sucursal" });
    }

    if (!data) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }

    res.json({ mensaje: "Sucursal eliminada", branch: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
