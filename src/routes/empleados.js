import { Router } from "express";
import multer from "multer";
import { registrarEmpleado, listarEmpleados } from "../controllers/empleadosController.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", requireAuth, requireAdmin, listarEmpleados);
router.post("/registrar", requireAuth, requireAdmin, upload.single("foto"), registrarEmpleado);

export default router;
