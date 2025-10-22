const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api";

(function initAuth() {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  if (!role || !username) location.href = "login.html";
  if (role !== "admin") location.href = "user.html";
  document.getElementById("logout").addEventListener("click", () => {
    localStorage.clear();
    location.href = "login.html";
  });
})();

const tokenHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

async function loadUsers(q = "") {
  const res = await fetch(`${API_BASE}/users?q=${encodeURIComponent(q)}`, {
    headers: tokenHeader(),
  });
  const users = await res.json();
  const tbody = document.getElementById("userTbody");
  tbody.innerHTML = "";
  (users || []).forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td>
      <td>
        <select data-username="${u.username}" class="roleSel">
          <option value="user" ${
            u.role === "user" ? "selected" : ""
          }>user</option>
          <option value="admin" ${
            u.role === "admin" ? "selected" : ""
          }>admin</option>
        </select>
      </td>
      <td class="row gap">
        <button class="btn xs ghost" data-act="saveRole">บันทึกสิทธิ์</button>
        <button class="btn xs danger" data-act="resetPass">รีเซ็ตรหัสผ่าน</button>
      </td>
    `;

    tr.querySelector('[data-act="saveRole"]').addEventListener(
      "click",
      async () => {
        const roleSel = tr.querySelector(".roleSel");
        const newRole = roleSel.value;
        await fetch(
          `${API_BASE}/users/${encodeURIComponent(u.username)}/role`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...tokenHeader() },
            body: JSON.stringify({ role: newRole }),
          }
        );
        alert("✅ อัปเดตสิทธิ์สำเร็จ");
      }
    );

    tr.querySelector('[data-act="resetPass"]').addEventListener(
      "click",
      async () => {
        const newPassword = prompt("รหัสผ่านใหม่:");
        const secret = prompt("ใส่ Secret ของระบบเพื่อยืนยัน:");
        if (!newPassword || !secret) return;
        const res = await fetch(`${API_BASE}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...tokenHeader() },
          body: JSON.stringify({ username: u.username, newPassword, secret }),
        });
        const data = await res.json();
        data.status === "success"
          ? alert("✅ รีเซ็ตสำเร็จ")
          : alert("❌ " + (data.message || "ล้มเหลว"));
      }
    );

    tbody.appendChild(tr);
  });
}

document
  .getElementById("refreshUsers")
  .addEventListener("click", () =>
    loadUsers(document.getElementById("uSearch").value.trim())
  );
document.getElementById("uSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadUsers(e.target.value.trim());
});

document.getElementById("sysForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    secret: document.getElementById("cfgSecret").value,
    statuses: document
      .getElementById("cfgStatuses")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  try {
    await fetch(`${API_BASE}/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...tokenHeader() },
      body: JSON.stringify(body),
    });
    alert("✅ บันทึกค่าตั้งต้นเรียบร้อย");
  } catch {
    alert("❌ บันทึกค่าตั้งต้นไม่สำเร็จ");
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  await loadUsers("");
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: tokenHeader(),
    });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.secret) document.getElementById("cfgSecret").value = cfg.secret;
      if (cfg.statuses)
        document.getElementById("cfgStatuses").value = cfg.statuses.join(",");
    }
  } catch (err) {
    console.error("❌ โหลดค่าตั้งต้นล้มเหลว:", err);
  }
});
