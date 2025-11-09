// app.firebase.js — WebsiteHadir SD Negeri Muhara
// Menggunakan Firebase Realtime Database (Asia-Southeast1 region)

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyDy5lJ8rk9yondEFH_ARB_GQAEdi-PMDIU",
  authDomain: "websitehadirsekolah.firebaseapp.com",
  databaseURL: "https://websitehadirsekolah-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "websitehadirsekolah",
  storageBucket: "websitehadirsekolah.appspot.com",
  messagingSenderId: "811289978131",
  appId: "1:811289978131:web:ad0bd0b113dd1c733a26e6",
  measurementId: "G-PK0811G8VJ"
};

// ================= INISIALISASI FIREBASE =================
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

db.ref(".info/connected").on("value", (snap) => {
  if (snap.val() === true) {
    console.log("✅ Terhubung ke Realtime Database!");
  } else {
    console.warn("⚠️ Tidak terhubung ke Realtime Database.");
  }
});

// ================== DATA GURU (STATIC) ==================
const guruList = [
  { nip: "G001", nama: "Ibu Ani", jabatan: "Kepala Sekolah", status: "Aktif" },
  { nip: "G002", nama: "Pak Budi", jabatan: "Guru Kelas 1", status: "Aktif" },
  { nip: "G003", nama: "Ibu Siti", jabatan: "Guru BK", status: "Aktif" },
  { nip: "G004", nama: "Pak Rudi", jabatan: "Guru PJOK", status: "Aktif" },
];

// ================== HELPER FUNCTIONS ==================
function formatTanggal() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function formatJam() {
  const d = new Date();
  return d.toTimeString().split(" ")[0]; // HH:MM:SS
}

// ================== INISIALISASI UI ==================
document.addEventListener("DOMContentLoaded", () => {
  // --- TAB SWITCHING ---
  const tabs = document.querySelectorAll(".tab-button");
  const pages = document.querySelectorAll("main section");

  function showPage(name) {
    pages.forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== `page-${name}`);
    });
    tabs.forEach((btn) => {
      btn.classList.toggle("tab-active", btn.dataset.page === name);
    });
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  showPage("kehadiran"); // default

  // --- ISI SELECT GURU ---
  const selectGuru = document.getElementById("namaGuru");
  selectGuru.innerHTML = '<option value="">-- Pilih Guru --</option>';
  guruList.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = `${g.nip}|${g.nama}`;
    opt.textContent = `${g.nama} — ${g.jabatan}`;
    selectGuru.appendChild(opt);
  });

  // --- TABEL DATA GURU ---
  const guruTable = document.getElementById("guruTableBody");
  guruTable.innerHTML = "";
  guruList.forEach((g) => {
    guruTable.innerHTML += `
      <tr>
        <td class="border p-2">${g.nip}</td>
        <td class="border p-2">${g.nama}</td>
        <td class="border p-2">${g.jabatan}</td>
        <td class="border p-2">${g.status}</td>
      </tr>
    `;
  });

  // --- JAM & TANGGAL ---
  setTanggalSekarang();
  drawClock();
  setInterval(() => {
    setTanggalSekarang();
    drawClock();
  }, 1000);

  // --- GEOLOKASI (otomatis) ---
  const lokasiInput = document.getElementById("lokasi");
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lokasiInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      },
      () => (lokasiInput.value = "Lokasi tidak aktif"),
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }

  // --- KIRIM KEHADIRAN ---
  document.getElementById("kirimKehadiranBtn").addEventListener("click", async function handleSubmitKehadiran(e) {
    e.preventDefault();
    const guruVal = selectGuru.value;
    const status = document.getElementById("statusKehadiran").value;
    if (!guruVal || !status) return alert("Pilih guru dan status terlebih dahulu.");

    const [nip, nama] = guruVal.split("|");
    const payload = {
      nip,
      nama,
      status,
      jam: formatJam(),
      tanggal: formatTanggal(),
      lokasi: lokasiInput.value || "-",
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    const btn = this;
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Mengirim...";

    try {
      const newRef = db.ref("kehadiran").push(); // buat node baru
      console.log("Membuat ref baru:", newRef.key);
      await newRef.set(payload);
      console.log("Kirim berhasil:", newRef.key);
      alert("✅ Kehadiran berhasil dikirim!");
    } catch (e) {
      console.error("Gagal kirim kehadiran:", e);
      alert("❌ Gagal kirim. Periksa koneksi atau rules Firebase.\n\n" + (e.message || e));
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldText;
    }
  });

  // --- DASHBOARD REALTIME ---
  const chartCtx = document.getElementById("chartDashboard").getContext("2d");
  const chart = new Chart(chartCtx, {
    type: "doughnut",
    data: {
      labels: ["Hadir", "Izin/Sakit/Dinas"],
      datasets: [{ data: [0, 0], backgroundColor: ["#22c55e", "#facc15"] }],
    },
  });

  db.ref("kehadiran").on("value", (snap) => {
    const data = snap.val() || {};
    const hariIni = formatTanggal();
    let hadir = 0,
      lain = 0;

    const aktivitas = [];
    for (const id in data) {
      const item = data[id];
      if (item.tanggal === hariIni) {
        if (item.status === "Hadir") hadir++;
        else lain++;
        aktivitas.push(`${item.nama} - ${item.status} (${item.jam})`);
      }
    }

    // Update chart & dashboard
    chart.data.datasets[0].data = [hadir, lain];
    chart.update();
    document.getElementById("totalGuru").textContent = guruList.length;
    document.getElementById("totalHadir").textContent = hadir;
    document.getElementById("totalLain").textContent = lain;

    // Aktivitas terbaru
    const actDiv = document.getElementById("recent-activity");
    actDiv.innerHTML = "";
    if (aktivitas.length === 0) {
      actDiv.innerHTML = '<p class="text-gray-400">Belum ada aktivitas hari ini.</p>';
    } else {
      aktivitas.reverse().slice(0, 10).forEach((a) => {
        const p = document.createElement("p");
        p.textContent = a;
        actDiv.appendChild(p);
      });
    }
  });

  // --- LAPORAN BULANAN ---
  document.getElementById("tampilkanLaporanBtn").addEventListener("click", async () => {
    const bulan = document.getElementById("bulan").value;
    if (!bulan) return alert("Pilih bulan terlebih dahulu.");

    const snap = await db.ref("kehadiran").once("value");
    const data = snap.val() || {};
    const rows = Object.values(data).filter((d) => d.tanggal.startsWith(bulan));

    const tbody = document.getElementById("laporanTableBody");
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">Tidak ada data bulan ini.</td></tr>`;
      return;
    }

    rows.sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2">${r.tanggal}</td>
        <td class="border p-2">${r.nama}</td>
        <td class="border p-2">${r.jam}</td>
        <td class="border p-2">${r.lokasi}</td>
        <td class="border p-2">${r.status}</td>`;
      tbody.appendChild(tr);
    });

    document.getElementById("resume-laporan").textContent = `Menampilkan ${rows.length} catatan untuk ${bulan}`;
  });

  // --- EXPORT EXCEL ---
  document.getElementById("exportLaporanBtn").addEventListener("click", () => {
    const table = document.getElementById("laporanTableBody");
    const wb = XLSX.utils.book_new();
    const data = [["Tanggal", "Nama Guru", "Jam", "Lokasi", "Status"]];
    table.querySelectorAll("tr").forEach((tr) => {
      const cols = [...tr.children].map((td) => td.textContent);
      data.push(cols);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, "Laporan-Kehadiran.xlsx");
  });
});

// =================== JAM & TANGGAL ===================
function setTanggalSekarang() {
  const now = new Date();
  const ops = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  document.getElementById("current-date").textContent = now.toLocaleDateString("id-ID", ops);
}

// =================== ANALOG CLOCK ===================
function drawClock() {
  const c = document.getElementById("analogClock");
  if (!c) return;
  const ctx = c.getContext("2d");
  const r = c.width / 2;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.save();
  ctx.translate(r, r);
  ctx.strokeStyle = "#1e3a8a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, 2 * Math.PI);
  ctx.stroke();

  const now = new Date();
  const sec = now.getSeconds();
  const min = now.getMinutes();
  const hr = now.getHours() % 12;

  // Jam
  ctx.rotate((Math.PI / 6) * (hr + min / 60));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.5);
  ctx.stroke();
  ctx.rotate(-(Math.PI / 6) * (hr + min / 60));

  // Menit
  ctx.rotate((Math.PI / 30) * (min + sec / 60));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.75);
  ctx.stroke();
  ctx.rotate(-(Math.PI / 30) * (min + sec / 60));

  // Detik
  ctx.strokeStyle = "#ef4444";
  ctx.rotate((Math.PI / 30) * sec);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.85);
  ctx.stroke();
  ctx.restore();
}
