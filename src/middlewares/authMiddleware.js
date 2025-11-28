import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    res.locals.user = decoded;

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

export function requireAdmin(req, res, next) {
  const user = res.locals.user || req.user;
  if (!user) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const roleName = (user.rol_nombre || "").toLowerCase();
  const roleId = Number(user.id_rol);

  if (roleId === 1 || roleName.includes("admin")) {
    return next();
  }

  return res.status(403).json({ error: "Acceso restringido a administradores" });
}
