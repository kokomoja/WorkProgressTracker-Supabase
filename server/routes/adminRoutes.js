import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { supabase } from "../utils/supabaseClient.js";
import { verifyToken } from "../utils/verifyToken.js";
import { requireAdmin } from "../requireAdmin.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "../config.json");

// ✅ โหลดรายชื่อผู้ใช้
router.get("/users", verifyToken, async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase() || "";
    const { data, error } = await supabase
      .from("users")
      .select("username, display_name, role")
      .order("display_name", { ascending: true });

    if (error) throw error;

    const filtered = q
      ? data.filter(
          (u) =>
            u.username.toLowerCase().includes(q) ||
            (u.display_name?.toLowerCase().includes(q) ?? false)
        )
      : data;

    res.json(filtered);
  } catch (err) {
    console.error("❌ โหลดรายชื่อผู้ใช้ไม่สำเร็จ:", err);
    res.status(500).json({ error: "load users failed" });
  }
});

// ✅ อัปเดตสิทธิ์ผู้ใช้
router.put(
  "/users/:username/role",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { username } = req.params;
      const { role } = req.body;

      const { error } = await supabase
        .from("users")
        .update({ role })
        .eq("username", username);

      if (error) throw error;
      res.json({ status: "success", message: "อัปเดตสิทธิ์ผู้ใช้สำเร็จ" });
    } catch (err) {
      console.error("❌ update role failed:", err);
      res.status(500).json({ error: "update role failed" });
    }
  }
);

// ✅ อ่านการตั้งค่า admin
router.get("/admin/settings", verifyToken, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return res.json({
        secret: "0845535000721",
        statuses: ["ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น"],
      });
    }
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    res.json(config);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ บันทึกการตั้งค่า admin
router.put("/admin/settings", verifyToken, requireAdmin, (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    res.json({ status: "success", message: "บันทึกการตั้งค่าสำเร็จ" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
