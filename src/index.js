import express from "express";
import cors from "cors";
import empleadosRoutes from "./routes/empleados.js";
import authRoutes from "./routes/auth.js";
import asistenciaRoutes from "./routes/asistencia.js";
import incidenciasRoutes from "./routes/incidencias.js";
import horariosRoutes from "./routes/horarios.js";
import plantillasRoutes from "./routes/plantillas.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim()).filter(Boolean)
  : [];

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*"
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "asistencia-backend" });
});

app.use("/auth", authRoutes);
app.use("/empleados", empleadosRoutes);
app.use("/asistencia", asistenciaRoutes);
app.use("/incidencias", incidenciasRoutes);
app.use("/horarios", horariosRoutes);
app.use("/plantillas", plantillasRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
