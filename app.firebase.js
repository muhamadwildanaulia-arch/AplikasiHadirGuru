// app.firebase.js — tanpa login (Realtime DB mode)

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

// init
if (!window.firebase || !window.firebase.initializeApp) {
  console.error('Firebase SDK tidak ditemukan. Pastikan firebase compat scripts sudah di-include di index.html');
} else {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// sample local teacher list (replace or sync with DB later)
const teachers = [
  { nip: 'G001', name: 'Ibu Ani', jabatan: 'Kepala Sekolah', status: 'Aktif' },
  { nip: 'G002', name: 'Pak Budi', jabatan: 'Guru Kelas 1', status: 'Aktif' },
  { nip: 'G003', name: 'Ibu Siti', jabatan: 'Guru BK', status: 'Aktif' },
];

// helpers
function nowFormatted() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function timeFormatted() {
  return new Date().toTimeString().split(' ')[0];
}

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // tab switching
  const buttons = Array.from(document.querySelectorAll('.tab-button'));
  const sections = Array.from(document.querySelectorAll('main section'));
  function showPage(name) {
    sections.forEach(sec => sec.id === `page-${name}` ? sec.classList.remove('hidden') : sec.classList.add('hidden'));
    buttons.forEach(b => b.dataset.page === name ? b.classList.add('tab-active') : b.classList.remove('tab-active'));
  }
  buttons.forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); showPage(b.dataset.page); }));
  const initial = buttons.find(b => b.classList.contains('tab-active')) || buttons[0];
  if (initial) showPage(initial.dataset.page);

  // populate select & table
  const sel = document.getElementById('namaGuru');
  sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
  teachers.forEach(t => {
    const o = document.createElement('option');
    o.value = `${t.nip}|${t.name}`;
    o.textContent = `${t.name} — ${t.jabatan}`;
    sel.appendChild(o);
  });

  const tbody = document.getElementById('guruTableBody');
  tbody.innerHTML = '';
  teachers.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="border p-2">${t.nip}</td><td class="border p-2">${t.name}</td><td class="border p-2">${t.jabatan}</td><td class="border p-2">${t.status}</td>`;
    tbody.appendChild(tr);
  });

  // clock & date
  setCurrentDate();
  drawClock();
  setInterval(()=>{ drawClock(); setCurrentDate(); }, 1000);

  // geolocation fill once
  const lokasiEl = document.getElementById('lokasi');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      lokasiEl.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    }, () => {}, { timeout: 7000 });
  }

  // kirim kehadiran (public write)
  document.getElementById('kirimKehadiranBtn').addEventListener('click', async function(){
    const selVal = document.getElementById('namaGuru').value;
    const status = document.getElementById('statusKehadiran').value;
    if (!selVal) return alert('Pilih nama guru terlebih dahulu.');
    if (!status) return alert('Pilih status kehadiran.');

    const [nip, name] = selVal.split('|');
    const payload = {
      nip,
      nama: name,
      status,
      jam: timeFormatted(),
      tanggal: nowFormatted(),
      lokasi: document.getElementById('lokasi').value || '',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    const btn = this;
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Mengirim...';

    try {
      const newRef = db.ref('kehadiran').push();
      await newRef.set(payload);
      alert('✅ Kehadiran berhasil dikirim!');
    } catch (err) {
      console.error('Gagal kirim:', err);
      alert('❌ Gagal kirim. Periksa koneksi atau rules Firebase.\n\n' + (err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  // realtime listener untuk dashboard & recent
  db.ref('kehadiran').on('value', snap => {
    const data = snap.val() || {};
    const today = nowFormatted();
    const arr = Object.values(data);
    const hadir = arr.filter(x => x.tanggal === today && x.status === 'Hadir').length;
    const lain = arr.filter(x => x.tanggal === today && x.status !== 'Hadir').length;

    document.getElementById('totalGuru').textContent = teachers.length;
    document.getElementById('totalHadir').textContent = String(hadir);
    document.getElementById('totalLain').textContent = String(lain);

    updateChartCounts(hadir, lain);

    const recent = document.getElementById('recent-activity');
    recent.innerHTML = '';
    const sorted = Object.values(data).sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)).slice(0,12);
    if (!sorted.length) recent.innerHTML = '<p class="text-gray-400">Belum ada aktivitas.</p>';
    else sorted.forEach(it => {
      const p = document.createElement('p');
      const jam = it.jam || new Date(it.timestamp).toLocaleTimeString('id-ID');
      p.className = 'text-gray-700'; p.textContent = `${jam} — ${it.nama} — ${it.status}`;
      recent.appendChild(p);
    });
  });

  // laporan & export
  document.getElementById('tampilkanLaporanBtn').addEventListener('click', async () => {
    const month = document.getElementById('bulan').value;
    if (!month) return alert('Pilih bulan dahulu.');
    const snap = await db.ref('kehadiran').once('value');
    const data = snap.val() || {};
    const rows = Object.values(data).filter(d => d.tanggal && d.tanggal.startsWith(month));
    const tbodyEl = document.getElementById('laporanTableBody'); tbodyEl.innerHTML = '';
    if (!rows.length) { tbodyEl.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Tidak ada data bulan ini.</td></tr>'; document.getElementById('resume-laporan').textContent=''; return; }
    rows.sort((a,b)=> (a.tanggal + (a.jam||'')).localeCompare(b.tanggal + (b.jam||'')));
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="border p-2">${r.tanggal}</td><td class="border p-2">${r.nama}</td><td class="border p-2">${r.jam||'-'}</td><td class="border p-2">${r.lokasi||'-'}</td><td class="border p-2">${r.status}</td>`;
      tbodyEl.appendChild(tr);
    });
    document.getElementById('resume-laporan').textContent = `Menampilkan ${rows.length} catatan untuk ${month}`;
  });

  document.getElementById('exportLaporanBtn').addEventListener('click', () => {
    const tbody = document.getElementById('laporanTableBody');
    const rows = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const cols = [...tr.children].map(td => td.textContent.trim());
      if (cols.length) rows.push(cols);
    });
    if (!rows.length) return alert('Tidak ada data untuk diexport.');
    const ws = XLSX.utils.aoa_to_sheet([['Tanggal','Nama Guru','Jam','Lokasi','Status'], ...rows]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, 'Laporan-Kehadiran.xlsx');
  });

  // init chart
  initChart();
});

// chart functions
let dashboardChart = null;
function initChart(){
  const ctx = document.getElementById('chartDashboard').getContext('2d');
  dashboardChart = new Chart(ctx, { type:'doughnut', data:{ labels:['Hadir','Izin/Sakit/Dinas'], datasets:[{ data:[0,0] }] } });
}
function updateChartCounts(hadir, lain){
  if (!dashboardChart) return;
  dashboardChart.data.datasets[0].data = [hadir, lain];
  dashboardChart.update();
}

// clock/date
function setCurrentDate(){
  const now = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const el = document.getElementById('current-date');
  if (el) el.textContent = now.toLocaleDateString('id-ID', opts);
}
function drawClock(){
  const c = document.getElementById('analogClock'); if (!c) return;
  const ctx = c.getContext('2d'); const r = c.width/2; ctx.clearRect(0,0,c.width,c.height); ctx.save(); ctx.translate(r,r);
  ctx.strokeStyle='#1e3a8a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,r-4,0,2*Math.PI); ctx.stroke();
  const now = new Date(); const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours()%12;
  ctx.rotate((Math.PI/6)*(hr + min/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.5); ctx.stroke(); ctx.rotate(-(Math.PI/6)*(hr + min/60));
  ctx.rotate((Math.PI/30)*(min + sec/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.75); ctx.stroke(); ctx.rotate(-(Math.PI/30)*(min + sec/60));
  ctx.strokeStyle='#ef4444'; ctx.rotate((Math.PI/30)*sec); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.85); ctx.stroke(); ctx.restore();
}
