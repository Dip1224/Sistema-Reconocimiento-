import { Router } from "express";
import { listarRoles } from "../controllers/rolesController.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, listarRoles);

export default router;
