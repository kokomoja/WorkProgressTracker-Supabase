// =======================
// ✅ app_user.js (FULL - Collapse Version)
// =======================

// ✅ ตรวจสอบสิทธิ์ + แสดงชื่อจริง (ฝั่งผู้ใช้งาน)

window.API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api";

(function initAuth() {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName") || "ไม่ระบุชื่อ";

  if (!role || !username) {
    location.href = "login.html";
    return;
  }

  if (role === "admin") {
    location.href = "admin.html";
    return;
  }

  const info = document.getElementById("userInfo");
  if (info) info.textContent = `👷 ${displayName || username}`;

  const logoutBtn = document.getElementById("logout");
  if (logoutBtn)
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      location.href = "login.html";
    });
})();

// ตรวจสิทธิ์ผู้ใช้

(function () {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  if (!role || !username) location.href = "login.html";
  if (role !== "user") location.href = "admin.html";
  document.getElementById("userInfo").textContent = `👷 ${username}`;
  document.getElementById("logout").addEventListener("click", () => {
    localStorage.clear();
    location.href = "login.html";
  });
})();

async function loadUserTasks() {
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");
  const res = await fetch(
    `${API_BASE}/tasks/by-user?username=${encodeURIComponent(username)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();

  // ✅ ใช้ตัวกรองก่อนแสดง
  const finalList = applySortFilterSearch(data);
  renderUserCards(finalList);
  initAutoResizeTextareas();
}

function getStatusClass(status) {
  switch (status) {
    case "ยังไม่เริ่ม":
      return "status-notstart";
    case "กำลังดำเนินการ":
      return "status-inprogress";
    case "เสร็จสิ้น":
      return "status-done";
    default:
      return "";
  }
}

// แสดงการ์ดงานแบบพับ/ขยาย
function renderUserCards(list) {
  const container = document.getElementById("taskList");
  if (!Array.isArray(list) || !list.length) {
    container.innerHTML = `<p align="center">ยังไม่มีข้อมูลงาน</p>`;
    return;
  }

  container.innerHTML = list
    .map(
      (t, i) => `
    <div class="task-card" data-id="${t.id}">
      <div class="task-header ${getStatusClass(t.status)}">
        <h3>${t.task_id} - ${t.task_name}</h3>
        <span>สถานะ: ${t.status} (${t.progress}%)</span>
      </div>



      <div class="task-body" id="body-${i}">
        <label>ความคืบหน้า (%)</label>
        <input type="number" min="0" max="100" value="${
          t.progress
        }" data-field="progress"/>

        <label>สถานะงาน</label>
        <select data-field="status">
          ${["ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น"]
            .map(
              (s) => `<option ${s === t.status ? "selected" : ""}>${s}</option>`
            )
            .join("")}
        </select>

        <label>หมายเหตุ</label>
        <textarea data-field="remark">${t.remark || ""}</textarea>

        <p><small>อัปเดตล่าสุด: ${t.last_update || "-"}</small></p>

        <div class="task-actions">
          <button class="btn-update">อัปเดต</button>
          <button class="btn-danger btn-del">ลบ</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  // 🎯 toggle collapse แบบเปิดได้ทีละการ์ด
  document.querySelectorAll(".task-header").forEach((header, index) => {
    header.addEventListener("click", () => {
      const currentBody = document.getElementById(`body-${index}`);
      const allBodies = document.querySelectorAll(".task-body");

      // ปิดทุกการ์ดก่อน
      allBodies.forEach((body) => {
        if (body !== currentBody) body.classList.remove("active");
      });

      // toggle เฉพาะการ์ดที่คลิก
      currentBody.classList.toggle("active");
    });
  });

  // ✅ ปุ่มอัปเดต
  container.querySelectorAll(".btn-update").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".task-card");
      const id = card.dataset.id;
      const token = localStorage.getItem("token");
      const body = card.querySelector(".task-body");
      const payload = {
        task_name:
          card.querySelector(".task-header h3").textContent.split(" - ")[1] ||
          "",
        progress: parseInt(
          body.querySelector('[data-field="progress"]').value || "0",
          10
        ),
        status: body.querySelector('[data-field="status"]').value,
        remark: body.querySelector('[data-field="remark"]').value,
        last_update: new Date().toLocaleString("th-TH"),
      };

      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.status === "success") {
        alert("✅ อัปเดตข้อมูลเรียบร้อยแล้ว");
      } else {
        alert("❌ อัปเดตไม่สำเร็จ: " + (result.message || ""));
      }

      await loadUserTasks();
    });
  });

  // 🗑️ ปุ่มลบ
  container.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".task-card");
      const id = card.dataset.id;
      if (!confirm("ยืนยันการลบงานนี้?")) return;
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadUserTasks(); // ✅ โหลดใหม่หลังลบ
    });
  });
}

// เพิ่มงานใหม่
document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName") || username; // ✅ เพิ่มบรรทัดนี้
  const token = localStorage.getItem("token");

  const payload = {
    task_id: document.getElementById("taskId").value.trim(),
    name: document.getElementById("taskName").value.trim(),
    assignee: username,
    assignee_display: displayName, // ✅ ส่งไป server
    startDate: document.getElementById("startDate").value || null,
    endDate: document.getElementById("endDate").value || null,
    progress: parseInt(document.getElementById("progress").value || "0", 10),
    status: document.getElementById("status").value,
    remark: document.getElementById("remark").value,
    lastUpdate: new Date().toLocaleString("th-TH"),
  };

  try {
    await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    e.target.reset();
    await loadUserTasks();
  } catch (err) {
    console.error("❌ เพิ่มงานไม่สำเร็จ:", err);
    alert("ไม่สามารถเชื่อมต่อ API ได้");
  }
});

// ✅ ผูก Event Re-render ทันทีเมื่อเปลี่ยน filter / sort / search
["sortSelect", "filterStatus", "searchBox"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", loadUserTasks);
    if (id === "searchBox") el.addEventListener("input", loadUserTasks);
  }
});

// =========================
// AUTO RESIZE TEXTAREA
// =========================
function initAutoResizeTextareas() {
  const textareas = document.querySelectorAll("textarea, textarea.remark");
  textareas.forEach((txt) => {
    autoResize(txt);
    txt.addEventListener("input", () => autoResize(txt));
  });
  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadUserTasks(); // โหลดงาน
  initAutoResizeTextareas(); // ✅ เพิ่มบรรทัดนี้
});

// =========================
// 🔍 ฟังก์ชัน Sort + Filter + Search
// =========================
function applySortFilterSearch(list) {
  const sortValue = document.getElementById("sortSelect")?.value || "latest";
  const filterValue = document.getElementById("filterStatus")?.value || "";
  const searchValue =
    document.getElementById("searchBox")?.value.trim().toLowerCase() || "";

  let filtered = [...list];

  if (filterValue) {
    filtered = filtered.filter((t) => t.status === filterValue);
  }

  if (searchValue) {
    filtered = filtered.filter(
      (t) =>
        (t.task_id && t.task_id.toLowerCase().includes(searchValue)) ||
        (t.task_name && t.task_name.toLowerCase().includes(searchValue))
    );
  }

  filtered.sort((a, b) => {
    switch (sortValue) {
      case "progress":
        return b.progress - a.progress;
      case "status":
        return a.status.localeCompare(b.status, "th");
      case "oldest":
        return new Date(a.last_update) - new Date(b.last_update);
      case "latest":
      default:
        return new Date(b.last_update) - new Date(a.last_update);
    }
  });

  return filtered;
}
