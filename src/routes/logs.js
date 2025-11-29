import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
import { listarLogsEmpleado } from "../controllers/logsController.js";

const router = Router();

router.get("/empleados", requireAuth, requireAdmin, listarLogsEmpleado);

export default router;
