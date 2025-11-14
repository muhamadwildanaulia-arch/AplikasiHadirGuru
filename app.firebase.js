// app.firebase.js — final for WebsiteHadir (compat SDK)
// Replace/overwrite previous file. Assumes index.html loads firebase-app-compat.js and firebase-database-compat.js

/* ================= FIREBASE CONFIG ================= */
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

let db = null;
try {
  if (window.firebase && firebase.initializeApp) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    if (firebase.database) db = firebase.database();
    window.db = db; // <- PENTING: expose ke window supaya modul lain yg cek window.db bekerja
    else console.warn('Firebase database compat not available.');
  } else {
    console.warn('Firebase compat SDK tidak ditemukan — operasi DB akan fallback ke localStorage.');
  }
} catch (e) {
  console.error('Init firebase error', e);
  db = null;
}

/* ================= constants & helpers ================= */
const KEY_GURU = 'wh_guru_list_v1';
const KEY_PENDING = 'wh_pending_kehadiran';
const KEY_LOC_CACHE = 'wh_last_location_name';

function nowFormatted(){
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function timeFormatted(){
  return new Date().toTimeString().split(' ')[0];
}
function escapeHtml(s){ if(s === null || s === undefined) return ''; return String(s).replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"}[c])); }

function loadLocalGuru(){ try { return JSON.parse(localStorage.getItem(KEY_GURU) || '[]'); } catch(e){ return []; } }
function saveGuruListToLocal(list){ try { localStorage.setItem(KEY_GURU, JSON.stringify(list)); } catch(e){ console.warn('saveGuruListToLocal failed', e); } }

function snapshotToArray(obj){
  if (!obj) return [];
  return Object.keys(obj).map(k => Object.assign({ id: k }, (obj[k] && typeof obj[k] === 'object') ? obj[k] : {}));
}

/* ================= Render UI: Guru select & table ================= */
function renderGuruUi(list){
  const sel = document.getElementById('namaGuru');
  if (sel) {
    const curVal = sel.value || '';
    sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
    (list||[]).forEach(g => {
      const opt = document.createElement('option');
      opt.value = `${g.nip && g.nip!=='-'?g.nip:g.id}|${g.nama||g.name||''}`;
      opt.textContent = (g.nama||g.name||'') + (g.jabatan ? ' — ' + g.jabatan : '');
      sel.appendChild(opt);
    });
    try { sel.value = curVal; } catch(e){}
  }

  const tbody = document.getElementById('guruTableBody');
  if (tbody) {
    if (!Array.isArray(list) || !list.length){
      tbody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-500">Belum ada guru terdaftar.</td></tr>';
    } else {
      tbody.innerHTML = '';
      list.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="border p-2">${escapeHtml(g.nip||'')}</td>
                        <td class="border p-2">${escapeHtml(g.nama||g.name||'')}</td>
                        <td class="border p-2">${escapeHtml(g.jabatan||'')}</td>
                        <td class="border p-2">${escapeHtml(g.status||'Aktif')}</td>
                        <td class="border p-2"><button data-id="${escapeHtml(g.id||'')}" class="btn-edit-guru text-xs px-2 py-1 rounded bg-slate-100">Edit</button> <button data-id="${escapeHtml(g.id||'')}" class="btn-del-guru text-xs px-2 py-1 rounded bg-rose-50 text-rose-700">Hapus</button></td>`;
        tbody.appendChild(tr);
      });
    }
  }
}
window.renderGuruTable = renderGuruUi;

/* ================= Firebase CRUD: Gurus ================= */
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

/* ================= Sync from Firebase (gurus) ================= */
function syncFromFirebase(){
  if (!db) { console.warn('Realtime DB tidak tersedia — syncFromFirebase dibatalkan'); return; }
  const ref = db.ref('gurus');
  ref.on('value', snapshot => {
    const raw = snapshot.val() || {};
    const list = snapshotToArray(raw).map(it => ({
      id: it.id,
      nip: it.nip || it.NIP || '-',
      nama: it.nama || it.name || '',
      jabatan: it.jabatan || it.position || '',
      status: it.status || 'Aktif'
    }));
    saveGuruListToLocal(list);
    try { renderGuruUi(list); } catch(e){ console.warn('renderGuruUi failed', e); }
    try { window.dispatchEvent(new CustomEvent('gurus-updated', { detail: list })); } catch(e){}
  }, err => {
    console.error('Firebase /gurus listen error', err);
  });
}
window.syncFromFirebase = syncFromFirebase;

/* ================= Image cache (IndexedDB) ================= */
(function setupImageCache(){
  const DB_NAME = 'wh_images_db_v1';
  const STORE = 'images';
  const DB_VER = 1;
  let dbP = null;

  function openDB(){
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      rq.onsuccess = e => res(e.target.result);
      rq.onerror = e => rej(e.target.error || new Error('IndexedDB open failed'));
    });
    return dbP;
  }

  function runTx(storeName, mode, fn){
    return openDB().then(db => new Promise((res, rej) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      fn(store, res, rej);
      tx.oncomplete = () => {};
      tx.onerror = ev => rej(ev.target.error || new Error('Transaction error'));
    }));
  }

  async function fileToDataURLCompressed(file, maxWidth = 1200, quality = 0.75){
    return new Promise((res, rej) => {
      const reader = new FileReader();
      const img = new Image();
      reader.onload = e => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
              if (!blob) return rej(new Error('toBlob failed'));
              const r2 = new FileReader();
              r2.onload = ev2 => res(ev2.target.result);
              r2.onerror = e2 => rej(e2);
              r2.readAsDataURL(blob);
            }, 'image/jpeg', quality);
          } catch(err){ rej(err); }
        };
        img.onerror = err => rej(err);
        img.src = e.target.result;
      };
      reader.onerror = err => rej(err);
      reader.readAsDataURL(file);
    });
  }

  async function saveDataURLToDB(dataURL){
    const id = 'img_' + Date.now() + '_' + Math.floor(Math.random()*9000+1000);
    await runTx(STORE, 'readwrite', (store, resolve, reject) => {
      const rec = { id, dataURL, ts: Date.now() };
      const req = store.add(rec);
      req.onsuccess = () => resolve(id);
      req.onerror = e => reject(e.target.error || new Error('add image failed'));
    });
    return id;
  }

  async function saveImageFromFile(file){
    const dataURL = await fileToDataURLCompressed(file, 1200, 0.75);
    const id = await saveDataURLToDB(dataURL);
    return id;
  }

  async function getImageDataURL(id){
    if (!id) return null;
    return await runTx(STORE, 'readonly', (store, resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const val = req.result;
        resolve(val ? val.dataURL : null);
      };
      req.onerror = e => reject(e.target.error || new Error('get image failed'));
    });
  }

  async function deleteImage(id){
    if (!id) return;
    return await runTx(STORE, 'readwrite', (store, resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = e => reject(e.target.error || new Error('delete failed'));
    });
  }

  async function clearAllImages(){
    return await runTx(STORE, 'readwrite', (store, resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = e => reject(e.target.error || new Error('clear failed'));
    });
  }

  window.__whImageCache = { saveImageFromFile, getImageDataURL, deleteImage, clearAllImages };

  // UI wiring (file input, preview, clear)
  try {
    const input = document.getElementById('photoInput');
    const preview = document.getElementById('photoPreview');
    const btnClear = document.getElementById('btn-clear-photo');
    let currentImageId = null;

    async function showPreviewFromDataURL(dataURL){
      if (!preview) return;
      if (dataURL) { preview.src = dataURL; preview.classList.remove('hidden'); }
      else { preview.src = ''; preview.classList.add('hidden'); }
    }

    if (input) {
      input.addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          const id = await window.__whImageCache.saveImageFromFile(f);
          currentImageId = id;
          const d = await window.__whImageCache.getImageDataURL(id);
          await showPreviewFromDataURL(d);
          try { window.toast && window.toast('Foto disimpan di cache lokal', 'info'); } catch(e){}
        } catch(err){
          console.error('Simpan foto gagal', err);
          try { window.toast && window.toast('Gagal simpan foto', 'err'); } catch(e){}
        }
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (currentImageId) {
          try { await window.__whImageCache.deleteImage(currentImageId); } catch(e){}
          currentImageId = null;
        }
        if (input) input.value = '';
        if (preview) { preview.src=''; preview.classList.add('hidden'); }
        try { if (window.toast) window.toast('Foto dihapus dari cache form', 'info'); } catch(e){}
      });
    }

    window.__whImageCache.getAndClearFormImageId = function(){
      const id = currentImageId;
      currentImageId = null;
      if (input) input.value = '';
      if (preview) { preview.src=''; preview.classList.add('hidden'); }
      return id;
    };

  } catch(e){ console.warn('Image cache UI wiring failed', e); }

})(); // end setupImageCache

/* ================= Location (GPS + reverse geocode with caching) ================= */
(function setupLocation(){
  const lokasiEl = document.getElementById('lokasi');
  const coordsSmallEl = document.getElementById('coords-small');
  const btnGps = document.getElementById('btn-use-gps');
  const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

  function setCoordsText(lat, lng){
    if (coordsSmallEl) coordsSmallEl.textContent = `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  async function reverseGeocode(lat, lng){
    try {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY_LOC_CACHE) || 'null');
        if (raw && raw.lat && Math.abs(raw.lat - lat) < 0.0005 && raw.lng && Math.abs(raw.lng - lng) < 0.0005 && (Date.now() - raw._ts) < CACHE_TTL_MS) {
          return raw.name;
        }
      } catch(e){}
      const emailForNominatim = 'info@sdnmuhara.example'; // <-- GANTI bila perlu
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&accept-language=id&email=${encodeURIComponent(emailForNominatim)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const name = data && data.display_name ? data.display_name : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try { localStorage.setItem(KEY_LOC_CACHE, JSON.stringify({ name, lat, lng, _ts: Date.now() })); } catch(e){}
      return name;
    } catch(err){
      console.warn('reverseGeocode failed', err);
      return null;
    }
  }

  async function useGpsNow(){
    if (!navigator.geolocation) {
      if (lokasiEl) lokasiEl.value = 'Browser tidak mendukung geolokasi';
      if (coordsSmallEl) coordsSmallEl.textContent = '';
      return;
    }
    if (btnGps) { btnGps.disabled = true; btnGps.querySelector && (btnGps.querySelector('#btn-gps-label') && (btnGps.querySelector('#btn-gps-label').textContent = 'Mencari...')); }
    try {
      const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }));
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setCoordsText(lat, lng);
      const name = await reverseGeocode(lat, lng);
      if (name && lokasiEl) lokasiEl.value = name;
      try { window.toast && window.toast('Lokasi terdeteksi', 'ok'); } catch(e){}
    } catch(err){
      console.warn('useGpsNow error', err);
      if (err && err.code === 1) { if (lokasiEl) lokasiEl.value = 'Izin lokasi ditolak'; }
      else if (err && err.code === 3) { if (lokasiEl) lokasiEl.value = 'Timeout saat mendeteksi lokasi'; }
      else { if (lokasiEl) lokasiEl.value = 'Gagal mendapatkan lokasi'; }
      try { window.toast && window.toast('Gagal mendeteksi lokasi', 'err'); } catch(e){}
    } finally {
      if (btnGps) { btnGps.disabled = false; btnGps.querySelector && (btnGps.querySelector('#btn-gps-label') && (btnGps.querySelector('#btn-gps-label').textContent = 'Gunakan GPS')); }
    }
  }

  if (btnGps) btnGps.addEventListener('click', useGpsNow);

  (function tryLoadCached(){
    try {
      const c = JSON.parse(localStorage.getItem(KEY_LOC_CACHE) || 'null');
      if (c && c.name && document.getElementById('lokasi')) {
        document.getElementById('lokasi').value = c.name;
        if (coordsSmallEl && c.lat && c.lng) coordsSmallEl.textContent = `Koordinat: ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} (cached)`;
      }
    } catch(e){}
  })();

})(); // end setupLocation

/* ================= Kehadiran: queue + send + duplicate check ================= */
(function setupKehadiran(){
  function loadPending(){ try { return JSON.parse(localStorage.getItem(KEY_PENDING) || '[]'); } catch(e){ return []; } }
  function savePending(arr){ try { localStorage.setItem(KEY_PENDING, JSON.stringify(arr)); } catch(e){} }
  function pushPending(item){ const a = loadPending(); a.push(item); savePending(a); updatePendingIndicator(); }
  function popPending(){ const a = loadPending(); if (!a.length) return null; const it = a.shift(); savePending(a); updatePendingIndicator(); return it; }
  function updatePendingIndicator(){ const pending = loadPending().length; const statusEl = document.getElementById('kehadiran-status'); if (statusEl) statusEl.textContent = pending ? `Pending: ${pending}` : '—'; }

  async function alreadyCheckedToday(nip, nama){
    const today = nowFormatted();
    try {
      const pend = loadPending();
      if (pend.some(p => p.tanggal === today && ((p.nip && nip && p.nip === nip) || (p.nama && nama && p.nama === nama)))) return true;
    } catch(e){}
    if (navigator.onLine && db) {
      try {
        const snap = await db.ref('kehadiran/' + today).orderByChild('tanggal').equalTo(today).once('value');
        const val = snap.val() || {};
        const arr = Object.values(val);
        if (arr.some(x => (x.nip && nip && String(x.nip) === String(nip)) || (x.nama && nama && String(x.nama).trim() === String(nama).trim()))) return true;
      } catch(err){ console.warn('alreadyCheckedToday query failed', err); }
    }
    return false;
  }

  async function flushOnePending(){
    if (!navigator.onLine) return false;
    const item = popPending();
    if (!item) return false;
    try {
      if (!db) throw new Error('Firebase DB tidak tersedia');
      const payload = Object.assign({}, item);
      if (payload.imageId) delete payload.imageId;
      const dateKey = payload.tanggal || nowFormatted();
      const ref = db.ref('kehadiran/' + dateKey).push();
      await ref.set(Object.assign({}, payload, { timestamp: (firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
      try { window.toast && window.toast('Pending berhasil dikirim', 'ok'); } catch(e){}
      return true;
    } catch(err){
      const arr = loadPending();
      arr.unshift(item);
      savePending(arr);
      console.warn('flushOnePending failed — requeued', err);
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
      await new Promise(r => setTimeout(r, 200));
    }
    if (worked) updatePendingIndicator();
  }

  window.addEventListener('online', ()=> { try { window.toast && window.toast('Koneksi kembali — mengirim antrian', 'info'); } catch(e){}; flushAllPending(); });
  window.addEventListener('offline', ()=> { try { window.toast && window.toast('Offline — simpan ke antrian', 'err'); } catch(e){}; updatePendingIndicator(); });

  updatePendingIndicator();

  // send helper with improved error messages
  async function sendToFirebaseOnce(item){
    if (!navigator.onLine) return false;
    if (!db) {
      console.warn('sendToFirebaseOnce: Firebase DB tidak tersedia (window.db null)');
      return false;
    }
    try {
      const payload = Object.assign({}, item);
      if (payload.imageId) delete payload.imageId;
      const dateKey = payload.tanggal || nowFormatted();
      const ref = db.ref('kehadiran/' + dateKey).push();
      await ref.set(Object.assign({}, payload, { timestamp: (firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
      return true;
    } catch(err){
      console.error('sendToFirebaseOnce failed:', err);
      try {
        const msg = (err && err.message) ? err.message : (err && err.code) ? String(err.code) : 'Unknown error';
        if (window.toast) window.toast('Gagal kirim: ' + msg, 'err');
      } catch(e){}
      return false;
    }
  }

  // handler for main submit button (bind once)
  async function kirimHandler(ev){
    if (ev && ev.preventDefault) ev.preventDefault();
    const selVal = document.getElementById('namaGuru')?.value;
    const status = document.getElementById('statusKehadiran')?.value;
    if (!selVal) { window.toast ? window.toast('Pilih nama guru terlebih dahulu', 'err') : alert('Pilih nama guru'); return; }
    if (!status) { window.toast ? window.toast('Pilih status kehadiran', 'err') : alert('Pilih status kehadiran'); return; }
    const [nip, name] = (selVal||'').split('|');
    const lokasiVal = document.getElementById('lokasi')?.value || '';
    const payload = {
      nip: (nip||'').trim(),
      nama: (name||'').trim(),
      status: status,
      jam: timeFormatted(),
      tanggal: nowFormatted(),
      lokasi: lokasiVal
    };

    try {
      if (window.__whImageCache && typeof window.__whImageCache.getAndClearFormImageId === 'function') {
        const id = window.__whImageCache.getAndClearFormImageId();
        if (id) payload.imageId = id;
      }
    } catch(e){}

    const btn = document.getElementById('kirimKehadiranBtn');
    const orig = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Mengirim...'; }
    try {
      const today = nowFormatted();
      const pend = loadPending();
      if (pend.some(p => p.tanggal === today && ((p.nip && p.nip === payload.nip) || (p.nama && payload.nama && p.nama === payload.nama)))) {
        window.toast && window.toast('Guru sudah absen hari ini (pending)', 'err');
        return;
      }

      if (navigator.onLine && window.db) {
        const ok = await sendToFirebaseOnce(payload);
        if (ok) {
          await addRecentLocal(payload);
          window.toast && window.toast('Kehadiran berhasil dikirim', 'ok');
          updatePendingIndicator();
          return;
        } else {
          // send failed for some reason (will queue)
          pushPending(payload);
          await addRecentLocal(payload);
          window.toast && window.toast('Gagal kirim — disimpan lokal', 'err');
          return;
        }
      }

      // offline fallback
      pushPending(payload);
      await addRecentLocal(payload);
      window.toast && window.toast('Kehadiran tersimpan ke antrian (offline)', 'info');
    } catch(err){
      console.error('kirimHandler error:', err);
      try { pushPending(payload); await addRecentLocal(payload); window.toast && window.toast('Gagal kirim — disimpan lokal', 'err'); } catch(e){ console.error(e); }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
      updatePendingIndicator();
    }
  }

  // attach to button (safe replace)
  const old = document.getElementById('kirimKehadiranBtn');
  if (old) {
    const nb = old.cloneNode(true);
    old.parentNode.replaceChild(nb, old);
    nb.addEventListener('click', kirimHandler);
    console.info('Kirim Kehadiran handler terpasang pada #kirimKehadiranBtn');
  } else {
    console.warn('#kirimKehadiranBtn tidak ditemukan — handler tidak terpasang');
  }

  // recent UI helper
  async function addRecentLocal(entry){
    const recent = document.getElementById('recent-activity');
    if (!recent) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-3';
    const txt = document.createElement('div');
    const jam = entry.jam || new Date().toLocaleTimeString('id-ID');
    txt.className = 'text-gray-700 text-sm';
    txt.textContent = `${jam} — ${entry.nama||entry.nip||'(tanpa nama)'} — ${entry.status}`;
    wrapper.appendChild(txt);

    if (entry.imageId && window.__whImageCache) {
      const img = document.createElement('img');
      img.className = 'h-12 w-12 object-cover rounded hidden';
      img.alt = 'foto';
      wrapper.appendChild(img);
      try {
        const dataURL = await window.__whImageCache.getImageDataURL(entry.imageId);
        if (dataURL) { img.src = dataURL; img.classList.remove('hidden'); }
      } catch(e){}
    }
    recent.prepend(wrapper);
    const items = recent.querySelectorAll('div.flex');
    if (items.length > 25) items[items.length-1].remove();
  }

  window.flushPendingKehadiran = flushAllPending;
})(); // end setupKehadiran

/* ================= Chart & real-time listener (today only) ================= */
(function initKehadiranListeners(){
  try {
    const canvas = document.getElementById('chartDashboard');
    if (canvas && window.Chart) {
      window.dashboardChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Hadir','Izin/Sakit/Dinas'], datasets: [{ data: [0,0] }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
      });
    }
  } catch(e){ console.warn('init chart failed', e); }

  function updateFromSnapshot(dataObj){
    const data = dataObj || {};
    const today = nowFormatted();
    const arr = Array.isArray(data) ? data : Object.values(data || {});
    const hadir = arr.filter(x => x && x.tanggal === today && x.status === 'Hadir').length;
    const lain = arr.filter(x => x && x.tanggal === today && x.status !== 'Hadir').length;

    const totalGuruEl = document.getElementById('totalGuru');
    if (totalGuruEl) {
      try {
        const local = loadLocalGuru();
        totalGuruEl.textContent = String(Array.isArray(local) ? local.length : 0);
      } catch(e){ totalGuruEl.textContent = '0'; }
    }
    const totalHadirEl = document.getElementById('totalHadir'); if (totalHadirEl) totalHadirEl.textContent = String(hadir);
    const totalLainEl = document.getElementById('totalLain'); if (totalLainEl) totalLainEl.textContent = String(lain);

    try { if (window.dashboardChart) { window.dashboardChart.data.datasets[0].data = [hadir, lain]; window.dashboardChart.update(); } } catch(e){}

    const recent = document.getElementById('recent-activity');
    if (recent) {
      recent.innerHTML = '';
      const sorted = (Array.isArray(data) ? data : Object.values(data)).filter(Boolean).sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)).slice(0,12);
      if (!sorted.length) recent.innerHTML = '<p class="text-slate-400">Belum ada aktivitas.</p>';
      else sorted.forEach(it => {
        const p = document.createElement('p');
        const jam = it.jam || (it.timestamp ? new Date(it.timestamp).toLocaleTimeString('id-ID') : new Date().toLocaleTimeString('id-ID'));
        p.className = 'text-gray-700 text-sm'; p.textContent = `${jam} — ${it.nama} — ${it.status}`;
        recent.appendChild(p);
      });
    }
  }

  if (db) {
    const today = nowFormatted();
    const path = 'kehadiran/' + today;
    db.ref(path).on('value', snap => {
      const data = snap.val() || {};
      updateFromSnapshot(data);
    });
    db.ref(path).once('value').then(snap => updateFromSnapshot(snap.val() || {})).catch(()=>{});
  } else {
    updateFromSnapshot({});
  }
})(); // end initKehadiranListeners

/* ================= Camera capture modal ================= */
(function setupCamera(){
  const btnOpen = document.getElementById('btn-open-camera');
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  const snapBtn = document.getElementById('btn-camera-snap');
  const acceptBtn = document.getElementById('btn-camera-accept');
  const retakeBtn = document.getElementById('btn-camera-retake');
  const closeBtn = document.getElementById('btn-camera-close');
  const canvas = document.getElementById('camera-canvas');

  let stream = null;
  let lastBlob = null;

  async function startCamera(){
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch(err){
      console.error('startCamera failed', err);
      window.toast && window.toast('Tidak dapat membuka kamera', 'err');
      closeModal();
    }
  }
  function stopCamera(){
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.srcObject = null;
  }

  function openModal(){ if (modal) { modal.classList.remove('hidden'); startCamera(); } }
  function closeModal(){ if (modal) { modal.classList.add('hidden'); } stopCamera(); resetUI(); }

  function resetUI(){
    if (acceptBtn) acceptBtn.classList.add('hidden');
    if (retakeBtn) retakeBtn.classList.add('hidden');
    if (snapBtn) snapBtn.classList.remove('hidden');
    if (canvas) { canvas.width = canvas.height = 0; canvas.classList.add('hidden'); }
    lastBlob = null;
  }

  async function snap(){
    if (!video) return;
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, w, h);
    canvas.classList.remove('hidden');
    const blob = await new Promise((res, rej) => canvas.toBlob(b => { if (!b) rej(new Error('toBlob failed')); else res(b); }, 'image/jpeg', 0.85));
    lastBlob = blob;
    if (snapBtn) snapBtn.classList.add('hidden');
    if (acceptBtn) acceptBtn.classList.remove('hidden');
    if (retakeBtn) retakeBtn.classList.remove('hidden');
  }

  async function accept(){
    if (!lastBlob) return;
    const file = new File([lastBlob], 'photo_'+Date.now()+'.jpg', { type: lastBlob.type });
    try {
      if (window.__whImageCache && typeof window.__whImageCache.saveImageFromFile === 'function') {
        const id = await window.__whImageCache.saveImageFromFile(file);
        window.__whImageCache._lastFormImageId = id;
        const preview = document.getElementById('photoPreview');
        if (preview) {
          const dataURL = await window.__whImageCache.getImageDataURL(id);
          if (dataURL) { preview.src = dataURL; preview.classList.remove('hidden'); }
        }
        window.toast && window.toast('Foto disimpan di cache lokal', 'ok');
      } else {
        window.toast && window.toast('Image cache tidak tersedia', 'err');
      }
    } catch(err){
      console.error('save captured image failed', err);
      window.toast && window.toast('Gagal menyimpan foto', 'err');
    } finally {
      closeModal();
    }
  }

  function retake(){ lastBlob = null; resetUI(); }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (snapBtn) snapBtn.addEventListener('click', snap);
  if (retakeBtn) retakeBtn.addEventListener('click', retake);
  if (acceptBtn) acceptBtn.addEventListener('click', accept);

  (function patchGetAndClear(){
    if (!window.__whImageCache) return;
    const orig = window.__whImageCache.getAndClearFormImageId;
    window.__whImageCache.getAndClearFormImageId = function(){
      const idCam = window.__whImageCache._lastFormImageId || null;
      if (idCam) { delete window.__whImageCache._lastFormImageId; try { if (typeof orig === 'function') orig(); } catch(e){} return idCam; }
      if (typeof orig === 'function') return orig();
      return null;
    };
  })();

})(); // end camera

/* ================= Admin CRUD & handlers ================= */
(function setupAdminCrud(){
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-add-guru-admin') {
      const m = document.getElementById('guru-modal');
      if (m) m.classList.remove('hidden');
      const nameInput = document.getElementById('guru-nama-input');
      if (nameInput) nameInput.focus();
    }
    if (e.target && e.target.id === 'guru-cancel') {
      const m = document.getElementById('guru-modal'); if (m) m.classList.add('hidden');
    }
  });

  const btnSave = document.getElementById('guru-save');
  if (btnSave) {
    btnSave.addEventListener('click', async function(ev){
      ev.preventDefault();
      const nip = (document.getElementById('guru-nip')?.value || '').trim();
      const nama = (document.getElementById('guru-nama-input')?.value || '').trim();
      const jabatan = (document.getElementById('guru-jabatan-input')?.value || '').trim();
      if (!nama) { window.toast && window.toast('Nama guru harus diisi', 'err'); return; }

      let local = loadLocalGuru();
      if (nip) {
        if (local.find(x => x.nip && String(x.nip).trim() === String(nip).trim())) { window.toast && window.toast('NIP sudah terdaftar', 'err'); return; }
      }
      if (local.find(x => x.nama && x.nama.trim().toLowerCase() === nama.trim().toLowerCase())) { window.toast && window.toast('Nama sudah terdaftar', 'err'); return; }

      const newGuru = { nip: nip || '-', nama, jabatan, status: 'Aktif' };
      const orig = this.innerHTML; this.disabled = true; this.innerHTML = 'Menyimpan...';
      try {
        if (db) {
          try {
            const newKey = await addGuruFirebase(newGuru);
            local = loadLocalGuru();
            local.push(Object.assign({ id: newKey }, newGuru));
            saveGuruListToLocal(local);
            renderGuruUi(local);
            window.toast && window.toast('Guru tersimpan di server', 'ok');
          } catch(err){
            console.warn('addGuruFirebase failed', err);
            const id = 'local_' + Date.now();
            local = loadLocalGuru();
            local.push(Object.assign({ id }, newGuru));
            saveGuruListToLocal(local);
            renderGuruUi(local);
            window.toast && window.toast('Server error — guru disimpan lokal', 'err');
          }
        } else {
          const id = 'local_' + Date.now();
          local = loadLocalGuru();
          local.push(Object.assign({ id }, newGuru));
          saveGuruListToLocal(local);
          renderGuruUi(local);
          window.toast && window.toast('Guru disimpan (lokal)', 'info');
        }
        const m = document.getElementById('guru-modal'); if (m) m.classList.add('hidden');
        document.getElementById('guru-nip') && (document.getElementById('guru-nip').value='');
        document.getElementById('guru-nama-input') && (document.getElementById('guru-nama-input').value='');
        document.getElementById('guru-jabatan-input') && (document.getElementById('guru-jabatan-input').value='');
      } finally {
        this.disabled = false; this.innerHTML = orig;
      }
    });
  }

  document.addEventListener('click', async (e) => {
    const delBtn = e.target.closest && e.target.closest('.btn-del-guru');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Hapus data guru ini?')) return;
      try {
        if (db && id && !id.startsWith('local_')) {
          await deleteGuruFirebase(id);
          window.toast && window.toast('Guru dihapus dari server', 'ok');
        }
      } catch(err){ console.warn('deleteGuruFirebase failed', err); }
      let local = loadLocalGuru();
      local = local.filter(x => x.id !== id);
      saveGuruListToLocal(local);
      renderGuruUi(local);
    }

    const editBtn = e.target.closest && e.target.closest('.btn-edit-guru');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (!id) return;
      const local = loadLocalGuru();
      const g = local.find(x => x.id === id);
      if (!g) { window.toast && window.toast('Data tidak ditemukan', 'err'); return; }
      const m = document.getElementById('guru-modal'); if (m) m.classList.remove('hidden');
      document.getElementById('guru-nip').value = g.nip || '';
      document.getElementById('guru-nama-input').value = g.nama || '';
      document.getElementById('guru-jabatan-input').value = g.jabatan || '';
      const saveBtn = document.getElementById('guru-save');
      if (!saveBtn) return;
      const handler = async function saveEdit(ev){
        ev.preventDefault();
        const nip = (document.getElementById('guru-nip')?.value || '').trim();
        const nama = (document.getElementById('guru-nama-input')?.value || '').trim();
        const jab = (document.getElementById('guru-jabatan-input')?.value || '').trim();
        if (!nama) { window.toast && window.toast('Nama harus diisi', 'err'); return; }
        try {
          if (db && g.id && !g.id.startsWith('local_')) {
            await updateGuruFirebase(g.id, { nip, nama, jabatan: jab, status: g.status });
            window.toast && window.toast('Data guru diperbarui (server)', 'ok');
          }
        } catch(err){ console.warn('updateGuruFirebase failed', err); window.toast && window.toast('Update server gagal — update lokal saja', 'err'); }
        let localList = loadLocalGuru();
        const idx = localList.findIndex(x => x.id === g.id);
        if (idx !== -1) localList[idx] = Object.assign({ id: g.id }, { nip: nip||'-', nama, jabatan: jab, status: g.status||'Aktif' });
        saveGuruListToLocal(localList);
        renderGuruUi(localList);
        saveBtn.removeEventListener('click', handler);
        const m2 = document.getElementById('guru-modal'); if (m2) m2.classList.add('hidden');
        document.getElementById('guru-nip').value=''; document.getElementById('guru-nama-input').value=''; document.getElementById('guru-jabatan-input').value='';
      };
      saveBtn.addEventListener('click', handler);
    }
  });

})(); // end admin/crud

/* ================= Boot: initial render & sync ================= */
(function initBoot(){
  document.addEventListener('DOMContentLoaded', () => {
    try {
      try {
        const local = loadLocalGuru();
        if (local && local.length) {
          renderGuruUi(local);
          console.info('Rendered guru from localStorage (count:', local.length, ')');
        }
      } catch(e){ console.warn('initial render local failed', e); }

      try { if (db) syncFromFirebase(); } catch(e){ console.warn('syncFromFirebase error', e); }

      try { if (navigator.onLine) { window.flushPendingKehadiran && window.flushPendingKehadiran(); } } catch(e){}

      try {
        const def = 'kehadiran';
        const pages = ['kehadiran','dashboard','guru','laporan'];
        pages.forEach(p => {
          const el = document.getElementById('page-'+p);
          if (!el) return;
          if (p === def) el.classList.remove('hidden'); else el.classList.add('hidden');
        });
      } catch(e){}
    } catch(err){
      console.error('initBoot error', err);
    }
  });
})(); // end initBoot

/* ================= Laporan & Export (client-side, careful with big DB) ================= */
/*
 Note: this client-side builder reads pending local + can read entire DB when necessary.
 For large DB you should use a server-side aggregator. Kept simple for demo.
*/
(function laporanModule(){
  // helpers
  function normalizeDateToYYYYMMDD(raw){
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
      const ms = raw < 1e12 ? raw*1000 : raw;
      const d = new Date(ms); if (!isNaN(d)) return d.toISOString().slice(0,10); return null;
    }
    if (typeof raw === 'string') {
      const s = raw.trim();
      const m = s.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
      return null;
    }
    if (raw && raw._date) return normalizeDateToYYYYMMDD(raw._date);
    return null;
  }
  function normalizeStatus(raw){
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim().toLowerCase();
    if (!s) return '';
    if (s.includes('hadir') || s==='h') return 'H';
    if (s.includes('izin') || s==='i') return 'I';
    if (s.includes('sakit') || s==='s') return 'S';
    if (s.includes('dinas') || s==='d') return 'D';
    const first = s.charAt(0).toUpperCase();
    return /[HISD]/.test(first) ? first : first;
  }

  function loadLocalGuruSimple(){ try { return JSON.parse(localStorage.getItem(KEY_GURU) || '[]'); } catch(e){ return []; } }
  function loadPendingLocal(){ try { return JSON.parse(localStorage.getItem(KEY_PENDING) || '[]'); } catch(e){ return []; } }

  async function loadKehadiranAll(){
    const out = [];
    const pend = loadPendingLocal() || [];
    out.push(...pend);
    if (window.db) {
      try {
        const snap = await window.db.ref('kehadiran').once('value');
        const val = snap.val() || {};
        // val is object keyed by date -> pushId -> record
        Object.keys(val).forEach(dateKey => {
          const group = val[dateKey] || {};
          Object.values(group).forEach(x => out.push(x));
        });
      } catch(e){ console.warn('loadKehadiranAll: firebase read failed', e); }
    } else {
      console.info('loadKehadiranAll: firebase not available on page (offline).');
    }
    return out;
  }

  async function buildMatrixForMonth(ym){
    const res = { days: [], rows: [], debug: { processed:0, matched:0, unmatched:0 } };
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return res;
    const [y,mm] = ym.split('-').map(Number);
    const daysInMonth = new Date(y, mm, 0).getDate();
    res.days = Array.from({length:daysInMonth}, (_,i)=> i+1);
    const gurus = loadLocalGuruSimple();
    res.rows = gurus.map(g => ({
      id: g.id, nip: g.nip, nama: g.nama, jabatan: g.jabatan,
      key: (g.nip && String(g.nip).trim() && String(g.nip).trim() !== '-') ? String(g.nip).trim() : (g.nama||'').toString().trim().toLowerCase(),
      cells: Array(daysInMonth).fill('')
    }));
    const entries = await loadKehadiranAll();
    entries.forEach(e => {
      res.debug.processed++;
      const dateStr = normalizeDateToYYYYMMDD(e.tanggal || e.date || e.tgl || e.createdAt || e.timestamp);
      if (!dateStr) { res.debug.unmatched++; return; }
      const parts = dateStr.split('-'); if (parts.length < 3) { res.debug.unmatched++; return; }
      const ym0 = `${parts[0]}-${parts[1]}`; if (ym0 !== ym) return;
      const d = Number(parts[2]); if (!d || d < 1 || d > daysInMonth) { res.debug.unmatched++; return; }
      const stat = normalizeStatus(e.status || e.keterangan || e.ket || e.ket_status);
      const nipRaw = e.nip ? String(e.nip).trim() : '';
      const matchKey = (nipRaw && nipRaw !== '-') ? nipRaw : (e.nama||e.name||'').toString().trim().toLowerCase();
      let row = res.rows.find(r => r.key === matchKey);
      if (!row && matchKey) row = res.rows.find(r => (r.nama||'').toString().trim().toLowerCase() === matchKey);
      if (!row && e.nama) {
        const nm = (e.nama||'').toString().trim().toLowerCase();
        row = res.rows.find(r => (r.nama||'').toString().trim().toLowerCase().includes(nm) || nm.includes((r.nama||'').toString().trim().toLowerCase()));
      }
      if (row) {
        res.debug.matched++;
        const mark = stat || (e.status ? String(e.status).trim().charAt(0).toUpperCase() : '');
        row.cells[d-1] = mark;
      } else {
        res.debug.unmatched++;
      }
    });
    return res;
  }

  function renderMatrixToDOM(result, ym){
    const wrapEmpty = document.getElementById('laporan-matrix-empty');
    const wrapTable = document.getElementById('laporan-matrix-table');
    const resume = document.getElementById('resume-laporan');
    if (!wrapTable || !wrapEmpty || !resume) return;
    if (!result || !result.days || !result.rows) { wrapEmpty.classList.remove('hidden'); wrapTable.classList.add('hidden'); resume.innerHTML=''; return; }
    if (!result.rows.length) { wrapEmpty.classList.remove('hidden'); wrapTable.classList.add('hidden'); resume.innerHTML = `<div class="text-slate-500 p-4">Tidak ada data untuk bulan ${ym}.</div>`; return; }
    wrapEmpty.classList.add('hidden'); wrapTable.classList.remove('hidden');
    let html = '<div style="overflow:auto"><table class="min-w-full text-sm border-collapse" style="border:1px solid #e6e9ef"><thead><tr><th style="padding:6px;border:1px solid #e6e9ef">#</th><th style="padding:6px;border:1px solid #e6e9ef">Nama</th>';
    result.days.forEach(d => html += `<th style="padding:6px;border:1px solid #e6e9ef">${d}</th>`);
    html += '<th style="padding:6px;border:1px solid #e6e9ef">Hadir</th><th style="padding:6px;border:1px solid #e6e9ef">Lain</th></tr></thead><tbody>';
    result.rows.forEach((r, idx) => {
      html += `<tr><td style="padding:6px;border:1px solid #e6e9ef">${idx+1}</td><td style="padding:6px;border:1px solid #e6e9ef">${escapeHtml(r.nama||'')}</td>`;
      r.cells.forEach(c => html += `<td style="padding:6px;border:1px solid #e6e9ef;text-align:center">${c||''}</td>`);
      const hadir = r.cells.filter(x=>x==='H').length;
      const lain = r.cells.filter(x=>x && x!=='H').length;
      html += `<td style="padding:6px;border:1px solid #e6e9ef;text-align:center">${hadir}</td><td style="padding:6px;border:1px solid #e6e9ef;text-align:center">${lain}</td></tr>`;
    });
    html += '</tbody></table></div>';
    wrapTable.innerHTML = html;
    const totalGuru = result.rows.length;
    const totalHadir = result.rows.reduce((s,r)=> s + r.cells.filter(x=>x==='H').length, 0);
    const totalLain = result.rows.reduce((s,r)=> s + r.cells.filter(x=>x && x!=='H').length, 0);
    resume.innerHTML = `<div class="p-3 text-sm">Bulan: <strong>${ym}</strong> • Guru: <strong>${totalGuru}</strong> • Total Hadir: <strong>${totalHadir}</strong> • Total Izin/Sakit/Dinas: <strong>${totalLain}</strong></div>`;
  }

  (function wire(){
    const btn = document.getElementById('tampilkanLaporanBtn');
    if (btn) {
      const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', async function(){
        const ym = document.getElementById('bulan')?.value;
        if (!ym) { window.toast && window.toast('Pilih bulan terlebih dahulu', 'err'); return; }
        this.disabled = true; const orig = this.innerHTML; this.innerHTML = 'Memuat...';
        try {
          const res = await buildMatrixForMonth(ym);
          console.info('Debug laporan:', res.debug);
          renderMatrixToDOM(res, ym);
        } catch(e){ console.error('Gagal build laporan', e); window.toast && window.toast('Gagal buat laporan', 'err'); }
        finally { this.disabled = false; this.innerHTML = orig; }
      });
    }
    const expBtn = document.getElementById('exportLaporanBtn');
    if (expBtn) {
      const newExp = expBtn.cloneNode(true); expBtn.parentNode.replaceChild(newExp, expBtn);
      newExp.addEventListener('click', async function(){
        const ym = document.getElementById('bulan')?.value;
        if (!ym) { window.toast && window.toast('Pilih bulan terlebih dahulu', 'err'); return; }
        this.disabled = true; const orig = this.innerHTML; this.innerHTML = 'Mengexport...';
        try {
          const res = await buildMatrixForMonth(ym);
          if (!res || !res.rows || !res.rows.length) { window.toast && window.toast('Tidak ada data untuk diexport', 'err'); return; }
          const days = res.days || [];
          const header = ['No','Nama', ...days.map(d=>String(d)), 'Hadir','Lain'];
          const data = res.rows.map((r,idx)=> {
            const hadir = r.cells.filter(x=>x==='H').length;
            const lain = r.cells.filter(x=>x && x!=='H').length;
            return [idx+1, r.nama, ...r.cells.map(c=>c||''), hadir, lain];
          });
          if (window.XLSX) {
            const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
            XLSX.writeFile(wb, `laporan_${ym}.xlsx`);
          } else {
            const rows = [header, ...data].map(r => r.map(cell => `"${String(cell||'').replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([rows], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `laporan_${ym}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }
        } catch(e){ console.error('Export failed', e); window.toast && window.toast('Export gagal', 'err'); }
        finally { this.disabled = false; this.innerHTML = orig; }
      });
    }
  })();

})(); // end laporanModule

// End of app.firebase.js
