const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(bodyParser.json());

require("dotenv").config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true },
};

const CONFIRM_SECRET = process.env.CONFIRM_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
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

app.post("/api/register", async (req, res) => {
  const { username, password, display_name, role, secret } = req.body;

  if (secret !== CONFIRM_SECRET)
    return res
      .status(403)
      .json({ status: "error", message: "รหัสยืนยันการสมัครไม่ถูกต้อง" });

  try {
    const pool = await sql.connect(config);

    const dup = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .query("SELECT 1 FROM Users WHERE username=@username");
    if (dup.recordset.length)
      return res
        .status(400)
        .json({ status: "error", message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });

    const roleFinal = role === "admin" ? "admin" : "user";
    await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("password", sql.NVarChar, password)
      .input("display_name", sql.NVarChar, display_name || username)
      .input("role", sql.NVarChar, roleFinal)
      .query(
        "INSERT INTO Users (username, password, display_name, role) VALUES (@username,@password,@display_name,@role)"
      );

    res.json({
      status: "success",
      message: "สมัครสมาชิกสำเร็จ!",
      role: roleFinal,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await sql.connect(config);
    const r = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .query("SELECT * FROM Users WHERE username=@username");

    if (!r.recordset.length)
      return res
        .status(401)
        .json({ status: "error", message: "ไม่พบชื่อผู้ใช้" });

    const user = r.recordset[0];
    if (user.password !== password)
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
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/tasks", verifyToken, async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        t.id,
        t.task_id,
        t.task_name,
        t.assignee,                             
        u.display_name AS assignee_display,     
        t.start_date,
        t.end_date,
        t.progress,
        t.status,
        t.remark,
        t.last_update
      FROM WorkTasks AS t
      LEFT JOIN Users AS u ON t.assignee = u.username
      ORDER BY t.id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ โหลดข้อมูลงานไม่สำเร็จ:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/tasks", verifyToken, async (req, res) => {
  const t = req.body;
  try {
    const pool = await sql.connect(config);
    await pool
      .request()
      .input("task_id", sql.NVarChar, t.task_id)
      .input("task_name", sql.NVarChar, t.name)
      .input("assignee", sql.NVarChar, t.assignee)
      .input("assignee_display", sql.NVarChar, t.assignee_display)
      .input("start_date", sql.Date, t.startDate || null)
      .input("end_date", sql.Date, t.endDate || null)
      .input("progress", sql.Int, t.progress)
      .input("status", sql.NVarChar, t.status)
      .input("remark", sql.NVarChar, t.remark)
      .input("last_update", sql.NVarChar, t.lastUpdate).query(`
        INSERT INTO WorkTasks
          (task_id, task_name, assignee, assignee_display, start_date, end_date, progress, status, remark, last_update)
        VALUES
          (@task_id, @task_name, @assignee, @assignee_display, @start_date, @end_date, @progress, @status, @remark, @last_update)
      `);

    res.json({ status: "success", message: "เพิ่มงานสำเร็จ" });
  } catch (err) {
    console.error("❌ Insert WorkTasks error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.put("/api/tasks/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const t = req.body;

  try {
    const pool = await sql.connect(config);

    const oldData = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM WorkTasks WHERE id=@id");

    if (!oldData.recordset.length)
      return res
        .status(404)
        .json({ status: "error", message: "ไม่พบข้อมูลงาน" });

    const prev = oldData.recordset[0];
    const task_name =
      t.task_name !== null && t.task_name !== undefined && t.task_name !== ""
        ? t.task_name
        : prev.task_name;

    const progress =
      t.progress !== null && t.progress !== undefined
        ? t.progress
        : prev.progress;

    const status =
      t.status !== null && t.status !== undefined && t.status !== ""
        ? t.status
        : prev.status;

    const remark =
      t.remark !== null && t.remark !== undefined ? t.remark : prev.remark;

    const last_update =
      t.last_update !== null &&
      t.last_update !== undefined &&
      t.last_update !== ""
        ? t.last_update
        : prev.last_update;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("task_name", sql.NVarChar, task_name)
      .input("progress", sql.Int, progress)
      .input("status", sql.NVarChar, status)
      .input("remark", sql.NVarChar, remark)
      .input("last_update", sql.NVarChar, last_update).query(`
        UPDATE WorkTasks SET
          task_name=@task_name,
          progress=@progress,
          status=@status,
          remark=@remark,
          last_update=@last_update
        WHERE id=@id
      `);

    res.json({ status: "success", message: "อัปเดตงานสำเร็จ" });
  } catch (err) {
    console.error("❌ Error updating task:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.delete("/api/tasks/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql.connect(config);
    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM WorkTasks WHERE id=@id");
    res.json({ status: "success", message: "ลบงานสำเร็จ" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const CONFIG_PATH = path.join(__dirname, "config.json");

let sysConfig = {};
if (fs.existsSync(CONFIG_PATH)) {
  sysConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} else {
  sysConfig = {
    secret: "0845535000721",
    statuses: ["ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น"],
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(sysConfig, null, 2));
}

function requireAdmin(req, res, next) {
  try {
    if (req.user && req.user.role === "admin") return next();
    res.status(403).json({ error: "Forbidden" });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/tasks/by-user", verifyToken, async (req, res) => {
  const username = req.query.username;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("assignee", sql.NVarChar, username).query(`
        SELECT * FROM WorkTasks
        WHERE assignee = @assignee
        ORDER BY id DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error in /api/tasks/by-user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/users", requireAdmin, async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase() || "";
    const users = await db.all(`SELECT username, role FROM users`);
    const filtered = users.filter((u) => u.username.toLowerCase().includes(q));
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "load users failed" });
  }
});

app.put("/api/users/:username/role", requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const { role } = req.body;
    await db.run(`UPDATE users SET role=? WHERE username=?`, [role, username]);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: "update role failed" });
  }
});

app.post("/api/reset-password", requireAdmin, async (req, res) => {
  const { username, newPassword, secret } = req.body;
  if (secret !== sysConfig.secret) {
    return res.json({ status: "fail", message: "Secret ไม่ถูกต้อง" });
  }
  const bcrypt = require("bcrypt");
  const hash = await bcrypt.hash(newPassword, 10);
  await db.run(`UPDATE users SET password=? WHERE username=?`, [
    hash,
    username,
  ]);
  res.json({ status: "success" });
});

app.get("/api/admin/settings", requireAdmin, (req, res) => {
  res.json(sysConfig);
});

app.put("/api/admin/settings", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ status: "error" });
  fs.writeFileSync("./config.json", JSON.stringify(req.body, null, 2));
  res.json({ status: "success" });
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`✅ Server ready on http://localhost:${PORT}`)
);
