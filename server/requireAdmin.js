export function requireAdmin(req, res, next) {
  try {
    if (req.user && req.user.role === "admin") return next();
    res.status(403).json({ error: "Forbidden" });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
