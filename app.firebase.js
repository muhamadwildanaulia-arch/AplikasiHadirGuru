// app.firebase.js — WebsiteHadir (Final, dengan config yang kamu kirim)
// NOTE: saya perbaiki storageBucket ke format .appspot.com (standar Firebase).

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
if (!window.firebase || !window.firebase.initializeApp) {
  console.error('Firebase SDK tidak ditemukan. Pastikan kamu menyertakan firebase-app-compat.js dan firebase-database-compat.js di index.html');
} else {
  try {
    // Jika sudah ada app inisialisasi, hindari inisialisasi ulang
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    } else {
      // jika sudah ada, pastikan options cocok (log untuk debugging)
      console.log('Firebase already initialized. options:', firebase.app().options);
    }
  } catch (e) {
    console.error('Error saat inisialisasi Firebase:', e);
  }
}

const db = firebase.database();

// small connectivity log
db.ref(".info/connected").on("value", (snap) => {
  if (snap.val() === true) console.log("✅ Terhubung ke Realtime Database!");
  else console.warn("⚠️ Tidak terhubung ke Realtime Database.");
});

/* ================== DATA GURU (STATIC) ================== */
const guruList = [
  { nip: "G001", nama: "Ibu Ani", jabatan: "Kepala Sekolah", status: "Aktif" },
  { nip: "G002", nama: "Pak Budi", jabatan: "Guru Kelas 1", status: "Aktif" },
  { nip: "G003", nama: "Ibu Siti", jabatan: "Guru BK", status: "Aktif" },
  { nip: "G004", nama: "Pak Rudi", jabatan: "Guru PJOK", status: "Aktif" },
];

/* ================== HELPERS ================== */
function formatTanggal() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function formatJam() {
  return new Date().toTimeString().split(" ")[0]; // HH:MM:SS
}

/* ================== UI INIT ================== */
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.tab-button');
  const pages = document.querySelectorAll('main section');

  function showPage(name) {
    pages.forEach(sec => sec.classList.toggle('hidden', sec.id !== `page-${name}`));
    tabs.forEach(btn => btn.classList.toggle('tab-active', btn.dataset.page === name));
  }
  tabs.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
  showPage('kehadiran');

  // Populate teacher select & table
  const sel = document.getElementById('namaGuru');
  sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
  guruList.forEach(g => {
    const o = document.createElement('option');
    o.value = `${g.nip}|${g.nama}`;
    o.textContent = `${g.nama} — ${g.jabatan}`;
    sel.appendChild(o);
  });

  const tbody = document.getElementById('guruTableBody');
  tbody.innerHTML = '';
  guruList.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="border p-2">${g.nip}</td>
                    <td class="border p-2">${g.nama}</td>
                    <td class="border p-2">${g.jabatan}</td>
                    <td class="border p-2">${g.status}</td>`;
    tbody.appendChild(tr);
  });

  // Clock & date
  setTanggalSekarang();
  drawClock();
  setInterval(() => { setTanggalSekarang(); drawClock(); }, 1000);

  // Geolocation (try fill once)
  const lokasiInput = document.getElementById('lokasi');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => lokasiInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
      () => lokasiInput.value = 'Lokasi tidak aktif',
      { enableHighAccuracy: false, timeout: 7000 }
    );
  }

  // Kirim kehadiran (stable push->set)
  document.getElementById('kirimKehadiranBtn').addEventListener('click', async function (e) {
    e.preventDefault();
    const selVal = document.getElementById('namaGuru').value;
    const status = document.getElementById('statusKehadiran').value;
    if (!selVal || !status) return alert('Pilih nama dan status terlebih dahulu.');

    const [nip, nama] = selVal.split('|');
    const payload = {
      nip,
      nama,
      status,
      jam: formatJam(),
      tanggal: formatTanggal(),
      lokasi: (document.getElementById('lokasi').value || '-'),
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    const btn = this;
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Mengirim...';

    try {
      // create new ref then set
      const newRef = db.ref('kehadiran').push();
      console.log('Membuat ref key:', newRef.key);
      await newRef.set(payload);
      console.log('Kirim sukses key:', newRef.key);
      alert('✅ Kehadiran berhasil dikirim!');
    } catch (err) {
      console.error('Gagal kirim:', err);
      alert('❌ Gagal kirim. Periksa koneksi atau rules Firebase.\n\nDetail: ' + (err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  // Dashboard chart
  const ctx = document.getElementById('chartDashboard').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Hadir', 'Izin/Sakit/Dinas'], datasets: [{ data: [0,0] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Realtime listener
  db.ref('kehadiran').on('value', snap => {
    const data = snap.val() || {};
    const today = formatTanggal();
    let hadir = 0, lain = 0;
    const recent = [];
    Object.values(data).forEach(it => {
      if (it.tanggal === today) {
        if (it.status === 'Hadir') hadir++; else lain++;
        recent.push(it);
      }
    });
    chart.data.datasets[0].data = [hadir, lain]; chart.update();
    document.getElementById('totalGuru').textContent = guruList.length;
    document.getElementById('totalHadir').textContent = hadir;
    document.getElementById('totalLain').textContent = lain;

    const act = document.getElementById('recent-activity');
    act.innerHTML = '';
    if (!recent.length) act.innerHTML = '<p class="text-gray-400">Belum ada aktivitas hari ini.</p>';
    else recent.reverse().slice(0,12).forEach(r => {
      const p = document.createElement('p'); p.textContent = `${r.jam} — ${r.nama} — ${r.status}`; act.appendChild(p);
    });
  });

  // Laporan & export
  document.getElementById('tampilkanLaporanBtn').addEventListener('click', async () => {
    const bulan = document.getElementById('bulan').value; if (!bulan) return alert('Pilih bulan terlebih dahulu.');
    const snap = await db.ref('kehadiran').once('value'); const data = snap.val() || {};
    const rows = Object.values(data).filter(d => d.tanggal && d.tanggal.startsWith(bulan));
    const tbody = document.getElementById('laporanTableBody'); tbody.innerHTML = '';
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Tidak ada data bulan ini.</td></tr>'; document.getElementById('resume-laporan').textContent=''; return; }
    rows.sort((a,b) => (a.tanggal + (a.jam||'')).localeCompare(b.tanggal + (b.jam||'')));
    rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="border p-2">${r.tanggal}</td><td class="border p-2">${r.nama}</td><td class="border p-2">${r.jam||'-'}</td><td class="border p-2">${r.lokasi||'-'}</td><td class="border p-2">${r.status}</td>`; tbody.appendChild(tr); });
    document.getElementById('resume-laporan').textContent = `Menampilkan ${rows.length} catatan untuk ${bulan}`;
  });

  document.getElementById('exportLaporanBtn').addEventListener('click', () => {
    const tbody = document.getElementById('laporanTableBody');
    const rows = []; tbody.querySelectorAll('tr').forEach(tr => { const cols = [...tr.children].map(td => td.textContent.trim()); if (cols.length) rows.push(cols); });
    if (!rows.length) return alert('Tidak ada data untuk diexport.');
    const ws = XLSX.utils.aoa_to_sheet([['Tanggal','Nama Guru','Jam','Lokasi','Status'], ...rows]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, 'Laporan-Kehadiran.xlsx');
  });
});

/* =================== Clock & Date =================== */
function setTanggalSekarang() {
  const now = new Date(); const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; const el = document.getElementById('current-date'); if (el) el.textContent = now.toLocaleDateString('id-ID', opts);
}

function drawClock() {
  const c = document.getElementById('analogClock'); if (!c) return; const ctx = c.getContext('2d'); const r = c.width/2; ctx.clearRect(0,0,c.width,c.height); ctx.save(); ctx.translate(r,r);
  ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,r-4,0,2*Math.PI); ctx.stroke();
  const now = new Date(); const sec = now.getSeconds(); const min = now.getMinutes(); const hr = now.getHours()%12;
  ctx.rotate((Math.PI/6)*(hr + min/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.5); ctx.stroke(); ctx.rotate(-(Math.PI/6)*(hr + min/60));
  ctx.rotate((Math.PI/30)*(min + sec/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.75); ctx.stroke(); ctx.rotate(-(Math.PI/30)*(min + sec/60));
  ctx.strokeStyle = '#ef4444'; ctx.rotate((Math.PI/30)*sec); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.85); ctx.stroke(); ctx.restore();
}
