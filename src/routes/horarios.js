import { Router } from "express";
import {
  listarHorarios,
  registrarHorario,
  eliminarHorario
} from "../controllers/horariosController.js";

const router = Router();

router.get("/empleado/:id_empleado", listarHorarios);
router.post("/registrar", registrarHorario);
router.delete("/:id_horario", eliminarHorario);

export default router;
