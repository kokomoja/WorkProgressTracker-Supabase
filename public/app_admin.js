window.API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api";

(function initAuth() {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName");

  if (!role || !username) {
    location.href = "login.html";
    return;
  }

  if (role !== "admin") {
    location.href = "user.html";
    return;
  }

  const info = document.getElementById("adminInfo");
  if (info) info.textContent = `👑 ${displayName || username}`;

  const logoutBtn = document.getElementById("logout");
  if (logoutBtn)
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      location.href = "login.html";
    });
})();

let allTasks = [];
let viewTasks = [];
let chart;
let sortBy = "id";
let sortDir = "asc";
let page = 1;
let pageSize = 10;
let selectedIds = new Set();

const fmt = {
  date: (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d)) return s;
    const year = d.getFullYear() + 543;
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  },
  pct: (n) => `${Number(n || 0)}%`,
};

const toThaiNow = () => new Date().toLocaleString("th-TH");

function tokenHeader() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}
async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`, { headers: tokenHeader() });
    const data = await res.json();
    allTasks = (data || []).map((t) => ({
      id: Number(t.id), // แปลงเป็น number ไว้เปรียบเทียบได้
      taskCode: t.task_id ?? "", // ✅ ใช้สำหรับแสดงและหา task_id
      name: t.task_name ?? t.name,
      assignee: t.assignee_display || t.assignee || "",
      startDate: t.start_date ?? "",
      endDate: t.end_date ?? "",
      progress: Number(t.progress ?? 0),
      status: t.status ?? "ยังไม่เริ่ม",
      remark: t.remark ?? "",
      lastUpdate: t.last_update ?? "",
    }));

    page = 1;
    applyFilterSort();
    renderAll();
  } catch (err) {
    console.error("โหลดงานไม่สำเร็จ:", err);
    alert("❌ โหลดข้อมูลงานไม่สำเร็จ");
  }
}

async function loadUserList() {
  try {
    const res = await fetch(`${API_BASE}/users`, { headers: tokenHeader() });
    const data = await res.json();

    // 🧩 1. สำหรับฟอร์มเพิ่มงาน
    const addSelect = document.getElementById("newAssignee");
    if (addSelect) {
      addSelect.innerHTML = '<option value="">-- เลือกผู้รับผิดชอบ --</option>';
      data.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = u.display_name || u.username;
        addSelect.appendChild(opt);
      });
    }

    // 🧩 2. สำหรับ modal แก้ไขงาน
    const editSelect = document.getElementById("editAssignee");
    if (editSelect) {
      editSelect.innerHTML =
        '<option value="">-- เลือกผู้รับผิดชอบ --</option>';
      data.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = u.display_name || u.username;
        editSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("❌ โหลดรายชื่อผู้ใช้ไม่สำเร็จ:", err);
  }
}

function renderAll() {
  renderKPIs();
  renderChart();
  renderTable();
  renderPager();
}

function renderKPIs() {
  const todo = allTasks.filter((t) => t.status === "ยังไม่เริ่ม").length;
  const doing = allTasks.filter((t) => t.status === "กำลังดำเนินการ").length;
  const done = allTasks.filter((t) => t.status === "เสร็จสิ้น").length;
  document.getElementById("kpiTodo").textContent = todo;
  document.getElementById("kpiDoing").textContent = doing;
  document.getElementById("kpiDone").textContent = done;
}

function renderChart() {
  const ctx = document.getElementById("statusChart").getContext("2d");
  const summary = {
    ยังไม่เริ่ม: allTasks.filter((t) => t.status === "ยังไม่เริ่ม").length,
    กำลังดำเนินการ: allTasks.filter((t) => t.status === "กำลังดำเนินการ")
      .length,
    เสร็จสิ้น: allTasks.filter((t) => t.status === "เสร็จสิ้น").length,
  };
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(summary),
      datasets: [
        {
          data: Object.values(summary),
          backgroundColor: ["#f4c542", "#0078d4", "#00b050"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "สรุปสถานะงานทั้งหมด" },
      },
    },
  });
}

function renderTable() {
  const tbody = document.getElementById("taskTbody");
  tbody.innerHTML = "";
  const startIdx = (page - 1) * pageSize;
  const rows = viewTasks.slice(startIdx, startIdx + pageSize);

  rows.forEach((t) => {
    const tr = document.createElement("tr");
    const tdSel = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = selectedIds.has(t.id);
    chk.addEventListener("change", () => {
      chk.checked ? selectedIds.add(t.id) : selectedIds.delete(t.id);
      document.getElementById("chkAll").checked = isPageAllChecked();
    });
    tdSel.appendChild(chk);
    tr.appendChild(tdSel);

    const taskCode = t.taskCode || t.task_id || `#${t.id}`;

    tr.innerHTML += `
      <td>${escapeHtml(taskCode)}</td>
      <td>${escapeHtml(t.name ?? "")}</td>
      <td>${escapeHtml(t.assignee ?? "")}</td>
      <td>${fmt.date(t.startDate)}</td>
      <td>${fmt.date(t.endDate)}</td>
      <td>
        <div class="progress-bar">
          <span style="width:${t.progress}%"></span>
        </div>
        <small>${fmt.pct(t.progress)}</small>
      </td>
      <td>${escapeHtml(t.status ?? "")}</td>
      <td>${escapeHtml(t.remark ?? "")}</td>
      <td>${fmt.date(t.lastUpdate)}</td>
      <td class="action-cell">
        <button class="btn btn-save" data-act="edit">แก้ไข</button>
        <button class="btn btn-danger" data-act="del">ลบ</button>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('[data-act="edit"]').addEventListener("click", () =>
      openEdit(t)
    );
    tr.querySelector('[data-act="del"]').addEventListener("click", () =>
      delOne(t.id)
    );
  });

  document.getElementById("chkAll").checked = isPageAllChecked();
}

function renderPager() {
  const total = viewTasks.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  if (page > maxPage) page = maxPage;
  document.getElementById("pageInfo").textContent = `หน้า ${page}/${maxPage}`;
}

function applyFilterSort() {
  const statusEl = document.getElementById("fStatus");
  const fStatus = statusEl ? statusEl.value : "";
  viewTasks = allTasks.filter((t) => {
    if (fStatus && t.status !== fStatus) return false;
    return true;
  });

  viewTasks.sort((a, b) => {
    const A = a[sortBy] ?? "";
    const B = b[sortBy] ?? "";
    if (A < B) return sortDir === "asc" ? -1 : 1;
    if (A > B) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function bindFilterBar() {
  // 🧩 ให้ข้อมูลเปลี่ยนทันทีเมื่อพิมพ์ หรือเปลี่ยนค่าช่องกรอง
  const instantFilter = () => {
    page = 1;
    applyFilterSort();
    renderAll();
  };

  const searchBox = document.getElementById("q");
  if (searchBox) {
    let typingTimer;
    searchBox.addEventListener("input", () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(instantFilter, 300);
    });
  }

  // ช่องกรองผู้รับผิดชอบ
  const assigneeFilter = document.getElementById("fAssignee");
  if (assigneeFilter) {
    assigneeFilter.addEventListener("input", instantFilter);
  }

  // ช่องกรองสถานะ
  const statusFilter = document.getElementById("fStatus");
  if (statusFilter) {
    statusFilter.addEventListener("change", instantFilter);
  }

  // ✅ การเปลี่ยน pageSize (ต่อหน้า)
  const pageSizeSelect = document.getElementById("pageSize");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      pageSize = Number(pageSizeSelect.value || 10);
      page = 1;
      renderAll();
    });
  }

  // ✅ ปุ่มเปลี่ยนหน้า (ยังคงไว้)
  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (page > 1) {
      page--;
      renderAll();
    }
  });

  document.getElementById("nextPage")?.addEventListener("click", () => {
    const maxPage = Math.max(1, Math.ceil(viewTasks.length / pageSize));
    if (page < maxPage) {
      page++;
      renderAll();
    }
  });

  // ✅ sort column header (ยังคงไว้เหมือนเดิม)
  document.querySelectorAll("#taskTable thead th[data-sort]").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      sortDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
      sortBy = key;
      applyFilterSort();
      renderAll();
    });
  });
}

function openEdit(t) {
  try {
    const modal = document.getElementById("taskModal");
    if (!modal) throw new Error("❌ ไม่พบ element #taskModal");

    document.getElementById("modalTitle").textContent = "✏️ แก้ไขงาน";
    document.getElementById("taskId").value = t.id ?? "";
    document.getElementById("taskName").value = t.name ?? t.task_name ?? "";
    const assigneeSelect = document.getElementById("editAssignee");
    if (assigneeSelect) assigneeSelect.value = t.assignee || "";
    document.getElementById("startDate").value =
      t.startDate ?? t.start_date ?? "";
    document.getElementById("endDate").value = t.endDate ?? t.end_date ?? "";
    document.getElementById("progress").value = t.progress ?? 0;
    document.getElementById("status").value = t.status ?? "ยังไม่เริ่ม";
    document.getElementById("remark").value = t.remark ?? "";

    if (modal.showModal) modal.showModal();
    else modal.style.display = "block";

    const startDateEl = document.getElementById("startDate");
    const endDateEl = document.getElementById("endDate");
    if (startDateEl && endDateEl) {
      startDateEl.disabled = false;
      endDateEl.disabled = false;
    }
  } catch (err) {
    console.error("❌ openEdit error:", err);
    alert(
      "ไม่สามารถเปิดหน้าต่างแก้ไขงานได้ กรุณาตรวจสอบ element ID ให้ตรงกับฟอร์ม"
    );
  }
}

// ปุ่มยกเลิก
document.getElementById("btnCancel")?.addEventListener("click", () => {
  const modal = document.getElementById("taskModal");
  if (modal?.close) modal.close();
  else modal.style.display = "none";
});

async function addTask(payload) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tokenHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function updateTask(id, payload) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...tokenHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function deleteTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "DELETE",
    headers: tokenHeader(),
  });
  return res.json();
}

document.getElementById("taskForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const assigneeSelect = document.getElementById("editAssignee");
  const assigneeDisplay =
    assigneeSelect.options[assigneeSelect.selectedIndex]?.textContent?.trim() ||
    assigneeSelect.value.trim();

  const payload = {
    id: document.getElementById("taskId").value || undefined,
    name: document.getElementById("taskName").value.trim(),
    assignee: assigneeDisplay,
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
    progress: Number(document.getElementById("progress").value || 0),
    status: document.getElementById("status").value,
    remark: document.getElementById("remark").value.trim(),
    last_update: new Date().toLocaleString("th-TH"),
  };
  if (!payload.name || !payload.assignee) {
    alert("กรอก 'รายละเอียดงาน' และ 'ผู้รับผิดชอบ' ให้ครบ");
    return;
  }

  try {
    const method = payload.id ? "PUT" : "POST";
    const url = payload.id
      ? `${API_BASE}/tasks/${encodeURIComponent(payload.id)}`
      : `${API_BASE}/tasks`;

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...tokenHeader() },
      body: JSON.stringify(payload),
    });

    const modal = document.getElementById("taskModal");
    if (modal?.close) modal.close();
    else modal.style.display = "none";
    await loadTasks();
  } catch (err) {
    console.error("บันทึกงานล้มเหลว:", err);
    alert("❌ ไม่สามารถเชื่อมต่อ API ได้");
  }
});
// ✅ คลิกนอก modal เพื่อปิด
window.addEventListener("click", (event) => {
  const modal = document.getElementById("taskModal");
  if (modal && event.target === modal) {
    if (modal.close) modal.close();
    else modal.style.display = "none";
  }
});

async function delOne(id) {
  try {
    const task = allTasks.find((t) => Number(t.id) === Number(id));
    const taskCode = task?.taskCode || "(ไม่ทราบรหัส)";
    const taskName = task?.name || "";

    if (
      !confirm(`ยืนยันลบงานรหัส ${taskCode}${taskName ? `: ${taskName}` : ""}?`)
    )
      return;

    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: tokenHeader(),
    });

    const result = await res.json();

    alert(result.message || `ลบงานรหัส ${taskCode} สำเร็จ`);
    await loadTasks();
  } catch (err) {
    console.error("❌ ลบงานไม่สำเร็จ:", err);
    alert("❌ ลบงานไม่สำเร็จ");
  }
}

async function delBulk() {
  if (selectedIds.size === 0) return alert("ยังไม่ได้เลือกรายการ");
  if (!confirm(`ยืนยันลบ ${selectedIds.size} งานที่เลือก?`)) return;
  try {
    for (const id of selectedIds) {
      await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: tokenHeader(),
      });
    }
    selectedIds.clear();
    await loadTasks();
  } catch (err) {
    console.error("ลบแบบชุดไม่สำเร็จ:", err);
    alert("❌ ลบแบบชุดไม่สำเร็จ");
  }
}

function exportCSV() {
  const cols = [
    "id",
    "name",
    "assignee",
    "startDate",
    "endDate",
    "progress",
    "status",
    "remark",
    "lastUpdate",
  ];
  const rows = [cols.join(",")].concat(
    viewTasks.map((t) => cols.map((k) => csvCell(t[k])).join(","))
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tasks_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
function csvCell(v) {
  const s = (v ?? "").toString().replaceAll('"', '""');
  return `"${s}"`;
}

function escapeHtml(s) {
  return (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}
function isPageAllChecked() {
  const startIdx = (page - 1) * pageSize;
  const rows = viewTasks.slice(startIdx, startIdx + pageSize);
  return rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
}

const collapseEl = document.getElementById("addTaskCollapse");
const btnAddTask = document.getElementById("btnAddTask");
const btnCancelAdd = document.getElementById("btnCancelAdd");

if (btnAddTask && collapseEl) {
  btnAddTask.addEventListener("click", () => {
    collapseEl.style.display =
      collapseEl.style.display === "none" ? "block" : "none";
    if (collapseEl.style.display === "block") {
      btnAddTask.textContent = "⬆️ ซ่อนฟอร์มเพิ่มงาน";
    } else {
      btnAddTask.textContent = "➕ เพิ่มงานใหม่";
    }
  });
}

if (btnCancelAdd) {
  btnCancelAdd.addEventListener("click", () => {
    collapseEl.style.display = "none";
    btnAddTask.textContent = "➕ เพิ่มงานใหม่";
    clearAddForm();
  });
}

function clearAddForm() {
  [
    "newTaskCode",
    "newTaskName",
    "newAssignee",
    "newStartDate",
    "newEndDate",
    "newProgress",
    "newRemark",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = id === "newProgress" ? 0 : "";
  });
  document.getElementById("newStatus").value = "ยังไม่เริ่ม";
}

document
  .getElementById("addTaskForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      task_id: document.getElementById("newTaskCode").value.trim(),
      name: document.getElementById("newTaskName").value.trim(),
      assignee: document.getElementById("newAssignee").value.trim(),
      startDate: document.getElementById("newStartDate").value,
      endDate: document.getElementById("newEndDate").value,
      progress: Number(document.getElementById("newProgress").value || 0),
      status: document.getElementById("newStatus").value,
      remark: document.getElementById("newRemark").value.trim(),
      last_update: new Date().toLocaleString("th-TH"),
    };

    if (!payload.task_id || !payload.name || !payload.assignee)
      return alert("กรุณากรอกรหัสงาน ชื่อ และผู้รับผิดชอบให้ครบ");

    try {
      await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeader() },
        body: JSON.stringify(payload),
      });
      collapseEl.style.display = "none";
      btnAddTask.textContent = "➕ เพิ่มงานใหม่";
      await loadTasks();
      clearAddForm();
    } catch (err) {
      console.error("เพิ่มงานใหม่ไม่สำเร็จ:", err);
      alert("❌ ไม่สามารถเชื่อมต่อ API ได้");
    }
  });

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

window.addEventListener("DOMContentLoaded", async () => {
  bindFilterBar();
  await loadUserList();
  await loadTasks();
  document.querySelectorAll("textarea, textarea.remark").forEach((t) => {
    autoResize(t);
    t.addEventListener("input", () => autoResize(t));
  });
});
