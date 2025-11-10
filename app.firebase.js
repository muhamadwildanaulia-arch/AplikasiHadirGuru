// app.firebase.js — Versi lengkap (sinkronisasi guru, kehadiran, offline queue, GPS + reverse geocode)
// Catatan: Pastikan index.html sudah berisi elemen-elemen dengan ID yang dipakai:
// namaGuru, statusKehadiran, lokasi, coords-small, btn-use-gps, kirimKehadiranBtn, guruTableBody,
// totalGuru, totalHadir, totalLain, chartDashboard, recent-activity, bulan, tampilkanLaporanBtn, exportLaporanBtn

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

// Init Firebase (compat)
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

// localStorage keys
const KEY_GURU = 'wh_guru_list_v1';
const KEY_PENDING = 'wh_pending_kehadiran';
const KEY_LOC_CACHE = 'wh_last_location_name';

// Save list guru to localStorage
function saveGuruListToLocal(list){
  try { localStorage.setItem(KEY_GURU, JSON.stringify(list)); } catch(e){ console.warn('saveGuruListToLocal failed', e); }
}

// Convert Firebase snapshot object to array
function snapshotToArray(obj){
  if (!obj) return [];
  return Object.keys(obj).map(k => Object.assign({ id: k }, obj[k]));
}

// ----------------- UI render for Guru -----------------
function renderGuruUi(list){
  // dropdown
  const sel = document.getElementById('namaGuru');
  if (sel) {
    sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
    (list||[]).forEach(g => {
      const opt = document.createElement('option');
      opt.value = `${g.nip||g.id}|${g.nama||g.name||''}`;
      opt.textContent = (g.nama||g.name||'') + (g.jabatan ? ' — ' + g.jabatan : '');
      sel.appendChild(opt);
    });
  }

  // table: NIP, Nama, Jabatan, Status, Aksi
  const tbody = document.getElementById('guruTableBody');
  if (tbody) {
    if (!Array.isArray(list) || !list.length){
      tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Belum ada guru terdaftar.</td></tr>';
    } else {
      tbody.innerHTML = '';
      list.forEach(g => {
        const tr = document.createElement('tr');
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
  ref.on('value', snapshot => {
    const raw = snapshot.val() || {};
    const list = snapshotToArray(raw);
    const normalized = list.map(it => ({
      id: it.id,
      nip: it.nip || it.NIP || '',
      nama: it.nama || it.name || '',
      jabatan: it.jabatan || it.position || it.jabatan || '',
      status: it.status || 'Aktif'
    }));
    try { renderGuruUi(normalized); } catch(e){ console.warn('renderGuruUi failed', e); }
    saveGuruListToLocal(normalized);
    try { window.dispatchEvent(new CustomEvent('gurus-updated', { detail: normalized })); } catch(e){}
  }, err => {
    console.error('Firebase /gurus listen error', err);
  });
}

// ----------------- Firebase CRUD functions (exposed on window) -----------------
async function addGuruFirebase(data){
  if (!db) throw new Error('Firebase DB tidak tersedia');
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
window.addGuruFirebase = addGuruFirebase;
window.updateGuruFirebase = updateGuruFirebase;
window.deleteGuruFirebase = deleteGuruFirebase;
window.syncFromFirebase = syncFromFirebase;

// ----------------- Location: GPS button + reverse geocode + cache -----------------
(function setupLocationWithGpsButton(){
  const lokasiEl = document.getElementById('lokasi');
  const coordsSmallEl = document.getElementById('coords-small');
  const btnGps = document.getElementById('btn-use-gps');
  const btnGpsIcon = document.getElementById('btn-gps-icon');
  const btnGpsLabel = document.getElementById('btn-gps-label');
  const CACHE_KEY = KEY_LOC_CACHE;
  const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 jam

  if (!lokasiEl) return;

  function setGpsBusy(isBusy){
    if (!btnGps) return;
    btnGps.disabled = isBusy;
    if (btnGpsIcon) btnGpsIcon.style.opacity = isBusy ? '0.6' : '1';
    if (btnGpsLabel) btnGpsLabel.textContent = isBusy ? 'Mencari...' : 'Gunakan GPS';
  }
  function setCoordsText(lat, lng){
    if (coordsSmallEl) coordsSmallEl.textContent = `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  async function reverseGeocode(lat, lng){
    try {
      // cache read
      try {
        const cacheRaw = localStorage.getItem(CACHE_KEY);
        if (cacheRaw) {
          const parsed = JSON.parse(cacheRaw);
          if (parsed && parsed.lat && Math.abs(parsed.lat - lat) < 0.0005 && parsed.lng && Math.abs(parsed.lng - lng) < 0.0005 && (Date.now() - parsed._ts) < CACHE_TTL_MS) {
            return parsed.name;
          }
        }
      } catch(e){ /* ignore */ }

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&accept-language=id`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const name = (data && data.display_name) ? data.display_name : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ name, lat, lng, _ts: Date.now() })); } catch(e){}
      return name;
    } catch(err){
      console.warn('Reverse geocode failed', err);
      return null;
    }
  }

  (function tryLoadCached(){
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.name) {
        lokasiEl.value = c.name;
        if (coordsSmallEl && c.lat && c.lng) coordsSmallEl.textContent = `Koordinat: ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} (cached)`;
        return;
      }
      lokasiEl.value = 'Tekan "Gunakan GPS" untuk mendeteksi lokasi';
      if (coordsSmallEl) coordsSmallEl.textContent = '—';
    } catch(e){
      lokasiEl.value = 'Tekan "Gunakan GPS" untuk mendeteksi lokasi';
      if (coordsSmallEl) coordsSmallEl.textContent = '—';
    }
  })();

  async function useGpsNow(){
    if (!navigator.geolocation) {
      lokasiEl.value = 'Browser tidak mendukung geolokasi';
      if (coordsSmallEl) coordsSmallEl.textContent = '';
      return;
    }
    setGpsBusy(true);
    if (coordsSmallEl) coordsSmallEl.textContent = 'Meminta izin lokasi...';
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 });
      });
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setCoordsText(lat, lng);
      const name = await reverseGeocode(lat, lng);
      if (name) {
        lokasiEl.value = name;
        if (window.toast) try { window.toast('📍 Lokasi terdeteksi: ' + (name.split(',')[0] || 'lokasi') , 'ok'); } catch(e){}
      } else {
        lokasiEl.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        if (window.toast) try { window.toast('📍 Lokasi: hanya koordinat tersedia', 'info'); } catch(e){}
      }
    } catch(err){
      console.warn('useGpsNow error', err);
      if (err && err.code === 1) {
        lokasiEl.value = 'Izin lokasi ditolak — aktifkan lokasi di browser';
        if (coordsSmallEl) coordsSmallEl.textContent = '';
        if (window.toast) try { window.toast('Izin lokasi ditolak', 'err'); } catch(e){}
      } else if (err && err.code === 3) {
        lokasiEl.value = 'Waktu ambil lokasi habis (timeout)';
        if (coordsSmallEl) coordsSmallEl.textContent = '';
        if (window.toast) try { window.toast('Timeout saat mengambil lokasi', 'err'); } catch(e){}
      } else {
        lokasiEl.value = 'Gagal mendapatkan lokasi';
        if (coordsSmallEl) coordsSmallEl.textContent = '';
        if (window.toast) try { window.toast('Gagal mendeteksi lokasi', 'err'); } catch(e){}
      }
    } finally {
      setGpsBusy(false);
    }
  }

  if (btnGps) btnGps.addEventListener('click', useGpsNow);
  window.useGpsForLocation = useGpsNow;

})();

// ----------------- Kehadiran: enhanced send + offline queue -----------------
(function setupKehadiranQueue(){
  function loadPending(){ try { return JSON.parse(localStorage.getItem(KEY_PENDING) || '[]'); } catch(e){ return []; } }
  function savePending(arr){ try { localStorage.setItem(KEY_PENDING, JSON.stringify(arr)); } catch(e){} }
  function pushPending(item){ const a = loadPending(); a.push(item); savePending(a); updatePendingIndicator(); }
  function popPending(){ const a = loadPending(); if(!a.length) return null; const it = a.shift(); savePending(a); updatePendingIndicator(); return it; }
  function updatePendingIndicator(){
    const pending = loadPending().length;
    const statusEl = document.getElementById('kehadiran-status');
    if(statusEl){
      statusEl.textContent = pending ? `Pending: ${pending} item${pending>1?'s':''}` : '—';
    }
  }

  function addRecentLocal(entry){
    const recent = document.getElementById('recent-activity');
    if (!recent) return;
    const p = document.createElement('p');
    const jam = entry.jam || new Date().toLocaleTimeString('id-ID');
    p.className = 'text-gray-700';
    p.textContent = `${jam} — ${entry.nama||entry.name||entry.nip||'(tanpa nama)'} — ${entry.status}`;
    recent.prepend(p);
    const nodes = recent.querySelectorAll('p');
    if (nodes.length > 20) nodes[nodes.length-1].remove();
  }

  async function flushOnePending(){
    if (!navigator.onLine) return false;
    const item = popPending();
    if (!item) return false;
    try {
      if (!db) throw new Error('Firebase DB tidak tersedia');
      const ref = db.ref('kehadiran').push();
      await ref.set(Object.assign({}, item, { timestamp: (window.firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
      try { window.toast && window.toast('Pending berhasil dikirim', 'ok'); } catch(e){}
      return true;
    } catch(err){
      const arr = loadPending();
      arr.unshift(item);
      savePending(arr);
      console.warn('flushOnePending failed, re-queued', err);
      return false;
    }
  }

  async function flushAllPending(){
    if (!navigator.onLine) return;
    let worked = false;
    while (loadPending().length){
      const ok = await flushOnePending();
      if (!ok) break;
      worked = true;
      await new Promise(r => setTimeout(r, 300));
    }
    if (worked) updatePendingIndicator();
  }

  window.addEventListener('online', () => {
    try { window.toast && window.toast('Koneksi kembali — mencoba mengirim antrian...', 'info'); } catch(e){}
    flushAllPending();
  });
  window.addEventListener('offline', () => {
    try { window.toast && window.toast('Anda offline — kehadiran akan disimpan sementara', 'err'); } catch(e){}
    updatePendingIndicator();
  });

  updatePendingIndicator();

  // main send handler
  const kirimBtn = document.getElementById('kirimKehadiranBtn');
  if (kirimBtn) {
    kirimBtn.addEventListener('click', async function(){
      const selVal = document.getElementById('namaGuru')?.value;
      const status = document.getElementById('statusKehadiran')?.value;
      if (!selVal) { window.toast ? window.toast('Pilih nama guru terlebih dahulu', 'err') : alert('Pilih nama guru terlebih dahulu.'); return; }
      if (!status) { window.toast ? window.toast('Pilih status kehadiran', 'err') : alert('Pilih status kehadiran.'); return; }

      const [nip, name] = selVal.split('|');
      const lokasiVal = document.getElementById('lokasi')?.value || '';
      try { /* no manual placeName now */ } catch(e){}

      const payload = {
        nip: nip || '',
        nama: (name || '').trim(),
        status,
        jam: timeFormatted(),
        tanggal: nowFormatted(),
        lokasi: lokasiVal
      };

      const btn = this;
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Mengirim...';
      const statusEl = document.getElementById('kehadiran-status');
      if (statusEl) statusEl.textContent = 'Mengirim...';

      function finalize(success){
        btn.disabled = false;
        btn.innerHTML = orig;
        if (success) {
          if (window.toast) window.toast('Kehadiran berhasil dikirim', 'ok');
          else alert('Kehadiran berhasil dikirim!');
        }
        updatePendingIndicator();
      }

      try {
        if (navigator.onLine && db) {
          const newRef = db.ref('kehadiran').push();
          await newRef.set(Object.assign({}, payload, { timestamp: (window.firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
          addRecentLocal(payload);
          finalize(true);
        } else {
          pushPending(payload);
          addRecentLocal(payload);
          if (window.toast) window.toast('Kehadiran disimpan ke antrian (offline)', 'info');
          finalize(false);
        }
      } catch (err) {
        console.error('Gagal kirim langsung, akan disimpan ke antrian', err);
        pushPending(payload);
        addRecentLocal(payload);
        if (window.toast) window.toast('Kesalahan jaringan — data disimpan sementara', 'err');
        finalize(false);
      }
    });
  }

  window.flushPendingKehadiran = flushAllPending;

})();

// ----------------- Chart & Kehadiran realtime listener -----------------
(function initKehadiranListeners(){
  // Chart init
  try {
    const canvas = document.getElementById('chartDashboard');
    if (canvas && window.Chart) {
      window.dashboardChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Hadir','Izin/Sakit/Dinas'], datasets: [{ data: [0,0] }] },
        options: { responsive:true, maintainAspectRatio:false, plugins: { legend:{ position:'bottom' } } }
      });
    }
  } catch(e){ console.warn('init chart failed', e); }

  // Kehadiran listener
  if (!db) {
    console.warn('DB not available — kehadiran realtime not attached');
    return;
  }
  db.ref('kehadiran').on('value', snap => {
    const data = snap.val() || {};
    const today = nowFormatted();
    const arr = Array.isArray(data) ? data : Object.values(data || {});
    const hadir = arr.filter(x => x && x.tanggal === today && x.status === 'Hadir').length;
    const lain = arr.filter(x => x && x.tanggal === today && x.status !== 'Hadir').length;

    // update counts
    const totalGuruEl = document.getElementById('totalGuru');
    if (totalGuruEl) {
      try {
        const local = JSON.parse(localStorage.getItem(KEY_GURU) || '[]');
        totalGuruEl.textContent = String(Array.isArray(local) ? local.length : 0);
      } catch(e){ totalGuruEl.textContent = String(0); }
    }
    const totalHadirEl = document.getElementById('totalHadir'); if (totalHadirEl) totalHadirEl.textContent = String(hadir);
    const totalLainEl = document.getElementById('totalLain'); if (totalLainEl) totalLainEl.textContent = String(lain);

    // update chart
    try {
      if (window.dashboardChart) {
        window.dashboardChart.data.datasets[0].data = [hadir, lain];
        window.dashboardChart.update();
      }
    } catch(e){ console.warn('update chart failed', e); }

    // recent activity
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
})();

// ----------------- Laporan / Export -----------------
document.addEventListener('DOMContentLoaded', () => {
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
});

// ----------------- Clock functions -----------------
function setCurrentDate(){
  const now = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const elTop = document.getElementById('current-date-top');
  if (elTop) elTop.textContent = now.toLocaleDateString('id-ID', opts);
  const el = document.getElementById('current-date');
  if (el) el.textContent = now.toLocaleDateString('id-ID', opts);
}
function drawClock(){
  const small = document.getElementById('clock-small');
  if (small) small.textContent = new Date().toLocaleTimeString('id-ID');
  const c = document.getElementById('analogClock'); if (!c) return;
  try {
    const ctx = c.getContext('2d'); const r = c.width/2; ctx.clearRect(0,0,c.width,c.height); ctx.save(); ctx.translate(r,r);
    ctx.strokeStyle='#1e3a8a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,r-4,0,2*Math.PI); ctx.stroke();
    const now = new Date(); const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours()%12;
    ctx.rotate((Math.PI/6)*(hr + min/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.5); ctx.stroke(); ctx.rotate(-(Math.PI/6)*(hr + min/60));
    ctx.rotate((Math.PI/30)*(min + sec/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.75); ctx.stroke(); ctx.rotate(-(Math.PI/30)*(min + sec/60));
    ctx.strokeStyle='#ef4444'; ctx.rotate((Math.PI/30)*sec); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.85); ctx.stroke(); ctx.restore();
  } catch(e){ console.warn('drawClock error', e); }
}

// ----------------- Boot helpers -----------------
(function boot(){
  // quick init of date/clock
  try { setCurrentDate(); drawClock(); setInterval(()=>{ setCurrentDate(); drawClock(); },1000); } catch(e){}
  // initial render from localStorage for quick UI
  try {
    const local = JSON.parse(localStorage.getItem(KEY_GURU) || '[]');
    if (local && local.length) { renderGuruUi(local); }
  } catch(e){}
  // try attach guru sync
  try { if (db) syncFromFirebase(); } catch(e){ console.warn('syncFromFirebase error', e); }
})();
