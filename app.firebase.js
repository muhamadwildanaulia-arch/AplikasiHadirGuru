// app.firebase.js — versi sinkronisasi daftar guru ke Firebase (Mode A)
// Perbaikan: sinkronisasi UI revamp, ID elemen konsisten, chart global, dan table col count.

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

// init firebase (compat)
try {
  if (!window.firebase || !window.firebase.initializeApp) {
    console.error('Firebase SDK tidak ditemukan. Pastikan firebase compat scripts sudah di-include di index.html');
  } else {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  }
} catch (e) {
  console.error('Init firebase error', e);
}
const db = (window.firebase && firebase.database) ? firebase.database() : null;

// ----------------- Helpers -----------------
function nowFormatted() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function timeFormatted() {
  return new Date().toTimeString().split(' ')[0];
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"}[c])); }

// localStorage key (ke-admin script kompatibel)
const KEY_GURU = 'wh_guru_list_v1';

// utility: simpan list guru ke localStorage (dipakai supaya admin script lokal tetap berfungsi)
function saveGuruListToLocal(list){
  try { localStorage.setItem(KEY_GURU, JSON.stringify(list)); } catch(e){ console.warn('saveGuruListToLocal failed', e); }
}

// utility: convert snapshot val to array of { id, nip, nama, jabatan, ... }
function snapshotToArray(obj){
  if (!obj) return [];
  return Object.keys(obj).map(k => Object.assign({ id: k }, obj[k]));
}

// render dropdown #namaGuru and table #guruTableBody from list array
function renderGuruUi(list){
  // dropdown
  const sel = document.getElementById('namaGuru');
  if (sel) {
    sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
    list.forEach(g => {
      const opt = document.createElement('option');
      // store value as "nip|name" to keep existing behavior
      opt.value = `${g.nip||g.id}|${g.nama||g.name||''}`;
      opt.textContent = (g.nama||g.name||'') + (g.jabatan ? ' — ' + g.jabatan : '');
      sel.appendChild(opt);
    });
  }

  // table: match header in UI (NIP, Nama Guru, Jabatan, Status, Aksi)
  const tbody = document.getElementById('guruTableBody');
  if (tbody) {
    if (!list.length){
      tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Belum ada guru terdaftar.</td></tr>';
    } else {
      tbody.innerHTML = '';
      list.forEach(g => {
        const tr = document.createElement('tr');
        // Aksi: kosong/placeholder — admin UI akan menambah tombol bila aktif
        tr.innerHTML = `<td class="border p-2">${escapeHtml(g.nip||'')}</td>
                        <td class="border p-2">${escapeHtml(g.nama||g.name||'')}</td>
                        <td class="border p-2">${escapeHtml(g.jabatan||'')}</td>
                        <td class="border p-2">${escapeHtml(g.status||'Aktif')}</td>
                        <td class="border p-2">${''}</td>`;
        tbody.appendChild(tr);
      });
    }
  }
}

// ----------------- Firebase: realtime sync for /gurus -----------------
function syncFromFirebase(){
  if (!db) { console.warn('Realtime DB tidak tersedia — syncFromFirebase dibatalkan'); return; }
  const ref = db.ref('gurus');
  // listen for realtime updates
  ref.on('value', snapshot => {
    const raw = snapshot.val() || {};
    const list = snapshotToArray(raw);
    // normalize fields: prefer 'nama' or 'name'
    const normalized = list.map(it => ({
      id: it.id,
      nip: it.nip || it.NIP || '',
      nama: it.nama || it.name || '',
      jabatan: it.jabatan || it.position || it.jabatan || '',
      status: it.status || 'Aktif'
    }));
    // update UI
    try { renderGuruUi(normalized); } catch(e){ console.warn('renderGuruUi failed', e); }
    // save local for admin script compatibility
    saveGuruListToLocal(normalized);
    // dispatch event so admin script (if listening) can react
    try { window.dispatchEvent(new CustomEvent('gurus-updated', { detail: normalized })); } catch(e) {}
  }, err => {
    console.error('Firebase /gurus listen error', err);
  });
}

// ----------------- Firebase CRUD functions (exposed on window) -----------------
async function addGuruFirebase(data){
  if (!db) throw new Error('Firebase DB tidak tersedia');
  // data expected: { nip, nama, jabatan, status? }
  const ref = db.ref('gurus').push();
  await ref.set({
    nip: data.nip || '',
    nama: data.nama || data.name || '',
    jabatan: data.jabatan || '',
    status: data.status || 'Aktif',
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
  return ref.key;
}
async function updateGuruFirebase(id, data){
  if (!db) throw new Error('Firebase DB tidak tersedia');
  if (!id) throw new Error('id required');
  await db.ref('gurus/' + id).update(Object.assign({}, {
    nip: data.nip,
    nama: data.nama,
    jabatan: data.jabatan,
    status: data.status
  }));
}
async function deleteGuruFirebase(id){
  if (!db) throw new Error('Firebase DB tidak tersedia');
  if (!id) throw new Error('id required');
  await db.ref('gurus/' + id).remove();
}

// expose to window so admin script can call them
window.addGuruFirebase = addGuruFirebase;
window.updateGuruFirebase = updateGuruFirebase;
window.deleteGuruFirebase = deleteGuruFirebase;
window.syncFromFirebase = syncFromFirebase;

// ----------------- Existing kehadiran logic (kirim & dashboard) -----------------
document.addEventListener('DOMContentLoaded', () => {

  // NOTE: the HTML revamp controls navigation via data-page buttons and
  // the UI script already provides showPage(...) etc. So we DO NOT
  // try to wire ".tab-button" here to avoid conflicts.

  // clock & date (update top date element IDs consistent with UI)
  try {
    setCurrentDate();
    drawClock();
    setInterval(()=>{ drawClock(); setCurrentDate(); }, 1000);
  } catch(e){ console.warn('clock/date init failed', e); }

  // geolocation fill once — tampilkan nama tempat bila ada, tetap simpan coords
  const lokasiEl = document.getElementById('lokasi');
  const coordsSmallEl = document.getElementById('coords-small');
  const placeNameEl = document.getElementById('placeName');

  try {
    const savedPlace = localStorage.getItem('wh_place_name') || '';
    if (placeNameEl && savedPlace) placeNameEl.value = savedPlace;
  } catch(e){ /* ignore */ }

  function showLocationDisplay(lat, lng){
    const coordsText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const saved = (placeNameEl && placeNameEl.value && placeNameEl.value.trim()) ? placeNameEl.value.trim() : '';
    if (lokasiEl) lokasiEl.value = saved || coordsText;
    if (coordsSmallEl) coordsSmallEl.textContent = 'Koordinat: ' + coordsText;
  }

  if (navigator.geolocation && lokasiEl) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      showLocationDisplay(lat, lng);
    }, (err) => { console.warn('Geolocation gagal:', err && err.message); }, { timeout: 7000 });
  }

  if (placeNameEl) {
    placeNameEl.addEventListener('change', (e) => {
      try { localStorage.setItem('wh_place_name', e.target.value || ''); } catch(e){}
      const coordsText = coordsSmallEl?.textContent?.replace('Koordinat: ','') || '';
      if (coordsText && coordsText.includes(',')) {
        const parts = coordsText.split(',').map(s=>s.trim());
        const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) showLocationDisplay(lat, lng);
      } else {
        if (lokasiEl) lokasiEl.value = placeNameEl.value || '';
      }
    });
  }

  // send attendance (keep previous behavior)
  const kirimBtn = document.getElementById('kirimKehadiranBtn');
  if (kirimBtn) {
    kirimBtn.addEventListener('click', async function(){
      const selVal = document.getElementById('namaGuru')?.value;
      const status = document.getElementById('statusKehadiran')?.value;
      if (!selVal) return alert('Pilih nama guru terlebih dahulu.');
      if (!status) return alert('Pilih status kehadiran.');

      const [nip, name] = selVal.split('|');
      const payload = {
        nip,
        nama: name,
        status,
        jam: timeFormatted(),
        tanggal: nowFormatted(),
        lokasi: document.getElementById('lokasi')?.value || '',
        timestamp: (window.firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
      };

      const btn = this;
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Mengirim...';

      try {
        if (!db) throw new Error('Firebase DB tidak tersedia');
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
  }

  // laporan & export
  const tampilBtn = document.getElementById('tampilkanLaporanBtn');
  if (tampilBtn) {
    tampilBtn.addEventListener('click', async () => {
      const month = document.getElementById('bulan')?.value;
      if (!month) return alert('Pilih bulan dahulu.');
      if (!db) return alert('Firebase DB tidak tersedia.');
      const snap = await db.ref('kehadiran').once('value');
      const data = snap.val() || {};
      const rows = Object.values(data).filter(d => d.tanggal && d.tanggal.startsWith(month));
      const tbodyEl = document.getElementById('laporanTableBody'); if (tbodyEl) tbodyEl.innerHTML = '';
      if (!rows.length) { if (tbodyEl) tbodyEl.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Tidak ada data bulan ini.</td></tr>'; document.getElementById('resume-laporan').textContent=''; return; }
      rows.sort((a,b)=> (a.tanggal + (a.jam||'')).localeCompare(b.tanggal + (b.jam||'')));
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="border p-2">${r.tanggal}</td><td class="border p-2">${r.nama}</td><td class="border p-2">${r.jam||'-'}</td><td class="border p-2">${r.lokasi||'-'}</td><td class="border p-2">${r.status}</td>`;
        tbodyEl.appendChild(tr);
      });
      document.getElementById('resume-laporan').textContent = `Menampilkan ${rows.length} catatan untuk ${month}`;
    });
  }

  const exportBtn = document.getElementById('exportLaporanBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const tbody = document.getElementById('laporanTableBody');
      const rows = [];
      if (tbody) {
        tbody.querySelectorAll('tr').forEach(tr => {
          const cols = [...tr.children].map(td => td.textContent.trim());
          if (cols.length) rows.push(cols);
        });
      }
      if (!rows.length) return alert('Tidak ada data untuk diexport.');
      const ws = XLSX.utils.aoa_to_sheet([['Tanggal','Nama Guru','Jam','Lokasi','Status'], ...rows]);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, 'Laporan-Kehadiran.xlsx');
    });
  }

  // init chart & realtime listener for kehadiran
  initChart();
  if (db) {
    db.ref('kehadiran').on('value', snap => {
      const data = snap.val() || {};
      const today = nowFormatted();
      const arr = Object.values(data || {});
      const hadir = arr.filter(x => x.tanggal === today && x.status === 'Hadir').length;
      const lain = arr.filter(x => x.tanggal === today && x.status !== 'Hadir').length;

      // update counts UI
      const totalGuruEl = document.getElementById('totalGuru');
      if (totalGuruEl) {
        try {
          const local = JSON.parse(localStorage.getItem(KEY_GURU) || '[]');
          totalGuruEl.textContent = String(Array.isArray(local) ? local.length : 0);
        } catch(e){ totalGuruEl.textContent = String(0); }
      }
      const totalHadirEl = document.getElementById('totalHadir'); if (totalHadirEl) totalHadirEl.textContent = String(hadir);
      const totalLainEl = document.getElementById('totalLain'); if (totalLainEl) totalLainEl.textContent = String(lain);

      updateChartCounts(hadir, lain);

      const recent = document.getElementById('recent-activity');
      if (recent) {
        recent.innerHTML = '';
        const sorted = Object.values(data).sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)).slice(0,12);
        if (!sorted.length) recent.innerHTML = '<p class="text-gray-400">Belum ada aktivitas.</p>';
        else sorted.forEach(it => {
          const p = document.createElement('p');
          const jam = it.jam || new Date(it.timestamp).toLocaleTimeString('id-ID');
          p.className = 'text-gray-700'; p.textContent = `${jam} — ${it.nama} — ${it.status}`;
          recent.appendChild(p);
        });
      }
    });
  } else {
    console.warn('DB realtime listener for kehadiran not attached (db is null).');
  }

  // finally: start syncing guru list from firebase
  try {
    if (db) {
      syncFromFirebase();
    } else {
      console.warn('Firebase not initialized - guru list will remain empty or local fallback used.');
    }
  } catch(e) {
    console.error('syncFromFirebase error', e);
  }
});

// ------------- Chart functions (updated to use window.dashboardChart) -------------
function initChart(){
  try {
    const canvas = document.getElementById('chartDashboard');
    if (!canvas) return;
    if (!window.Chart) return;
    const ctx = canvas.getContext('2d');
    window.dashboardChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Hadir','Izin/Sakit/Dinas'], datasets: [{ data: [0,0] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins: { legend:{ position:'bottom' } } }
    });
  } catch(e){ console.warn('initChart failed', e); }
}
function updateChartCounts(hadir, lain){
  try {
    if (!window.dashboardChart) return;
    window.dashboardChart.data.datasets[0].data = [hadir, lain];
    window.dashboardChart.update();
  } catch(e){ console.warn('updateChartCounts failed', e); }
}

// ------------- Clock functions -------------
function setCurrentDate(){
  const now = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const elTop = document.getElementById('current-date-top');
  if (elTop) elTop.textContent = now.toLocaleDateString('id-ID', opts);
  const el = document.getElementById('current-date');
  if (el) el.textContent = now.toLocaleDateString('id-ID', opts);
}
function drawClock(){
  // draw analog clock only if element exists (backwards-compatible)
  const c = document.getElementById('analogClock'); if (!c) {
    // update small digital clock if present
    const small = document.getElementById('clock-small');
    if (small) small.textContent = new Date().toLocaleTimeString('id-ID');
    return;
  }
  try {
    const ctx = c.getContext('2d'); const r = c.width/2; ctx.clearRect(0,0,c.width,c.height); ctx.save(); ctx.translate(r,r);
    ctx.strokeStyle='#1e3a8a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,r-4,0,2*Math.PI); ctx.stroke();
    const now = new Date(); const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours()%12;
    ctx.rotate((Math.PI/6)*(hr + min/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.5); ctx.stroke(); ctx.rotate(-(Math.PI/6)*(hr + min/60));
    ctx.rotate((Math.PI/30)*(min + sec/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.75); ctx.stroke(); ctx.rotate(-(Math.PI/30)*(min + sec/60));
    ctx.strokeStyle='#ef4444'; ctx.rotate((Math.PI/30)*sec); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.85); ctx.stroke(); ctx.restore();
  } catch(e){ console.warn('drawClock error', e); }
}
