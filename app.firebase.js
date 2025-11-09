// app.firebase.js (fixed) — sync gurus & kehadiran, reverse geocode singkat 📍

// ================= FIREBASE CONFIG =================
// <-- GANTI dengan config Anda jika berbeda. Saya pakai values yang Anda upload sebelumnya.
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

// init firebase (compat global)
if (!window.firebase || !window.firebase.initializeApp) {
  console.error('Firebase SDK tidak ditemukan. Pastikan script compat dimuat (firebase-app-compat.js).');
} else {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// small helpers
function nowFormatted(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function timeFormatted(){ return new Date().toTimeString().split(' ')[0]; }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"}[c])); }

// DOM refs (exist di index.html)
const namaSel = document.getElementById('namaGuru');
const lokasiEl = document.getElementById('lokasi');
const statusSel = document.getElementById('statusKehadiran');
const kirimBtn = document.getElementById('kirimKehadiranBtn');
const guruTbody = document.getElementById('guruTableBody');
const recentDiv = document.getElementById('recent-activity');
const totalGuruEl = document.getElementById('totalGuru');
const totalHadirEl = document.getElementById('totalHadir');
const totalLainEl = document.getElementById('totalLain');
const chartCanvas = document.getElementById('chartDashboard');

if (!db) {
  console.error('Realtime DB not initialized.');
}

// RENDER helpers
function renderGurus(list){
  // dropdown
  if (namaSel) {
    namaSel.innerHTML = '<option value="">-- Pilih Guru --</option>';
    list.forEach(g=>{
      const opt = document.createElement('option');
      opt.value = `${g.nip||g.id}|${g.nama||g.name||''}`;
      opt.textContent = (g.nama||g.name||'') + (g.jabatan ? ' — ' + g.jabatan : '');
      namaSel.appendChild(opt);
    });
  }
  // table
  if (guruTbody){
    if (!list.length) guruTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-gray-500">Belum ada guru.</td></tr>';
    else {
      guruTbody.innerHTML = '';
      list.forEach(g=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="p-2 border">${escapeHtml(g.nip||'')}</td>
                        <td class="p-2 border">${escapeHtml(g.nama||g.name||'')}</td>
                        <td class="p-2 border">${escapeHtml(g.jabatan||'')}</td>`;
        guruTbody.appendChild(tr);
      });
    }
  }
}

// realtime sync /gurus
function snapshotToArray(obj){
  if (!obj) return [];
  return Object.keys(obj).map(k => Object.assign({ id: k }, obj[k]));
}
function startGuruSync(){
  if (!db) return;
  db.ref('gurus').on('value', snap=>{
    const raw = snap.val() || {};
    const list = snapshotToArray(raw).map(it=>({
      id: it.id,
      nip: it.nip || it.NIP || '',
      nama: it.nama || it.name || '',
      jabatan: it.jabatan || it.position || '',
      status: it.status || 'Aktif'
    }));
    // cache for UI
    window.__latest_guru_list = list;
    try { localStorage.setItem('wh_guru_list_v1', JSON.stringify(list)); } catch(e){}
    renderGurus(list);
    // dispatch event for other scripts if needed
    try { window.dispatchEvent(new CustomEvent('gurus-updated',{detail:list})); }catch(e){}
    // update total if element exists
    if (totalGuruEl) totalGuruEl.textContent = String(list.length);
  }, err=>{
    console.error('Error listening /gurus', err);
  });
}

// send attendance
if (kirimBtn) {
  kirimBtn.addEventListener('click', async function(){
    const selVal = (namaSel && namaSel.value) || '';
    const status = (statusSel && statusSel.value) || '';
    if (!selVal) return alert('Pilih nama guru terlebih dahulu.');
    if (!status) return alert('Pilih status kehadiran.');
    const [nip,name] = selVal.split('|');
    const payload = {
      nip: nip || '',
      nama: name || '',
      status,
      jam: timeFormatted(),
      tanggal: nowFormatted(),
      lokasi: (lokasiEl && lokasiEl.value) ? lokasiEl.value : '',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    const btn = this; const orig = btn.innerHTML;
    try {
      btn.disabled = true; btn.innerHTML = 'Mengirim...';
      await db.ref('kehadiran').push(payload);
      if (document.getElementById('kehadiran-status')) document.getElementById('kehadiran-status').textContent = '✅ Terkirim!';
      setTimeout(()=>{ if (document.getElementById('kehadiran-status')) document.getElementById('kehadiran-status').textContent = '—'; }, 2400);
    } catch(err){
      console.error('Gagal kirim', err);
      alert('Gagal kirim: ' + (err && err.message ? err.message : String(err)));
    } finally { btn.disabled = false; btn.innerHTML = orig; }
  });
}

// realtime listener for kehadiran to update chart & recent
let dashboardChart = null;
function initChart(){
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  dashboardChart = new Chart(ctx, { type:'doughnut', data:{ labels:['Hadir','Izin/Sakit/Dinas'], datasets:[{ data:[0,0] }] }, options:{ maintainAspectRatio:false } });
}
function updateChartCounts(hadir, lain){
  if (!dashboardChart) return;
  dashboardChart.data.datasets[0].data = [hadir, lain];
  dashboardChart.update();
}
function startKehadiranListener(){
  if (!db) return;
  db.ref('kehadiran').on('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data);
    const today = nowFormatted();
    const hadir = arr.filter(x => x.tanggal === today && x.status === 'Hadir').length;
    const lain = arr.filter(x => x.tanggal === today && x.status !== 'Hadir').length;
    if (totalHadirEl) totalHadirEl.textContent = String(hadir);
    if (totalLainEl) totalLainEl.textContent = String(lain);
    updateChartCounts(hadir, lain);

    // recent
    if (recentDiv) {
      recentDiv.innerHTML = '';
      const sorted = Object.values(data).sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)).slice(0,12);
      if (!sorted.length) recentDiv.innerHTML = '<p class="text-gray-400">Belum ada aktivitas.</p>';
      else sorted.forEach(it=>{
        const p = document.createElement('p');
        const jam = it.jam || new Date(it.timestamp).toLocaleTimeString('id-ID');
        p.className = 'text-sm';
        p.textContent = `${jam} — ${it.nama} — ${it.status}`;
        recentDiv.appendChild(p);
      });
    }
  }, err => console.error('Error listening kehadiran', err));
}

// ----------------- Reverse Geocode (singkat) -----------------
async function reverseGeocodeShort(lat, lon){
  try {
    // Nominatim usage: add a small "accept-language" to prefer Indonesian results
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'WebsiteHadir/1.0 (contact: no-reply@example.com)' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data && data.address) {
      const addr = data.address;
      const daerah = addr.suburb || addr.village || addr.town || addr.city || addr.county || addr.region || addr.state || '';
      const prov = addr.state || '';
      if (daerah && prov) return `📍 ${daerah}, ${prov}`;
      if (daerah) return `📍 ${daerah}`;
      if (prov) return `📍 ${prov}`;
    }
    return `${lat}, ${lon}`;
  } catch (e) {
    console.warn('reverseGeocodeShort failed', e);
    return `${lat}, ${lon}`;
  }
}

// geolocation -> short location
function initLocationAuto(){
  if (!lokasiEl) return;
  if (!navigator.geolocation) {
    lokasiEl.value = 'GPS tidak tersedia';
    return;
  }
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat = pos.coords.latitude.toFixed(6);
    const lon = pos.coords.longitude.toFixed(6);
    lokasiEl.value = '📍 Mencari lokasi...';
    const short = await reverseGeocodeShort(lat, lon);
    lokasiEl.value = short;
  }, err=>{
    console.warn('geolocation error', err);
    lokasiEl.value = 'Lokasi tidak ditemukan';
  }, { enableHighAccuracy:true, timeout:10000 });
}

// BOOT
document.addEventListener('DOMContentLoaded', () => {
  try { initLocationAuto(); } catch(e){ console.warn(e); }
  initChart();
  startGuruSync();
  startKehadiranListener();
  console.log('app.firebase.js started');
});
