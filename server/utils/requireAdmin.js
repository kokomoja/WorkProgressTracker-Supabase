export function requireAdmin(req, res, next) {
  try {
    if (req.user && req.user.role === "admin") return next();
    res.status(403).json({ status: "error", message: "Forbidden" });
  } catch {
    res.status(401).json({ status: "error", message: "Unauthorized" });
  }
}
