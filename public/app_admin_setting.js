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
  try {
    const res = await fetch(`${API_BASE}/users?q=${encodeURIComponent(q)}`, {
      headers: tokenHeader(),
    });
    const users = await res.json();

    const tbody = document.getElementById("userTbody");
    if (!tbody) return;

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
          const res = await fetch(
            `${API_BASE}/users/${encodeURIComponent(u.username)}/role`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...tokenHeader() },
              body: JSON.stringify({ role: newRole }),
            }
          );
          if (res.ok) alert("✅ อัปเดตสิทธิ์สำเร็จ");
        }
      );

      tbody.appendChild(tr);
    });

    const timeEl = document.getElementById("userUpdateTime");
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleString("th-TH");
    }
  } catch (err) {
    console.error("❌ loadUsers error:", err);
    alert("❌ โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  }
}

document.getElementById("sysForm")?.addEventListener("submit", async (e) => {
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
  await loadUsers();
});

document
  .getElementById("registerForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("✅ registerForm event triggered");
    const username = document.getElementById("regUsername").value.trim();
    const display_name = document.getElementById("regDisplay").value.trim();
    const password = document.getElementById("regPassword").value.trim();
    const role = document.getElementById("regRole").value;
    const secret = document.getElementById("regSecret").value.trim();

    if (!username || !password || !display_name || !secret)
      return alert("⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง");

    try {
      const res = await fetch(`${API_BASE}/admin-setting/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          display_name,
          role,
          secret,
        }),
      });

      const data = await res.json();

      if (data.status === "success") {
        alert("เพิมบัญชีผู้ใช้สำเร็จ!");
        e.target.reset();
        await loadUsers();
      } else {
        alert(" เพิ่มบัญชีผู้ใช้ไม่สำเร็จ : " + (data.message || ""));
      }
    } catch (err) {
      console.error("Register Error : ", err);
      alert("เกิดข้อผิดพลายระหว่างเพิ่มบัญชีผู้ใช้งาน");
    }
  });

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshUsers");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = "⏳ กำลังโหลด...";
      try {
        await loadUsers();
        alert("✅ โหลดรายชื่อผู้ใช้งานสำเร็จ!");
      } catch (err) {
        console.error("❌ โหลดรายชื่อผู้ใช้ล้มเหลว:", err);
        alert("❌ โหลดรายชื่อผู้ใช้งานไม่สำเร็จ");
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = "🔄 รีเฟรช";
      }
    });
  }
});

document.getElementById("forgotForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("forgotUsername").value.trim();
  const newPassword = document.getElementById("forgotPassword").value.trim();

  if (!username || !newPassword) {
    alert("⚠️ กรุณากรอกชื่อผู้ใช้และรหัสผ่านใหม่ให้ครบ");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin-setting/reset-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ username, newPassword }),
    });

    const data = await res.json();

    if (data.status === "success") {
      alert("✅ รีเซ็ตรหัสผ่านสำเร็จ!");
      e.target.reset();
    } else {
      alert("❌ ไม่สามารถรีเซ็ตรหัสผ่านได้: " + (data.message || ""));
    }
  } catch (err) {
    console.error("❌ Reset password error:", err);
    alert("เกิดข้อผิดพลาดระหว่างรีเซ็ตรหัสผ่าน");
  }
});
