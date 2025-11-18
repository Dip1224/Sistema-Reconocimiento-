import { Router } from "express";
import { registrarPlantilla, identificarPersona } from "../controllers/plantillasController.js";
// import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/registrar", /* requireAuth, */ registrarPlantilla);
router.post("/identificar", /* requireAuth, */ identificarPersona);

export default router;
