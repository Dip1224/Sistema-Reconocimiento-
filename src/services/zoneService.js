import { supabase } from "../supabase.js";

const ZONES_TABLE = process.env.SUPABASE_ZONES_TABLE || "zones";
const BRANCHES_TABLE = process.env.SUPABASE_BRANCHES_TABLE || "branches";

function normalizeZone(record = {}) {
  return {
    id: record.id,
    name: record.name,
    branch_id: record.branch_id,
    center: {
      lat: Number(record.lat),
      lng: Number(record.lng)
    },
    radius: Number(record.radius_m),
    is_active: Boolean(record.is_active),
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export async function ensureBranchExists(branchId) {
  const { data, error } = await supabase
    .from(BRANCHES_TABLE)
    .select("id")
    .eq("id", branchId)
    .maybeSingle();

  if (error) {
    throw new Error("Error verificando la sucursal");
  }

  return Boolean(data?.id);
}

export async function findActiveZoneByBranch(branchId) {
  const { data, error } = await supabase
    .from(ZONES_TABLE)
    .select("id, name, lat, lng, radius_m, branch_id, is_active, created_at, updated_at")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Error consultando la zona");
  }

  if (!data) return null;
  return normalizeZone(data);
}

export async function saveZoneForBranch({ branchId, name, lat, lng, radius, createdBy }) {
  const branchExists = await ensureBranchExists(branchId);
  if (!branchExists) {
    return { error: "La sucursal no existe", status: 404 };
  }

  await supabase
    .from(ZONES_TABLE)
    .update({ is_active: false })
    .eq("branch_id", branchId)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from(ZONES_TABLE)
    .insert([
      {
        name,
        lat,
        lng,
        radius_m: radius,
        branch_id: branchId,
        is_active: true,
        created_by: createdBy || null
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    return { error: "No se pudo guardar la zona" };
  }

  return { zone: normalizeZone(data) };
}
