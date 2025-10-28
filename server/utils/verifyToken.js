import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export function verifyToken(req, res, next) {
  const header = req.headers["authorization"];
  if (!header)
    return res.status(401).json({ status: "error", message: "Missing token" });

  const token = header.replace("Bearer ", "");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res
        .status(403)
        .json({ status: "error", message: "Invalid token" });
    req.user = decoded;
    next();
  });
}
