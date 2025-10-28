const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api";

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

  document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.clear();
    location.href = "login.html";
  });

  loadUserTasks();
});

async function loadUserTasks() {
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/tasks/by-user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    console.log("✅ งานที่โหลดได้:", data);
    renderUserTable(data);
  } catch (err) {
    console.error("❌ โหลดข้อมูลงานล้มเหลว:", err);
  }
}

function renderUserTable(list) {
  const tbody = document.querySelector("#userTable tbody");
  tbody.innerHTML = "";

  if (!Array.isArray(list) || !list.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">ยังไม่มีข้อมูลงาน</td></tr>`;
    return;
  }

  list.forEach((t) => appendTaskRow(t));
}
function appendTaskRow(task) {
  const tbody = document.querySelector("#userTable tbody");

  const statusClass =
    task.status === "เสร็จสิ้น"
      ? "text-success"
      : task.status === "กำลังดำเนินการ"
      ? "text-warning"
      : "text-muted";

  const progress = task.progress ?? 0;
  const startDate = task.start_date || "-";
  const endDate = task.end_date || "-";
  const remark = task.remark || "-";
  const assignee = task.assignee_display || task.assignee || "-";
  const lastUpdate = task.last_update || "-";

  const mainRow = document.createElement("tr");
  mainRow.className = "align-middle border-bottom fw-semibold cursor-pointer";
  mainRow.dataset.id = task.id;
  mainRow.innerHTML = `
    <td style="width: 15%;">${task.task_id || "-"}</td>
    <td style="width: 55%;">${task.task_name || "-"}</td>
    <td class="${statusClass}" style="width: 30%; text-align: center;">
      ${task.status || "ยังไม่เริ่ม"}
    </td>
  `;

  const detailRow = document.createElement("tr");
  detailRow.className = "collapse-row";
  detailRow.style.display = "none";
  detailRow.innerHTML = `
    <td colspan="3">
      <div class="p-3 border rounded bg-light">
        <p><strong>ผู้รับผิดชอบ:</strong> ${assignee}</p>
        <p><strong>วันที่เริ่ม:</strong> ${startDate} | <strong>สิ้นสุด:</strong> ${endDate}</p>
        <p><strong>ความคืบหน้า:</strong> ${progress}%</p>
        <p><strong>หมายเหตุ:</strong> ${remark}</p>
        <p><strong>อัปเดตล่าสุด:</strong> ${lastUpdate}</p>
        <div class="text-end mt-2">
          <button class="btn btn-sm btn-outline-warning btn-edit">✏️ แก้ไข</button>
          <button class="btn btn-sm btn-outline-danger btn-del">🗑️ ลบ</button>
        </div>
      </div>
    </td>
  `;

  mainRow.addEventListener("click", () => {
    const allDetailRows = document.querySelectorAll(".collapse-row");
    allDetailRows.forEach((r) => {
      if (r !== detailRow) r.style.display = "none";
    });

    const isVisible = detailRow.style.display === "table-row";
    detailRow.style.display = isVisible ? "none" : "table-row";

    if (!isVisible) {
      detailRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  const editBtn = detailRow.querySelector(".btn-edit");
  editBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    document.getElementById("editTaskId").value = task.id;
    document.getElementById("editTaskName").value = task.task_name || "";
    document.getElementById("editProgress").value = task.progress ?? 0;
    document.getElementById("editStatus").value = task.status || "ยังไม่เริ่ม";
    document.getElementById("editRemark").value = task.remark || "";

    document.getElementById("editStartDate").value = task.start_date
      ? new Date(task.start_date).toISOString().split("T")[0]
      : "";
    document.getElementById("editEndDate").value = task.end_date
      ? new Date(task.end_date).toISOString().split("T")[0]
      : "";

    if (!editModal) {
      const modalEl = document.getElementById("editTaskModal");
      editModal = new bootstrap.Modal(modalEl);
    }
    editModal.show();
  });

  // ✅ ปุ่มลบ
  const delBtn = detailRow.querySelector(".btn-del");
  delBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const confirm = await Swal.fire({
      title: "ลบงานนี้?",
      text: "คุณแน่ใจหรือไม่ว่าจะลบข้อมูลงานนี้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });

    if (!confirm.isConfirmed) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json();
    if (result.status === "success") {
      mainRow.remove();
      detailRow.remove();
      Swal.fire({
        icon: "success",
        title: "✅ ลบสำเร็จ!",
        timer: 1200,
        showConfirmButton: false,
      });
    } else {
      Swal.fire("❌ ลบไม่สำเร็จ", result.message || "", "error");
    }
  });

  tbody.appendChild(mainRow);
  tbody.appendChild(detailRow);
}

let editModal;
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("editTaskModal");
  if (modalEl) {
    editModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  }
});

async function openEditModal(e) {
  const tr = e.target.closest("tr");
  if (!tr) return Swal.fire("❌ ไม่พบแถวข้อมูล", "", "error");

  document.getElementById("editTaskId").value = tr.dataset.id;

  const cells = tr.querySelectorAll("td");
  const taskName = cells[1]?.textContent.trim() || "";
  const status = cells[2]?.textContent.trim() || "ยังไม่เริ่ม";
  const progressText = cells[3]?.textContent.replace("%", "").trim() || "0";
  const remark = cells[4]?.textContent.trim() || "";

  document.getElementById("editTaskName").value = taskName;
  document.getElementById("editStatus").value = status;
  document.getElementById("editProgress").value = parseInt(progressText, 10);
  document.getElementById("editRemark").value = remark;

  const startDate = tr.dataset.startdate || "";
  const endDate = tr.dataset.enddate || "";
  document.getElementById("editStartDate").value = startDate
    ? new Date(startDate).toISOString().split("T")[0]
    : "";
  document.getElementById("editEndDate").value = endDate
    ? new Date(endDate).toISOString().split("T")[0]
    : "";

  const modalEl = document.getElementById("editTaskModal");
  const instance = bootstrap.Modal.getOrCreateInstance(modalEl);
  instance.show();
}

document.getElementById("saveEditBtn").addEventListener("click", async () => {
  const id = document.getElementById("editTaskId").value;
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const btn = document.getElementById("saveEditBtn");

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
    กำลังบันทึก...
  `;

  const payload = {
    task_name: document.getElementById("editTaskName").value.trim(),
    assignee: username,
    progress: parseInt(
      document.getElementById("editProgress").value || "0",
      10
    ),
    status: document.getElementById("editStatus").value,
    remark: document.getElementById("editRemark").value,
    start_date: document.getElementById("editStartDate").value || null,
    end_date: document.getElementById("editEndDate").value || null,
    last_update: new Date().toLocaleString("th-TH"),
  };

  try {
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
      updateTaskRow(id, payload);

      const modalEl = document.getElementById("editTaskModal");
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();

      document.getElementById("editTaskForm").reset();

      modalEl.addEventListener(
        "hidden.bs.modal",
        () => {
          Swal.fire({
            icon: "success",
            title: "✅ อัปเดตสำเร็จ!",
            timer: 1200,
            showConfirmButton: false,
          });

          setTimeout(() => loadUserTasks(), 800);
        },
        { once: true }
      );
    } else {
      Swal.fire("❌ อัปเดตไม่สำเร็จ", result.message || "", "error");
    }
  } catch (err) {
    console.error("❌ อัปเดตไม่สำเร็จ:", err);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อ API ได้", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

function updateTaskRow(id, newData) {
  const mainRow = document.querySelector(`#userTable tr[data-id='${id}']`);
  const detailRow = mainRow?.nextElementSibling;

  if (!mainRow || !detailRow) return;

  const statusClass =
    newData.status === "เสร็จสิ้น"
      ? "text-success"
      : newData.status === "กำลังดำเนินการ"
      ? "text-warning"
      : "text-muted";

  mainRow.children[1].textContent = newData.task_name || "-";
  mainRow.children[2].innerHTML = `
    <span class="${statusClass}">${newData.status || "ยังไม่เริ่ม"}</span>
  `;

  const progress = newData.progress ?? 0;
  const startDate = newData.start_date || "-";
  const endDate = newData.end_date || "-";
  const remark = newData.remark || "-";
  const lastUpdate = newData.last_update || "-";
  const assignee = localStorage.getItem("displayName") || "-";

  detailRow.querySelector("div").innerHTML = `
    <p><strong>ผู้รับผิดชอบ:</strong> ${assignee}</p>
    <p><strong>วันที่เริ่ม:</strong> ${startDate} | <strong>สิ้นสุด:</strong> ${endDate}</p>
    <p><strong>ความคืบหน้า:</strong> ${progress}%</p>
    <p><strong>หมายเหตุ:</strong> ${remark}</p>
    <p><strong>อัปเดตล่าสุด:</strong> ${lastUpdate}</p>
    <div class="text-end mt-2">
      <button class="btn btn-sm btn-outline-warning btn-edit">✏️ แก้ไข</button>
      <button class="btn btn-sm btn-outline-danger btn-del">🗑️ ลบ</button>
    </div>
  `;

  mainRow.dataset.startdate = startDate;
  mainRow.dataset.enddate = endDate;

  detailRow.querySelector(".btn-edit").addEventListener("click", () => {
    const modalEl = document.getElementById("editTaskModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    document.getElementById("editTaskId").value = id;
    document.getElementById("editTaskName").value = newData.task_name || "";
    document.getElementById("editProgress").value = progress;
    document.getElementById("editStatus").value =
      newData.status || "ยังไม่เริ่ม";
    document.getElementById("editRemark").value = remark;
    document.getElementById("editStartDate").value =
      startDate !== "-" ? startDate : "";
    document.getElementById("editEndDate").value =
      endDate !== "-" ? endDate : "";
    modal.show();
  });

  detailRow.querySelector(".btn-del").addEventListener("click", async () => {
    const confirm = await Swal.fire({
      title: "ลบงานนี้?",
      text: "คุณแน่ใจหรือไม่ว่าจะลบข้อมูลงานนี้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc3545",
    });
    if (!confirm.isConfirmed) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    if (result.status === "success") {
      mainRow.remove();
      detailRow.remove();
      Swal.fire("✅ ลบสำเร็จ!", "", "success");
    } else {
      Swal.fire("❌ ลบไม่สำเร็จ", result.message || "", "error");
    }
  });
}

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  const payload = {
    task_id: document.getElementById("taskId").value.trim(),
    task_name: document.getElementById("taskName").value.trim(),
    progress: parseInt(document.getElementById("progress").value || "0", 10),
    status: document.getElementById("status").value,
    remark: document.getElementById("remark").value,
    start_date: document.getElementById("startDate").value || null,
    end_date: document.getElementById("endDate").value || null,
    last_update: new Date().toLocaleString("th-TH"),
  };

  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.status === "success") {
      appendTaskRow(data.data);
      Swal.fire("เพิ่มงานสำเร็จ!", "", "success");
      e.target.reset();
    } else {
      Swal.fire("❌ เพิ่มงานไม่สำเร็จ", data.message || "", "error");
    }
  } catch (err) {
    console.error("❌ เพิ่มงานไม่สำเร็จ:", err);
    Swal.fire("ไม่สามารถเชื่อมต่อ API ได้", "", "error");
  }
});
