import express from "express";
import { supabase } from "../utils/supabaseClient.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = express.Router();

// ✅ โหลดรายการงานทั้งหมด (admin)
router.get("/tasks", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("worktasks")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ โหลดข้อมูลงานไม่สำเร็จ:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ โหลดงานตามชื่อผู้ใช้ (user)
router.get("/tasks/by-user", verifyToken, async (req, res) => {
  try {
    const username = req.query.username;
    if (!username)
      return res
        .status(400)
        .json({ status: "error", message: "Missing username" });

    // ดึง display_name จาก users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("display_name")
      .eq("username", username)
      .single();

    if (userError || !userData)
      return res.status(404).json({ status: "error", message: "ไม่พบผู้ใช้" });

    const { data, error } = await supabase
      .from("worktasks")
      .select("*")
      .eq("assignee", userData.display_name)
      .order("id", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ โหลดงานผู้ใช้ล้มเหลว:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ เพิ่มงานใหม่
router.post("/tasks", verifyToken, async (req, res) => {
  try {
    const t = req.body;

    // ดึง display_name ของ assignee (username → display_name)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("display_name")
      .eq("username", t.assignee)
      .single();

    if (userError) throw userError;

    const assigneeDisplay = userData?.display_name || t.assignee;

    const { error } = await supabase.from("worktasks").insert([
      {
        task_id: t.task_id,
        task_name: t.task_name || t.name,
        assignee: assigneeDisplay,
        start_date: t.startDate || null,
        end_date: t.endDate || null,
        progress: t.progress ?? 0,
        status: t.status || "ยังไม่เริ่ม",
        remark: t.remark || null,
        last_update: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    res.json({ status: "success", message: "เพิ่มงานสำเร็จ" });
  } catch (err) {
    console.error("❌ เพิ่มงานล้มเหลว:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ อัปเดตงาน
router.put("/tasks/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const t = req.body;

    const { error } = await supabase
      .from("worktasks")
      .update({
        task_name: t.task_name || t.name,
        assignee: t.assignee,
        start_date: t.startDate || t.start_date || null,
        end_date: t.endDate || t.end_date || null,
        progress: t.progress,
        status: t.status,
        remark: t.remark,
        last_update: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    res.json({ status: "success", message: "อัปเดตงานสำเร็จ" });
  } catch (err) {
    console.error("❌ อัปเดตงานล้มเหลว:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ✅ ลบงาน
router.delete("/tasks/:id", verifyToken, async (req, res) => {
  try {
    const taskId = req.params.id;

    const { data: taskData, error: fetchError } = await supabase
      .from("worktasks")
      .select("task_id")
      .eq("id", taskId)
      .single();

    if (fetchError) throw fetchError;
    if (!taskData)
      return res
        .status(404)
        .json({ status: "error", message: "ไม่พบบันทึกงาน" });

    const { error: deleteError } = await supabase
      .from("worktasks")
      .delete()
      .eq("id", taskId);

    if (deleteError) throw deleteError;

    res.json({
      status: "success",
      message: `ลบงานรหัส ${taskData.task_id || "(ไม่ทราบรหัส)"} สำเร็จ`,
    });
  } catch (err) {
    console.error("❌ ลบงานล้มเหลว:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
