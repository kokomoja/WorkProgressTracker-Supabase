import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { supabase } from "../utils/supabaseClient.js";

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const CONFIRM_SECRET = process.env.CONFIRM_SECRET;

// ✅ สมัครสมาชิก
router.post("/register", async (req, res) => {
  try {
    const { username, password, display_name, role, secret } = req.body;
    if (secret !== CONFIRM_SECRET)
      return res
        .status(403)
        .json({ status: "error", message: "รหัสยืนยันไม่ถูกต้อง" });

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("username", username);

    if (existing?.length > 0)
      return res
        .status(400)
        .json({ status: "error", message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });

    const hashed = await bcrypt.hash(password, 10);
    const roleFinal = role === "admin" ? "admin" : "user";

    const { error } = await supabase.from("users").insert({
      username,
      password: hashed,
      display_name,
      role: roleFinal,
    });

    if (error) throw error;
    res.json({ status: "success", message: "สมัครสมาชิกสำเร็จ!" });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ เข้าสู่ระบบ
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (!data)
      return res
        .status(401)
        .json({ status: "error", message: "ไม่พบชื่อผู้ใช้" });

    const valid = await bcrypt.compare(password, data.password);
    if (!valid)
      return res
        .status(401)
        .json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" });

    const token = jwt.sign(
      {
        username: data.username,
        role: data.role,
        display_name: data.display_name,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      status: "success",
      username: data.username,
      display_name: data.display_name,
      role: data.role,
      token,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ รีเซ็ตรหัสผ่าน
router.post("/reset-password", async (req, res) => {
  try {
    const { username, newPassword, secret } = req.body;
    if (secret !== CONFIRM_SECRET)
      return res
        .status(403)
        .json({ status: "error", message: "รหัสยืนยันไม่ถูกต้อง" });

    const hashed = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from("users")
      .update({ password: hashed })
      .eq("username", username);

    if (error) throw error;
    res.json({ status: "success", message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
