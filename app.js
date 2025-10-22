let tasks = [];
let chart;

async function loadTasksFromDB() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("${API_BASE}/taskstasks", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    tasks = data.map((t) => ({
      id: t.task_id,
      name: t.task_name,
      assignee: t.assignee,
      startDate: t.start_date,
      endDate: t.end_date,
      progress: t.progress,
      status: t.status,
      remark: t.remark,
      lastUpdate: t.last_update,
    }));

    renderDashboard();
  } catch (err) {
    console.error("❌ โหลดข้อมูลจากฐานไม่สำเร็จ:", err);
  }
}

document.getElementById("updateForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const task = {
    id: document.getElementById("taskId").value,
    name: document.getElementById("taskName").value,
    assignee: document.getElementById("assignee").value,
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
    progress: document.getElementById("progress").value,
    status: document.getElementById("status").value,
    remark: document.getElementById("remark").value,
    lastUpdate: new Date().toLocaleString("th-TH"),
  };

  try {
    await fetch("${API_BASE}/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(task),
    });
    await loadTasksFromDB();
  } catch (err) {
    alert("❌ ไม่สามารถเชื่อมต่อ API ได้");
  }

  document.getElementById("updateForm").reset();
});

function renderDashboard() {
  const dashboard = document.getElementById("dashboard");
  if (!Array.isArray(tasks) || tasks.length === 0) {
    dashboard.innerHTML = "<p>ยังไม่มีข้อมูลงาน</p>";
    updateChart({ ยังไม่เริ่ม: 0, กำลังดำเนินการ: 0, เสร็จสิ้น: 0 });
    return;
  }

  const summary = {
    ยังไม่เริ่ม: tasks.filter((t) => t.status === "ยังไม่เริ่ม").length,
    กำลังดำเนินการ: tasks.filter((t) => t.status === "กำลังดำเนินการ").length,
    เสร็จสิ้น: tasks.filter((t) => t.status === "เสร็จสิ้น").length,
  };

  updateChart(summary);

  dashboard.innerHTML = `
    <div class="summary">
      <p>🕓 ยังไม่เริ่ม: ${summary["ยังไม่เริ่ม"]}</p>
      <p>⚙️ กำลังดำเนินการ: ${summary["กำลังดำเนินการ"]}</p>
      <p>✅ เสร็จสิ้น: ${summary["เสร็จสิ้น"]}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>รหัสงาน</th>
          <th>รายละเอียดงาน</th>
          <th>ผู้รับผิดชอบ</th>
          <th>วันที่เริ่มต้น</th>
          <th>วันที่สิ้นสุด</th>
          <th>ความคืบหน้า</th>
          <th>สถานะ</th>
          <th>หมายเหตุ</th>
          <th>อัปเดตล่าสุด</th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (t) => `
          <tr>
            <td>${t.id}</td>
            <td>${t.name}</td>
            <td>${t.assignee}</td>
            <td>${t.startDate || ""}</td>
            <td>${t.endDate || ""}</td>
            <td>
              <div class="progress-bar">
                <span style="width:${t.progress}%"></span>
              </div>
              <small>${t.progress}%</small>
            </td>
            <td>${t.status}</td>
            <td>${t.remark || ""}</td>
            <td>${t.lastUpdate || ""}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function updateChart(summary) {
  const ctx = document.getElementById("statusChart").getContext("2d");
  const data = [
    summary["ยังไม่เริ่ม"],
    summary["กำลังดำเนินการ"],
    summary["เสร็จสิ้น"],
  ];
  const colors = ["#f4c542", "#0078d4", "#00b050"];

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น"],
      datasets: [{ data, backgroundColor: colors }],
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

window.addEventListener("DOMContentLoaded", initAutoResizeTextareas);
window.addEventListener("DOMContentLoaded", loadTasksFromDB);
