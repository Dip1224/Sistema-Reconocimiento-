import { Router } from "express";
import { findActiveZoneByBranch, saveZoneForBranch } from "../services/zoneService.js";

const router = Router();

router.get("/", async (req, res) => {
  const branchId = req.query.branch_id;

  if (!branchId) {
    return res.status(400).json({ error: "branch_id es requerido" });
  }

  try {
    const zone = await findActiveZoneByBranch(branchId);

    if (!zone) {
      return res.status(404).json({ error: "No hay zona activa para esta sucursal" });
    }

    res.json({ zone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo la zona" });
  }
});

router.post("/", async (req, res) => {
  const { branch_id, name, center, radius, created_by } = req.body || {};

  if (!branch_id) {
    return res.status(400).json({ error: "branch_id es requerido" });
  }

  if (!name) {
    return res.status(400).json({ error: "name es requerido" });
  }

  if (!center || typeof center.lat !== "number" || typeof center.lng !== "number") {
    return res.status(400).json({ error: "center.lat y center.lng deben ser numeros" });
  }

  const radiusNumber = Number(radius);
  if (!Number.isFinite(radiusNumber) || radiusNumber <= 0) {
    return res.status(400).json({ error: "radius debe ser un numero mayor a 0" });
  }

  try {
    const { error, status, zone } = await saveZoneForBranch({
      branchId: branch_id,
      name,
      lat: center.lat,
      lng: center.lng,
      radius: radiusNumber,
      createdBy: created_by
    });

    if (error) {
      return res.status(status || 500).json({ error });
    }

    res.json({ zone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando la zona" });
  }
});

export default router;
