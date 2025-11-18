import { Router } from "express";
import multer from "multer";
import { registrarEmpleado, listarEmpleados } from "../controllers/empleadosController.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", listarEmpleados);

// 👇 añade este middleware temporal
router.post(
  "/registrar",
  (req, _res, next) => {
    console.log("Content-Type recibido:", req.headers["content-type"]);
    next();
  },
  upload.single("foto"),
  registrarEmpleado
);

export default router;
