import { Router } from "express";
import multer from "multer";
import {
  registrarEmpleado,
  listarEmpleados,
  actualizarEmpleado,
  eliminarEmpleado
} from "../controllers/empleadosController.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", requireAuth, requireAdmin, listarEmpleados);
router.post("/registrar", requireAuth, requireAdmin, upload.single("foto"), registrarEmpleado);
router.put("/:id_empleado", requireAuth, requireAdmin, actualizarEmpleado);
router.delete("/:id_empleado", requireAuth, requireAdmin, eliminarEmpleado);

export default router;
