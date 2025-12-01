import { Router } from "express";
import {
  listarHorarios,
  registrarHorario,
  actualizarHorario,
  eliminarHorario
} from "../controllers/horariosController.js";

const router = Router();

router.get("/empleado/:id_empleado", listarHorarios);
router.post("/registrar", registrarHorario);
router.put("/:id_horario", actualizarHorario);
router.delete("/:id_horario", eliminarHorario);

export default router;
