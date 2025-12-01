import { supabase } from "../supabase.js";
import cosineSimilarity from "../utils/cosineSimilarity.js";
import dotenv from "dotenv";
import {
  registrarEntradaAsistencia,
  registrarSalidaAsistencia
} from "../services/asistenciaService.js";

dotenv.config();

const PLANTILLAS_TABLE = process.env.SUPABASE_PLANTILLAS_TABLE || "plantilla_facial";
const EMPLEADOS_TABLE = process.env.SUPABASE_EMPLEADOS_TABLE || "empleado";
const ASISTENCIA_TABLE = process.env.SUPABASE_ASISTENCIAS_TABLE || "asistencia";

function parseEnvNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const FACE_MIN_EMBEDDINGS = parseEnvNumber(process.env.FACE_MIN_EMBEDDINGS, 2);
const FACE_MATCH_THRESHOLD = parseEnvNumber(process.env.FACE_MATCH_THRESHOLD, 0.65);
const FACE_MATCH_MARGIN = parseEnvNumber(process.env.FACE_MATCH_MARGIN, 0.1);
const FACE_STRICT_THRESHOLD =
  process.env.FACE_STRICT_THRESHOLD === undefined
    ? 0.85
    : parseEnvNumber(process.env.FACE_STRICT_THRESHOLD, 0);
const FACE_RELAXED_THRESHOLD = parseEnvNumber(
  process.env.FACE_RELAXED_THRESHOLD,
  Math.max(FACE_MATCH_THRESHOLD - 0.05, 0.6)
);
const FACE_RELAXED_MARGIN = parseEnvNumber(
  process.env.FACE_RELAXED_MARGIN,
  Math.max(FACE_MATCH_MARGIN * 1.5, FACE_MATCH_MARGIN + 0.05)
);
const FACE_MARGIN_RELAX_FACTOR = parseEnvNumber(process.env.FACE_MARGIN_RELAX_FACTOR, 0.5);
const FACE_MIN_DYNAMIC_MARGIN = parseEnvNumber(process.env.FACE_MIN_DYNAMIC_MARGIN, 0.02);

function buildClientDate({ clientTimestamp, timezoneOffsetMinutes }) {
  const utcMs = Number.isFinite(Number(clientTimestamp)) ? Number(clientTimestamp) : Date.now();
  const offsetMinutes = Number.isFinite(Number(timezoneOffsetMinutes))
    ? Number(timezoneOffsetMinutes)
    : null;
  const localMs = offsetMinutes !== null ? utcMs - offsetMinutes * 60 * 1000 : utcMs;
  const date = new Date(localMs);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function normalizeEmbedding(vector = []) {
  if (!Array.isArray(vector) || !vector.length) return [];
  const parsed = vector.map(value => Number(value) || 0);
  const magnitude = Math.sqrt(parsed.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return parsed;
  return parsed.map(value => value / magnitude);
}

function buildPlantillasMap(plantillas = []) {
  const map = new Map();
  for (const plantilla of plantillas) {
    if (!Array.isArray(plantilla.embedding) || !plantilla.embedding.length) continue;
    const normalized = normalizeEmbedding(plantilla.embedding);
    if (!normalized.length) continue;
    const employeeEmbeddings = map.get(plantilla.id_empleado) || [];
    employeeEmbeddings.push(normalized);
    map.set(plantilla.id_empleado, employeeEmbeddings);
  }
  return map;
}

function resolveMargin(score, baseMargin, threshold) {
  if (!Number.isFinite(baseMargin) || baseMargin <= 0) {
    return FACE_MIN_DYNAMIC_MARGIN;
  }

  if (!Number.isFinite(score)) {
    return Math.max(baseMargin, FACE_MIN_DYNAMIC_MARGIN);
  }

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return Math.max(baseMargin, FACE_MIN_DYNAMIC_MARGIN);
  }

  const overThreshold = Math.max(0, score - threshold);
  const reduction = overThreshold * FACE_MARGIN_RELAX_FACTOR;
  const reducedMargin = baseMargin - reduction;
  const minMargin = Math.max(baseMargin * 0.4, FACE_MIN_DYNAMIC_MARGIN);
  return Math.max(reducedMargin, minMargin);
}

function evaluateEmbedding(inputEmbedding, plantillasMap) {
  const normalizedInput = normalizeEmbedding(inputEmbedding);
  if (!normalizedInput.length) {
    return {
      bestEmpleado: null,
      bestScore: -1,
      secondScore: -1,
      coincidencias: []
    };
  }

  let bestEmpleado = null;
  let bestScore = -1;
  let secondScore = -1;
  const coincidencias = [];

  for (const [idEmpleado, embeddings] of plantillasMap.entries()) {
    let bestForEmployee = -1;
    for (const plantillaEmbedding of embeddings) {
      const score = cosineSimilarity(normalizedInput, plantillaEmbedding);
      if (score > bestForEmployee) {
        bestForEmployee = score;
      }
    }

    if (bestForEmployee >= 0) {
      coincidencias.push({ id_empleado: idEmpleado, score: bestForEmployee });
      if (bestForEmployee > bestScore) {
        secondScore = bestScore;
        bestScore = bestForEmployee;
        bestEmpleado = idEmpleado;
      } else if (bestForEmployee > secondScore) {
        secondScore = bestForEmployee;
      }
    }
  }

  coincidencias.sort((a, b) => b.score - a.score);

  return {
    bestEmpleado,
    bestScore,
    secondScore,
    coincidencias: coincidencias.slice(0, 3)
  };
}

function evaluateConfidence(evalResult) {
  if (!evalResult || !evalResult.bestEmpleado) {
    return {
      ...evalResult,
      diferencia: -1,
      confidence: "none",
      valid: false
    };
  }

  const diff =
    Number.isFinite(evalResult.secondScore) && evalResult.secondScore >= 0
      ? evalResult.bestScore - evalResult.secondScore
      : 1;

  const normalizedDiff = Number.isFinite(diff) ? diff : 0;
  const strictEnabled = FACE_STRICT_THRESHOLD > 0;
  const strictMargin = resolveMargin(evalResult.bestScore, FACE_MATCH_MARGIN, FACE_STRICT_THRESHOLD);
  const baseMargin = resolveMargin(evalResult.bestScore, FACE_MATCH_MARGIN, FACE_MATCH_THRESHOLD);
  const relaxedMargin = resolveMargin(evalResult.bestScore, FACE_RELAXED_MARGIN, FACE_RELAXED_THRESHOLD);

  const meetsStrict =
    strictEnabled &&
    evalResult.bestScore >= FACE_STRICT_THRESHOLD &&
    normalizedDiff >= strictMargin;
  const meetsBase =
    evalResult.bestScore >= FACE_MATCH_THRESHOLD &&
    normalizedDiff >= baseMargin;
  const meetsRelaxed =
    evalResult.bestScore >= FACE_RELAXED_THRESHOLD &&
    normalizedDiff >= relaxedMargin;

  let confidence = "none";
  let valid = false;
  if (meetsStrict) {
    confidence = "alta";
    valid = true;
  } else if (meetsBase) {
    confidence = "media";
    valid = true;
  } else if (meetsRelaxed) {
    confidence = "baja";
    valid = true;
  }

  return {
    ...evalResult,
    diferencia: normalizedDiff,
    confidence,
    valid
  };
}

export async function registrarPlantilla(req, res) {
  try {
    const { id_empleado, ruta_imagen, embedding } = req.body;

    if (!id_empleado || !embedding) {
      return res.status(400).json({ error: "id_empleado y embedding son obligatorios" });
    }

    console.log("[plantillas] Solicitud de registro", {
      id_empleado,
      tieneRutaImagen: Boolean(ruta_imagen),
      totalValoresEmbedding: Array.isArray(embedding) ? embedding.length : 0
    });

    const { data: empleado, error: empleadoError } = await supabase
      .from(EMPLEADOS_TABLE)
      .select("id_empleado")
      .eq("id_empleado", Number(id_empleado))
      .single();

    if (empleadoError || !empleado) {
      console.error(empleadoError);
      return res.status(400).json({ error: "Empleado no encontrado" });
    }

    const { data, error } = await supabase
      .from(PLANTILLAS_TABLE)
      .insert([
        {
          id_empleado: Number(id_empleado),
          ruta_imagen: ruta_imagen || null,
          embedding,
          activo: true
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("[plantillas] Error insertando plantilla:", error);
      return res.status(500).json({ error: "Error registrando plantilla facial" });
    }

    console.log("[plantillas] Plantilla registrada:", data?.id_plantilla);

    return res.json({
      mensaje: "Plantilla facial registrada correctamente",
      plantilla: data
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}

export async function identificarPersona(req, res) {
  try {
    const { embedding, embeddings, id_dispositivo, debug } = req.body;
    const debugMode = Boolean(debug);

    const providedEmbeddings = Array.isArray(embeddings)
      ? embeddings
      : Array.isArray(embedding)
        ? [embedding]
        : [];

    if (!providedEmbeddings.length) {
      return res.status(400).json({ error: "No se recibieron embeddings para validar" });
    }

    if (FACE_MIN_EMBEDDINGS > 1 && providedEmbeddings.length < FACE_MIN_EMBEDDINGS) {
      return res.status(400).json({
        error: `Se requieren al menos ${FACE_MIN_EMBEDDINGS} capturas para validar el rostro`
      });
    }

    const { data: plantillas, error: plantillasError } = await supabase
      .from(PLANTILLAS_TABLE)
      .select("id_empleado, embedding")
      .eq("activo", true);

    if (plantillasError) {
      console.error(plantillasError);
      return res.status(500).json({ error: "Error obteniendo plantillas" });
    }

    if (!plantillas || !plantillas.length) {
      return res.status(404).json({ error: "No hay plantillas registradas" });
    }

    const plantillasMap = buildPlantillasMap(plantillas);
    if (!plantillasMap.size) {
      return res.status(404).json({ error: "No hay plantillas con embeddings validos" });
    }

    const evaluations = providedEmbeddings.map(item => evaluateEmbedding(item, plantillasMap));
    const evaluationsWithConfidence = evaluations.map(evaluateConfidence);

    const invalidEvaluation = evaluationsWithConfidence.find(evalResult => !evalResult.valid);

    if (invalidEvaluation) {
      return res.status(401).json({
        identificado: false,
        score: invalidEvaluation.bestScore,
        confidence: invalidEvaluation.confidence,
        coincidencias: debugMode ? invalidEvaluation.coincidencias : undefined,
        evaluations: debugMode ? evaluationsWithConfidence : undefined,
        motivo: invalidEvaluation.bestEmpleado
          ? "Coincidencia debil o ambigua"
          : "No se pudo determinar un candidato valido"
      });
    }

    const firstEvaluation = evaluationsWithConfidence[0];
    const candidatoFinal = firstEvaluation.bestEmpleado;

    const allMatchSameEmployee = evaluationsWithConfidence.every(
      evalResult => evalResult.bestEmpleado === candidatoFinal
    );

    if (!allMatchSameEmployee) {
      return res.status(401).json({
        identificado: false,
        score: firstEvaluation.bestScore,
        confidence: firstEvaluation.confidence,
        coincidencias: debugMode ? firstEvaluation.coincidencias : undefined,
        evaluations: debugMode ? evaluationsWithConfidence : undefined,
        motivo: "Las capturas no coinciden con la misma persona"
      });
    }

    const { data: empleado, error: empError } = await supabase
      .from(EMPLEADOS_TABLE)
      .select("id_empleado, nombre, apellido")
      .eq("id_empleado", candidatoFinal)
      .single();

    if (empError || !empleado) {
      console.error(empError);
      return res.status(500).json({ error: "Error obteniendo empleado" });
    }

    const ahora = buildClientDate({
      clientTimestamp: req.body?.clientTimestamp,
      timezoneOffsetMinutes: req.body?.timezoneOffsetMinutes
    });
    const fecha = [
      ahora.getFullYear(),
      String(ahora.getMonth() + 1).padStart(2, "0"),
      String(ahora.getDate()).padStart(2, "0")
    ].join("-");
    const hora = [
      String(ahora.getHours()).padStart(2, "0"),
      String(ahora.getMinutes()).padStart(2, "0"),
      String(ahora.getSeconds()).padStart(2, "0")
    ].join(":");

    const { data: asistencias } = await supabase
      .from(ASISTENCIA_TABLE)
      .select("*")
      .eq("id_empleado", candidatoFinal)
      .eq("fecha", fecha)
      .order("id_asistencia", { ascending: false })
      .limit(1);

    const asistenciaHoy = asistencias && asistencias.length ? asistencias[0] : null;

    if (!asistenciaHoy) {
      const entradaResult = await registrarEntradaAsistencia({
        id_empleado: candidatoFinal,
        id_dispositivo: id_dispositivo || 1,
        fecha,
        hora_entrada: hora,
        numero_turno: 1,
        metodo_registro: "facial"
      });

      if (entradaResult.error) {
        return res.status(entradaResult.status || 500).json({ error: entradaResult.error });
      }

      return res.json({
        identificado: true,
        accion: "entrada",
        empleado,
        score: firstEvaluation.bestScore,
        confidence: firstEvaluation.confidence,
        coincidencias: debugMode ? firstEvaluation.coincidencias : undefined,
        evaluations: debugMode ? evaluationsWithConfidence : undefined
      });
    }

    if (!asistenciaHoy.hora_salida) {
      const salidaResult = await registrarSalidaAsistencia({
        id_empleado: candidatoFinal,
        fecha,
        hora_salida: hora,
        numero_turno: asistenciaHoy.numero_turno || 1
      });

      if (salidaResult.error) {
        return res.status(salidaResult.status || 500).json({ error: salidaResult.error });
      }

      return res.json({
        identificado: true,
        accion: "salida",
        empleado,
        score: firstEvaluation.bestScore,
        confidence: firstEvaluation.confidence,
        coincidencias: debugMode ? firstEvaluation.coincidencias : undefined,
        evaluations: debugMode ? evaluationsWithConfidence : undefined
      });
    }

    return res.json({
      identificado: true,
      accion: "completado",
      empleado,
      score: firstEvaluation.bestScore,
      confidence: firstEvaluation.confidence,
      coincidencias: debugMode ? firstEvaluation.coincidencias : undefined,
      evaluations: debugMode ? evaluationsWithConfidence : undefined
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}
