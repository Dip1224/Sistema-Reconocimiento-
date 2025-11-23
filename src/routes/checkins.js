import { Router } from "express";
import haversineMeters from "../utils/haversine.js";
import { findActiveZoneByBranch } from "../services/zoneService.js";

const router = Router();

router.post("/", async (req, res) => {
  const { lat, lng, branch_id } = req.body || {};

  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat y lng son requeridos" });
  }

  if (!branch_id) {
    return res.status(400).json({ error: "branch_id es requerido" });
  }

  try {
    const zone = await findActiveZoneByBranch(branch_id);

    if (!zone) {
      return res.status(404).json({ error: "No hay zona activa para esta sucursal" });
    }

    const distance = haversineMeters({ lat, lng }, zone.center);
    const inside = distance <= (zone.radius || 0);

    return res.json({
      inside,
      distance,
      allowedRadius: zone.radius,
      center: zone.center,
      zone
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error validando la ubicacion" });
  }
});

export default router;
