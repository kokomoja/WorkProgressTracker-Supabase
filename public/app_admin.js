window.API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api";

(function initAuth() {
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  const displayName = localStorage.getItem("displayName");

  if (!role || !username) return (location.href = "login.html");
  if (role !== "admin") return (location.href = "user.html");

  const info = document.getElementById("adminInfo");
  if (info) info.textContent = `👑 ${displayName || username}`;

  document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.clear();
    location.href = "login.html";
  });
})();

let allTasks = [];
let viewTasks = [];
let chart;
let sortBy = "taskCode";
let sortDir = "asc";
let page = 1;
let pageSize = 10;

const tokenHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`, { headers: tokenHeader() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    allTasks = (data || []).map((t) => ({
      id: Number(t.id ?? t.task_id),
      taskCode: t.task_id ?? "",
      name: t.task_name ?? t.name ?? "",
      assignee: t.assignee || "",
      assignee_display: t.assignee_display || "",
      startDate: t.start_date ?? "",
      endDate: t.end_date ?? "",
      progress: Number(t.progress ?? 0),
      status: t.status ?? "ยังไม่เริ่ม",
      remark: t.remark ?? "",
      lastUpdate: t.last_update ?? "",
    }));

    console.log(`✅ โหลดข้อมูลงานสำเร็จ (${allTasks.length} รายการ)`);

    page = 1;
    applyFilterSort();
    renderAll();
  } catch (err) {
    console.error("❌ โหลดงานไม่สำเร็จ:", err);
    alert("❌ โหลดข้อมูลงานไม่สำเร็จ (ตรวจสอบเซิร์ฟเวอร์หรือ token)");
  }
}

async function loadUserList() {
  try {
    const res = await fetch(`${API_BASE}/users`, { headers: tokenHeader() });
    const users = await res.json();
    if (!Array.isArray(users)) return;

    const fillSelect = (el) => {
      if (!el) return;
      el.innerHTML = '<option value="">-- เลือกผู้รับผิดชอบ --</option>';
      users.forEach((u) => {
        el.insertAdjacentHTML(
          "beforeend",
          `<option value="${u.username}">${
            u.display_name || u.username
          }</option>`
        );
      });
    };

    fillSelect(document.getElementById("newAssignee"));
    fillSelect(document.getElementById("editAssignee"));

    console.log(`✅ โหลดรายชื่อผู้ใช้สำเร็จ (${users.length} คน)`);
  } catch (err) {
    console.error("❌ โหลดรายชื่อผู้ใช้ไม่สำเร็จ:", err);
  }
}

function renderAll() {
  renderKPIs();
  renderChart();
  renderTable(viewTasks);
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
  const ctx = document.getElementById("statusChart")?.getContext("2d");
  if (!ctx) return;

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

function renderTable(tasks) {
  const tbody = document.getElementById("taskTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-3">
          ❌ ไม่พบข้อมูลงานที่ตรงกับเงื่อนไขการกรอง
        </td>
      </tr>`;
    return;
  }
  let openRow = null;

  tasks.forEach((t) => {
    const statusColor =
      t.status === "เสร็จสิ้น"
        ? "text-success"
        : t.status === "กำลังดำเนินการ"
        ? "text-warning"
        : "text-secondary";

    const row = document.createElement("tr");
    row.classList.add("cursor-pointer", "fw-semibold");
    row.innerHTML = `
      <td class="text-center fw-semibold" style="width:130px">${t.taskCode}</td>
      <td>${t.name}</td>
      <td>${t.assignee_display || t.assignee}</td>
      <td class="text-center ${statusColor}" style="width:200px">${
      t.status
    }</td>
    `;

    const detailRow = document.createElement("tr");
    detailRow.classList.add("collapse-row");
    detailRow.style.display = "none";
    detailRow.innerHTML = `
      <td colspan="4" class="text-start">
        <p><strong>วันที่เริ่มต้น:</strong> ${t.startDate || "-"}</p>
        <p><strong>วันที่สิ้นสุด:</strong> ${t.endDate || "-"}</p>
        <p><strong>ความคืบหน้า:</strong> ${
          t.progress ? t.progress + "%" : "-"
        }</p>
        <p><strong>หมายเหตุ:</strong> ${t.remark || "-"}</p>
        <p><strong>อัปเดตล่าสุด:</strong> ${t.lastUpdate || "-"}</p>
        <div class="text-end mt-2">
          <button class="btn btn-sm btn-edit me-2" data-id="${
            t.id
          }">✏️ แก้ไข</button>
          <button class="btn btn-sm btn-danger" data-id="${t.id}">🗑️ ลบ</button>
        </div>
      </td>
    `;

    tbody.appendChild(row);
    tbody.appendChild(detailRow);

    row.addEventListener("click", () => {
      const isOpen = detailRow.style.display === "";
      if (openRow && openRow !== detailRow) openRow.style.display = "none";
      detailRow.style.display = isOpen ? "none" : "";
      openRow = isOpen ? null : detailRow;
    });
  });

  tbody.querySelectorAll(".btn-edit").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditById(btn.dataset.id);
    })
  );

  tbody.querySelectorAll(".btn-danger").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      delOne(btn.dataset.id);
    })
  );
}

function bindFilterBar() {
  const instantFilter = () => {
    page = 1;
    applyFilterSort();
    renderAll();
  };

  ["fTaskId", "fTaskName", "fAssignee"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", instantFilter);
  });

  const statusFilter = document.getElementById("fStatus");
  if (statusFilter) statusFilter.addEventListener("change", instantFilter);

  const refreshBtn = document.getElementById("refreshTasks");
  if (refreshBtn)
    refreshBtn.addEventListener("click", async () => {
      await loadTasks();
    });

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
const refreshBtn = document.getElementById("refreshTasks");
if (refreshBtn) {
  refreshBtn.addEventListener("click", async () => {
    await loadTasks();
    page = 1;
    applyFilterSort();
    renderAll();
  });
}

function applyFilterSort() {
  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  const qId = norm(document.getElementById("fTaskId")?.value);
  const qName = norm(document.getElementById("fTaskName")?.value);
  const qAssignee = norm(document.getElementById("fAssignee")?.value);
  const qStatus = document.getElementById("fStatus")?.value || "";

  viewTasks = allTasks.filter((t) => {
    const idCode = norm(t.taskCode) || norm(t.id);
    const name = norm(t.name);
    const userU = norm(t.assignee);
    const userD = norm(t.assignee_display);
    const status = t.status || "";

    if (qId && !idCode.includes(qId)) return false;
    if (qName && !name.includes(qName)) return false;
    if (qAssignee && !(userU.includes(qAssignee) || userD.includes(qAssignee)))
      return false;
    if (qStatus && status !== qStatus) return false;

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

function renderPager() {
  const total = viewTasks.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  if (page > maxPage) page = maxPage;
  document.getElementById("pageInfo").textContent = `หน้า ${page}/${maxPage}`;
}

async function openEdit(t) {
  const modalEl = document.getElementById("taskModal");
  if (!modalEl) {
    Swal.fire("❌", "ไม่พบ element #taskModal", "error");
    return;
  }

  const token = localStorage.getItem("token");
  const sel = document.getElementById("editAssignee");
  if (sel) {
    sel.innerHTML = '<option value="">-- เลือกผู้รับผิดชอบ --</option>';
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const users = await res.json();
      users.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = u.display_name || u.username;
        sel.appendChild(opt);
      });
      sel.value = t.assignee || "";
    } catch (err) {
      console.warn("⚠️ โหลดรายชื่อผู้ใช้ล้มเหลว:", err);
    }
  }

  document.getElementById("modalTitle").textContent = "✏️ แก้ไขงาน";
  document.getElementById("taskId").value = t.id;
  document.getElementById("taskName").value = t.name || "";
  document.getElementById("progress").value = t.progress || 0;
  document.getElementById("status").value = t.status || "ยังไม่เริ่ม";
  document.getElementById("remark").value = t.remark || "";
  document.getElementById("startDate").value = t.startDate
    ? new Date(t.startDate).toISOString().split("T")[0]
    : "";
  document.getElementById("endDate").value = t.endDate
    ? new Date(t.endDate).toISOString().split("T")[0]
    : "";

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

function openEditById(id) {
  const task = allTasks.find((t) => Number(t.id) === Number(id));
  if (!task) {
    Swal.fire("❌", "ไม่พบข้อมูลงานที่จะเปิดแก้ไข", "error");
    return;
  }
  openEdit(task);
}

async function delOne(id) {
  const task = allTasks.find((t) => Number(t.id) === Number(id));
  if (!task) {
    Swal.fire("❌", "ไม่พบข้อมูลงานที่จะลบ", "error");
    return;
  }

  const confirm = await Swal.fire({
    title: `ยืนยันการลบ?`,
    text: `คุณต้องการลบงาน "${task.name}" หรือไม่?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "ลบเลย",
    cancelButtonText: "ยกเลิก",
  });

  if (!confirm.isConfirmed) return;

  try {
    const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
      method: "DELETE",
      headers: tokenHeader(),
    });

    const data = await res.json();

    if (res.ok && data.status === "success") {
      Swal.fire("✅", "ลบงานสำเร็จ!", "success");
      await loadTasks();
    } else {
      Swal.fire("❌", data.message || "ลบงานไม่สำเร็จ", "error");
    }
  } catch (err) {
    console.error("❌ ลบงานไม่สำเร็จ:", err);
    Swal.fire("⚠️", "เกิดข้อผิดพลาดขณะลบงาน", "error");
  }
}

document
  .getElementById("addTaskForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    const body = {
      task_id: document.getElementById("newTaskCode").value.trim(),
      task_name: document.getElementById("newTaskName").value.trim(),
      assignee: document.getElementById("newAssignee").value,
      start_date: document.getElementById("newStartDate").value || null,
      end_date: document.getElementById("newEndDate").value || null,
      progress: Number(document.getElementById("newProgress").value || 0),
      status: document.getElementById("newStatus").value || "ยังไม่เริ่ม",
      remark: document.getElementById("newRemark").value.trim(),
    };

    if (!body.task_id || !body.task_name || !body.assignee) {
      return Swal.fire(
        "⚠️",
        "กรุณากรอกรหัสงาน ชื่อ และเลือกผู้รับผิดชอบ",
        "warning"
      );
    }

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        Swal.fire({
          icon: "success",
          title: "✅ เพิ่มงานสำเร็จ!",
          timer: 1000,
          showConfirmButton: false,
        });

        resetAddForm();
        toggleAddForm(false);
        await loadTasks();
      } else {
        Swal.fire("❌", data.message || "เพิ่มงานไม่สำเร็จ", "error");
      }
    } catch (err) {
      console.error("❌ เพิ่มงานล้มเหลว:", err);
      Swal.fire("❌", "ไม่สามารถเชื่อมต่อ API ได้", "error");
    }
  });

function toggleAddForm(show) {
  const addTaskCollapse = document.getElementById("addTaskCollapse");
  const btnAddTask = document.getElementById("btnAddTask");
  if (!addTaskCollapse || !btnAddTask) return;
  addTaskCollapse.style.display = show ? "block" : "none";
  btnAddTask.textContent = show ? "⬆️ ซ่อนฟอร์มเพิ่มงาน" : "➕ เพิ่มงานใหม่";
}

function resetAddForm() {
  const ids = [
    "newTaskCode",
    "newTaskName",
    "newAssignee",
    "newStartDate",
    "newEndDate",
    "newProgress",
    "newRemark",
    "newStatus",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "newProgress") el.value = 0;
    else if (id === "newStatus") el.value = "ยังไม่เริ่ม";
    else el.value = "";
  });
}

document
  .getElementById("editTaskForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("taskId").value;
    const username = document.getElementById("editAssignee").value;
    const token = localStorage.getItem("token");

    if (!username) {
      return Swal.fire("⚠️", "กรุณาเลือกผู้รับผิดชอบ", "warning");
    }

    const body = {
      task_name: document.getElementById("taskName").value.trim(),
      assignee: username,
      start_date: document.getElementById("startDate").value || null,
      end_date: document.getElementById("endDate").value || null,
      progress: Number(document.getElementById("progress").value || 0),
      status: document.getElementById("status").value,
      remark: document.getElementById("remark").value.trim(),
      last_update: new Date().toLocaleString("th-TH"),
    };

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.status === "success") {
        Swal.fire({
          icon: "success",
          title: "✅ แก้ไขงานสำเร็จ!",
          timer: 1000,
          showConfirmButton: false,
        });

        const modalEl = document.getElementById("taskModal");
        bootstrap.Modal.getInstance(modalEl).hide();

        document.activeElement?.blur();

        await loadTasks();
      } else {
        Swal.fire("❌", data.message || "อัปเดตไม่สำเร็จ", "error");
      }
    } catch (err) {
      console.error("❌ อัปเดตล้มเหลว:", err);
      Swal.fire("❌", "ไม่สามารถเชื่อมต่อ API ได้", "error");
    }
  });

document.addEventListener("DOMContentLoaded", () => {
  const btnAddTask = document.getElementById("btnAddTask");
  const addTaskCollapse = document.getElementById("addTaskCollapse");
  const btnCancelAdd = document.getElementById("btnCancelAdd");

  function resetAddForm() {
    const ids = [
      "newTaskCode",
      "newTaskName",
      "newAssignee",
      "newStartDate",
      "newEndDate",
      "newProgress",
      "newStatus",
      "newRemark",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === "newProgress") el.value = 0;
      else if (id === "newStatus") el.value = "ยังไม่เริ่ม";
      else el.value = "";
    });
  }

  function toggleAddForm(show) {
    if (!addTaskCollapse || !btnAddTask) return;
    addTaskCollapse.style.display = show ? "block" : "none";
    btnAddTask.textContent = show ? "⬆️ ซ่อนฟอร์มเพิ่มงาน" : "➕ เพิ่มงานใหม่";
  }

  if (btnAddTask && !btnAddTask.dataset.bound) {
    btnAddTask.dataset.bound = "true";
    toggleAddForm(false);

    btnAddTask.addEventListener("click", () => {
      const isOpen = addTaskCollapse?.style.display === "block";
      toggleAddForm(!isOpen);
      if (!isOpen) resetAddForm();
    });
  }

  if (btnCancelAdd && !btnCancelAdd.dataset.bound) {
    btnCancelAdd.dataset.bound = "true";
    btnCancelAdd.addEventListener("click", () => {
      resetAddForm();
      toggleAddForm(false);
    });
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  bindFilterBar();
  await loadUserList();
  await loadTasks();

  const btnToggleFilter = document.getElementById("btnToggleFilter");
  const filterCollapse = document.getElementById("filterCollapse");
  if (btnToggleFilter && filterCollapse) {
    const bsCollapse = new bootstrap.Collapse(filterCollapse, {
      toggle: false,
    });
    btnToggleFilter.addEventListener("click", () => {
      const showing = filterCollapse.classList.contains("show");
      showing ? bsCollapse.hide() : bsCollapse.show();
      btnToggleFilter.textContent = showing
        ? "🔽 แสดงตัวกรอง"
        : "🔼 ซ่อนตัวกรอง";
    });
  }
});
