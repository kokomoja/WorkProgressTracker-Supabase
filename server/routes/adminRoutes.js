import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { supabase } from "../utils/supabaseClient.js";
import { verifyToken } from "../utils/verifyToken.js";
import { requireAdmin } from "../utils/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

dotenv.config();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const CONFIRM_SECRET = process.env.CONFIRM_SECRET;

router.get(
  "/users",
  verifyToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("users")
      .select("username, display_name, role")
      .order("display_name", { ascending: true });

    if (error) throw error;
    res.json(data);
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    if (!user)
      return res
        .status(401)
        .json({ status: "error", message: "ไม่พบชื่อผู้ใช้" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res
        .status(401)
        .json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" });

    const token = jwt.sign(
      {
        username: user.username,
        role: user.role,
        display_name: user.display_name,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      status: "success",
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      token,
    });
  })
);

router.post(
  "/admin-setting/register",
  asyncHandler(async (req, res) => {
    const { username, password, display_name, role, secret } = req.body;

    if (secret !== CONFIRM_SECRET)
      return res
        .status(403)
        .json({ status: "error", message: "Secret ไม่ถูกต้อง" });

    const { data: existing } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing)
      return res
        .status(400)
        .json({ status: "error", message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { error } = await supabase.from("users").insert([
      {
        username,
        password: hashedPassword,
        display_name,
        role,
      },
    ]);

    if (error) throw error;
    res.json({ status: "success", message: "สมัครสมาชิกสำเร็จ!" });
  })
);

router.put("/admin-setting/reset-password", verifyToken, async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res
        .status(400)
        .json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from("users")
      .update({ password: hashed })
      .eq("username", username);

    if (error) throw error;

    res.json({ status: "success", message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.error("❌ reset-password error:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
