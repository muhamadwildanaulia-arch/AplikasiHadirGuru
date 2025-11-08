// app.js — WebsiteHadir SD Negeri Muhara
// Tema Indonesia Modern + Form Kehadiran Terintegrasi
// Developer: D.A.N × GPT-5 | 2025

const GS_URL = 'https://script.google.com/macros/s/AKfycbw1Hvqf8_pY8AoeI-MOzLHYQEX0hrlY9S7C07Wvmzzey_u4w5cAZpTVbAm1opzBTeMJ/exec';

let guruList = [];
let kehadiranList = [];
let chartDashboard = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
  showLoading("📡 Memuat data awal...");
  await Promise.all([loadGuru(), loadKehadiran()]);
  initTabs();
  initForm();
  renderDashboard();
  hideLoading();
});

// ========== AMBIL DATA ==========
async function loadGuru() {
  try {
    const res = await fetch(GS_URL + '?sheet=guru');
    const data = await res.json();
    guruList = Array.isArray(data)
      ? data.slice(1).map(r => ({ nip: r[1] || '', nama_guru: r[0] || '', jabatan: r[2] || '', status: r[3] || '' }))
      : [];

    // isi dropdown nama guru di form
    const select = document.getElementById('namaGuru');
    if (select) {
      select.innerHTML = guruList.map(g => `<option value="${g.nama_guru}">${g.nama_guru}</option>`).join('');
    }

    renderGuruTable();
  } catch (err) {
    console.error('Gagal memuat data guru:', err);
  }
}

async function loadKehadiran() {
  try {
    const res = await fetch(GS_URL + '?sheet=kehadiran');
    const data = await res.json();
    kehadiranList = Array.isArray(data)
      ? data.slice(1).map(r => ({
          nama_guru: r[0] || '',
          status: r[1] || '',
          jam: r[2] || '',
          tanggal: normalizeDate(r[3]),
          lokasi: r[4] || ''
        }))
      : [];
  } catch (err) {
    console.error('Gagal memuat data kehadiran:', err);
  }
}

// ========== FORM KEHADIRAN ==========
function initForm() {
  // ambil lokasi GPS
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        document.getElementById("lokasi").value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      },
      err => {
        document.getElementById("lokasi").value = "Lokasi tidak diizinkan.";
      }
    );
  } else {
    document.getElementById("lokasi").value = "Perangkat tidak mendukung GPS.";
  }

  // tombol kirim
  const btn = document.getElementById("kirimKehadiranBtn");
  btn.addEventListener("click", kirimKehadiran);
}

async function kirimKehadiran() {
  const nama = document.getElementById("namaGuru").value.trim();
  const status = document.getElementById("statusKehadiran").value;
  const lokasi = document.getElementById("lokasi").value;

  if (!nama || !status) {
    alert("Harap pilih nama guru dan status kehadiran.");
    return;
  }

  const now = new Date();
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tanggal = now.toISOString().split("T")[0];

  const data = { nama_guru: nama, status, jam, tanggal, lokasi };

  showLoading("🚀 Mengirim kehadiran...");
  try {
    const res = await fetch(GS_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });

    hideLoading();
    alert("✅ Kehadiran berhasil dikirim!");

    // reset status
    document.getElementById("statusKehadiran").value = "";
    await loadKehadiran();
    renderDashboard();
  } catch (err) {
    hideLoading();
    alert("❌ Gagal mengirim kehadiran. Periksa koneksi internet.");
    console.error("Error:", err);
  }
}

// ========== DASHBOARD ==========
function renderDashboard() {
  const totalGuru = guruList.length;
  const today = new Date().toISOString().split("T")[0];
  const todayData = kehadiranList.filter(d => d.tanggal === today);
  const hadir = todayData.filter(d => d.status === "Hadir").length;
  const lain = todayData.filter(d => d.status !== "Hadir").length;

  document.getElementById("totalGuru").textContent = totalGuru;
  document.getElementById("totalHadir").textContent = hadir;
  document.getElementById("totalLain").textContent = lain;

  renderChart(todayData);
  renderRecentActivity(todayData);
}

function renderChart(data) {
  const ctx = document.getElementById("chartDashboard").getContext("2d");
  const counts = { "Hadir": 0, "Izin": 0, "Sakit": 0, "Dinas Luar": 0 };
  data.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  if (chartDashboard) chartDashboard.destroy();

  chartDashboard = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ["#dc2626", "#1e3a8a", "#facc15", "#16a34a"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderRecentActivity(data) {
  const el = document.getElementById("recent-activity");
  const recent = data.slice(-10).reverse();
  el.innerHTML = recent.length
    ? recent.map(r => `
      <div class="flex justify-between border-b py-1">
        <span>${escapeHtml(r.nama_guru)} - ${escapeHtml(r.status)}</span>
        <span class="text-gray-500 text-xs">${escapeHtml(r.jam)}</span>
      </div>
    `).join("")
    : `<p class="text-gray-400">Belum ada data kehadiran hari ini.</p>`;
}

// ========== DATA GURU ==========
function renderGuruTable() {
  const tbody = document.getElementById("guruTableBody");
  if (!guruList.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data guru.</td></tr>`;
    return;
  }
  tbody.innerHTML = guruList.map(g => `
    <tr class="hover:bg-gray-50">
      <td class="border p-2">${escapeHtml(g.nip)}</td>
      <td class="border p-2">${escapeHtml(g.nama_guru)}</td>
      <td class="border p-2">${escapeHtml(g.jabatan)}</td>
      <td class="border p-2">${escapeHtml(g.status)}</td>
    </tr>
  `).join("");
}

// ========== LAPORAN BULANAN ==========
document.getElementById("tampilkanLaporanBtn").addEventListener("click", tampilkanLaporan);
document.getElementById("exportLaporanBtn").addEventListener("click", exportLaporanExcel);

function tampilkanLaporan() {
  const bulan = document.getElementById("bulan").value;
  if (!bulan) return alert("Pilih bulan terlebih dahulu.");
  const [y, m] = bulan.split("-");
  const data = kehadiranList.filter(d => d.tanggal.startsWith(`${y}-${m}`));

  const tbody = document.getElementById("laporanTableBody");
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Tidak ada data bulan ini.</td></tr>`;
    document.getElementById("resume-laporan").innerHTML = "";
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="border p-2">${escapeHtml(r.tanggal)}</td>
      <td class="border p-2">${escapeHtml(r.nama_guru)}</td>
      <td class="border p-2">${escapeHtml(r.jam)}</td>
      <td class="border p-2">${escapeHtml(r.lokasi)}</td>
      <td class="border p-2">${escapeHtml(r.status)}</td>
    </tr>
  `).join("");

  const total = { Hadir: 0, Izin: 0, Sakit: 0, "Dinas Luar": 0 };
  data.forEach(r => { if (total[r.status] !== undefined) total[r.status]++; });

  document.getElementById("resume-laporan").innerHTML =
    `<p>Hadir: <b>${total.Hadir}</b> | Izin: <b>${total.Izin}</b> | Sakit: <b>${total.Sakit}</b> | Dinas Luar: <b>${total["Dinas Luar"]}</b></p>
     <p>Total: <b>${data.length}</b></p>`;
}

function exportLaporanExcel() {
  const rows = [];
  document.querySelectorAll("#laporanTableBody tr").forEach(tr => {
    const td = tr.querySelectorAll("td");
    if (td.length === 5)
      rows.push({
        Tanggal: td[0].textContent,
        Nama: td[1].textContent,
        Jam: td[2].textContent,
        Lokasi: td[3].textContent,
        Status: td[4].textContent
      });
  });
  if (!rows.length) return alert("Tidak ada data untuk diekspor.");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  XLSX.writeFile(wb, `laporan_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// ========== UTILITAS ==========
function normalizeDate(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    d.setHours(d.getUTCHours() + 7);
    return d.toISOString().split("T")[0];
  }
  return String(value).slice(0, 10);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]
  ));
}

function showLoading(msg) {
  const el = document.createElement("div");
  el.id = "loadingOverlay";
  el.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50";
  el.innerHTML = `<div class="bg-white p-6 rounded-lg shadow-lg text-center"><p class="text-blue-700 font-semibold">${msg}</p></div>`;
  document.body.appendChild(el);
}
function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.remove();
}

// ========== TAB ==========
function initTabs() {
  document.querySelectorAll("nav button[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("section[id^='page-']").forEach(s => s.classList.add("hidden"));
      document.querySelectorAll("nav button").forEach(b => b.classList.remove("tab-active"));
      document.getElementById("page-" + btn.dataset.page).classList.remove("hidden");
      btn.classList.add("tab-active");
    });
  });
}
