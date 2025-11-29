import { Router } from "express";
import { listarDepartamentos } from "../controllers/departamentosController.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, listarDepartamentos);

export default router;
