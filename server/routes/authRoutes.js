import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../utils/supabaseClient.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const CONFIRM_SECRET = process.env.CONFIRM_SECRET;

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (!user) return res.status(401).json({ message: "ไม่พบชื่อผู้ใช้" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });

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
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

router.post("/admin-setting/register", async (req, res) => {
  try {
    const { username, password, display_name, role, secret } = req.body;
    if (secret !== CONFIRM_SECRET)
      return res.status(403).json({ message: "Secret ไม่ถูกต้อง" });

    const hashed = await bcrypt.hash(password, 10);
    const { error } = await supabase
      .from("users")
      .insert([{ username, password: hashed, display_name, role }]);
    if (error) throw error;
    res.json({ status: "success", message: "สมัครสมาชิกสำเร็จ!" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

router.post("/admin-setting/forgot-password", async (req, res) => {
  try {
    const { username, new_password, secret } = req.body;
    if (secret !== CONFIRM_SECRET)
      return res.status(403).json({ message: "Secret ไม่ถูกต้อง" });

    const hashed = await bcrypt.hash(new_password, 10);
    const { error } = await supabase
      .from("users")
      .update({ password: hashed })
      .eq("username", username);

    if (error) throw error;
    res.json({ status: "success", message: "เปลี่ยนรหัสผ่านสำเร็จ!" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
