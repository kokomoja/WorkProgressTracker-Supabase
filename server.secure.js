/**
 * Hardened Express server template that reads secrets from .env
 * - Use this as a reference to update your existing server.js
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sql = require('mssql');

// ---- Required ENV ----
const {
  DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME,
  JWT_SECRET, CONFIRM_SECRET, ALLOWED_ORIGINS, PORT
} = process.env;

if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_NAME) {
  console.error("❌ Missing DB env. Please fill .env from .env.example");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("❌ Missing JWT_SECRET in .env");
  process.exit(1);
}

// ---- DB Config ----
const dbConfig = {
  user: DB_USER,
  password: DB_PASSWORD,
  server: DB_HOST,
  port: parseInt(DB_PORT || "1433", 10),
  database: DB_NAME,
  options: { encrypt: false, trustServerCertificate: true },
  authentication: { type: "default" },
};

// ---- App Setup ----
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

const origins = (ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true); // allow same-origin / curl
    if (origins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// Basic rate limit
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ---- Helpers ----
function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30m" });
}

function authRequired(req, res, next) {
  const token = req.cookies?.access_token || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---- Demo: Register/Login with bcrypt ----
// Replace table/column names to match your schema.
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username & password required" });
  try {
    const pool = await sql.connect(dbConfig);
    const hash = await bcrypt.hash(password, 12);
    await pool.request()
      .input('username', sql.NVarChar(255), username)
      .input('password_hash', sql.NVarChar(255), hash)
      .query('INSERT INTO users (username, password_hash) VALUES (@username, @password_hash)');
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "register failed" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username & password required" });
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('username', sql.NVarChar(255), username)
      .query('SELECT TOP 1 id, username, password_hash FROM users WHERE username = @username');
    const user = result.recordset?.[0];
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signAccessToken({ sub: user.id, username: user.username });
    // HttpOnly cookie; set Secure when behind HTTPS
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true, // set true in production (HTTPS)
      maxAge: 30 * 60 * 1000
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "login failed" });
  }
});

// Protected sample route
app.get('/api/me', authRequired, (req, res) => {
  return res.json({ user: req.user });
});

// ---- Start ----
const listenPort = parseInt(PORT || "5000", 10);
app.listen(listenPort, () => console.log(`✅ Secure server listening on ${listenPort}`));
