import express from "express";
import { supabase } from "../utils/supabaseClient.js";
import { verifyToken } from "../utils/verifyToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get(
  "/tasks",
  verifyToken,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Forbidden" });
    }

    const { data, error } = await supabase
      .from("worktasks")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    res.json(data);
  })
);

router.get(
  "/tasks/by-user",
  verifyToken,
  asyncHandler(async (req, res) => {
    const username = req.query.username || req.user.username;

    console.log("👤 โหลดงานของ:", username);

    const { data, error } = await supabase
      .from("worktasks")
      .select("*")
      .eq("assignee", username)
      .order("id", { ascending: false });

    if (error) throw error;
    console.log("📦 งานที่พบ:", data.length);
    res.json(data);
  })
);

router.post(
  "/tasks",
  verifyToken,
  asyncHandler(async (req, res) => {
    const t = req.body;
    const username = req.user.username;
    const role = req.user.role;

    if (role !== "admin") {
      t.assignee = username;
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("display_name")
      .eq("username", t.assignee)
      .single();

    if (userError || !userData)
      return res
        .status(404)
        .json({ status: "error", message: "ไม่พบข้อมูลผู้รับผิดชอบ" });

    const displayName = userData.display_name;
    const now = new Date().toLocaleString("th-TH", {
      hour12: false,
      timeZone: "Asia/Bangkok",
    });

    console.log("📩 เพิ่มงานใหม่:", t);
    const { data, error } = await supabase
      .from("worktasks")
      .insert([
        {
          task_id: t.task_id,
          task_name: t.task_name,
          assignee: t.assignee,
          assignee_display: displayName,
          start_date: t.start_date || null,
          end_date: t.end_date || null,
          progress: t.progress ?? 0,
          status: t.status || "ยังไม่เริ่ม",
          remark: t.remark || "",
          last_update: now,
        },
      ])
      .select("*")
      .single();

    console.log("✅ Supabase insert result:", { data, error });

    if (error) throw error;
    res.json({ status: "success", message: "เพิ่มงานสำเร็จ!", data });
  })
);

router.put(
  "/tasks/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const t = req.body;
    const username = req.user.username;
    const role = req.user.role;

    const { data: existingTask, error: taskError } = await supabase
      .from("worktasks")
      .select("assignee, assignee_display")
      .eq("id", id)
      .maybeSingle();

    if (taskError || !existingTask) {
      return res
        .status(404)
        .json({ status: "error", message: "ไม่พบข้อมูลงาน" });
    }

    if (role !== "admin" && existingTask.assignee !== username) {
      return res
        .status(403)
        .json({ status: "error", message: "ไม่มีสิทธิ์แก้ไขงานนี้" });
    }

    const newAssignee =
      role === "admin" ? t.assignee?.trim() || existingTask.assignee : username;

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("display_name")
      .eq("username", newAssignee)
      .maybeSingle();

    const displayName = userData?.display_name || existingTask.assignee_display;

    const now = new Date().toLocaleString("th-TH", {
      hour12: false,
      timeZone: "Asia/Bangkok",
    });

    const { error: updateErr } = await supabase
      .from("worktasks")
      .update({
        task_name: t.task_name,
        assignee: newAssignee,
        assignee_display: displayName,
        start_date: t.start_date || null,
        end_date: t.end_date || null,
        progress: t.progress ?? 0,
        status: t.status || "ยังไม่เริ่ม",
        remark: t.remark || "",
        last_update: now,
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    console.log("🟢 Updated task:", { id, newAssignee, displayName });

    res.json({
      status: "success",
      message: "อัปเดตงานสำเร็จ!",
      updated_assignee: newAssignee,
      display_name: displayName,
    });
  })
);

router.delete(
  "/tasks/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const username = req.user.username;
    const role = req.user.role;

    const { data: task, error: findErr } = await supabase
      .from("worktasks")
      .select("assignee")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !task)
      return res.status(404).json({ status: "error", message: "ไม่พบนงานนี้" });

    if (role !== "admin" && task.assignee !== username) {
      return res
        .status(403)
        .json({ status: "error", message: "ไม่มีสิทธิ์ลบงานของผู้อื่น" });
    }

    const { error } = await supabase.from("worktasks").delete().eq("id", id);
    if (error) throw error;

    res.json({ status: "success", message: "ลบงานสำเร็จ!" });
  })
);

export default router;
