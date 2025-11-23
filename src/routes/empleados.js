import { Router } from "express";
import multer from "multer";
import { registrarEmpleado, listarEmpleados } from "../controllers/empleadosController.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", listarEmpleados);
router.post("/registrar", upload.single("foto"), registrarEmpleado);

export default router;
