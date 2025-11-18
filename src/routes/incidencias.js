import { Router } from "express";
import { registrarIncidencia } from "../controllers/incidenciasController.js";

const router = Router();

router.post("/registrar", registrarIncidencia);

export default router;
