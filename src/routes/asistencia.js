import { Router } from "express";
import { registrarEntrada,registrarSalida, obtenerAsistencias } from "../controllers/asistenciaController.js";

const router = Router();

router.post("/entrada", registrarEntrada);
router.post("/salida", registrarSalida);
router.get("/:id_empleado", obtenerAsistencias);

export default router;
