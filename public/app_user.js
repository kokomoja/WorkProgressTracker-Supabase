window.API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api";

window.addEventListener("DOMContentLoaded", () => {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  const displayName =
    localStorage.getItem("displayName") || username || "ไม่ระบุชื่อ";

  if (!role || !username) {
    location.href = "login.html";
    return;
  }

  if (role === "admin") {
    location.href = "admin.html";
    return;
  }

  const info = document.getElementById("userInfo");
  if (info) info.textContent = `👷 ${displayName}`;

  // ปุ่มออกจากระบบ
  const logoutBtn = document.getElementById("logout");
  if (logoutBtn)
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      location.href = "login.html";
    });

  // โหลดข้อมูลงานหลังจากตั้งชื่อแล้ว
  loadUserTasks();
});

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

  document.querySelectorAll(".task-header").forEach((header, index) => {
    header.addEventListener("click", () => {
      const currentBody = document.getElementById(`body-${index}`);
      const allBodies = document.querySelectorAll(".task-body");

      allBodies.forEach((body) => {
        if (body !== currentBody) body.classList.remove("active");
      });

      currentBody.classList.toggle("active");
    });
  });

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
      await loadUserTasks();
    });
  });
}

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName") || username;
  const token = localStorage.getItem("token");

  const payload = {
    task_id: document.getElementById("taskId").value,
    task_name: document.getElementById("taskName").value,
    assignee: username,
    assignee_display: displayName, // ✅ เพิ่มชื่อแสดง
    startDate: document.getElementById("startDate").value || null,
    endDate: document.getElementById("endDate").value || null,
    progress: parseInt(document.getElementById("progress").value || "0", 10),
    status: document.getElementById("status").value,
    remark: document.getElementById("remark").value,
    last_update: new Date().toLocaleString("th-TH"), // ✅ timestamp
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

["sortSelect", "filterStatus", "searchBox"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", loadUserTasks);
    if (id === "searchBox") el.addEventListener("input", loadUserTasks);
  }
});

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
