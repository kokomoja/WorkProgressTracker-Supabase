import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token)
    return res.status(401).json({ status: "error", message: "Missing token" });

  jwt.verify(token.replace("Bearer ", ""), JWT_SECRET, (err, decoded) => {
    if (err)
      return res
        .status(403)
        .json({ status: "error", message: "Invalid token" });
    req.user = decoded;
    next();
  });
}
