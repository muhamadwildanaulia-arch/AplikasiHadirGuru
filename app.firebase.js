// app.firebase.js — final for WebsiteHadir (compat SDK)
// Basis: saya gunakan sumber Anda dan memperkuat inisialisasi & komentar keamanan.
// Referensi file asal Anda: index.html + app.firebase.js (yang Anda upload). :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6}

/* ===== Firebase config (sesuaikan bila perlu) ===== */
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

/* ===== Init Firebase (compat) - robust ===== */
let db = null;
try {
  if (window.firebase && typeof firebase.initializeApp === 'function') {
    // only init if not inited already
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    // set db if database compat available
    try {
      if (firebase && firebase.database && typeof firebase.database === 'function') {
        db = firebase.database();
        window.db = db;
      } else if (firebase && firebase.database && firebase.database instanceof Object && typeof firebase.database === 'function') {
        // fallback
        db = firebase.database();
        window.db = db;
      } else {
        console.warn('Firebase database compat not available. window.db set to null.');
        window.db = null;
      }
    } catch(e){
      console.warn('Error obtaining firebase.database()', e);
      window.db = null;
    }
  } else {
    console.warn('Firebase compat SDK not loaded (firebase.initializeApp missing). DB operations will fallback to localStorage where possible.');
    window.db = null;
  }
} catch (e) {
  console.error('Init firebase error', e);
  db = null;
  window.db = null;
}

/* ===== Constants & helpers ===== */
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
function loadLocalGuru(){ try { return JSON.parse(localStorage.getItem(KEY_GURU) || '[]'); } catch(e){ return []; } }
function saveGuruListToLocal(list){ try { localStorage.setItem(KEY_GURU, JSON.stringify(list)); } catch(e){ console.warn('saveGuruListToLocal failed', e); } }
function snapshotToArray(obj){ if (!obj) return []; return Object.keys(obj).map(k => Object.assign({ id: k }, (obj[k] && typeof obj[k] === 'object') ? obj[k] : {})); }

/* ===== Safe DOM helper ===== */
function createTextCell(text, className='border p-2') {
  const td = document.createElement('td');
  td.className = className;
  td.textContent = text || '';
  return td;
}

/* ===== Render Guru table helper (kept from original) ===== */
const tbody = document.getElementById('guruTableBody');
if (tbody) {
  // initial placeholder handled in HTML
}

/* ===== Firebase CRUD: Gurus (compat) ===== */
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
  await db.ref('gurus/' + id).update({
    nip: data.nip,
    nama: data.nama,
    jabatan: data.jabatan,
    status: data.status
  });
}
async function deleteGuruFirebase(id){
  if (!db) throw new Error('Firebase DB tidak tersedia');
  if (!id) throw new Error('id required');
  await db.ref('gurus/' + id).remove();
}
window.addGuruFirebase = addGuruFirebase;
window.updateGuruFirebase = updateGuruFirebase;
window.deleteGuruFirebase = deleteGuruFirebase;

/* ===== Sync from Firebase (gurus) ===== */
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

/* ===== Image cache (IndexedDB) - kept (your logic) ===== */
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

/* ===== Location (GPS) helper & UI wiring (kept) ===== */
(function setupLocation(){
  const btnGps = document.getElementById('btn-use-gps');
  const coordsSmallEl = document.getElementById('coords-small');

  async function useGpsNow(ev){
    if (btnGps) { btnGps.disabled = true; btnGps.querySelector && (btnGps.querySelector('#btn-gps-label') && (btnGps.querySelector('#btn-gps-label').textContent = 'Mendeteksi...')); }
    try {
      const p = new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 20000, enableHighAccuracy: true });
      });
      const pos = await p;
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      document.getElementById('lokasi').value = `(${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      if (coordsSmallEl) coordsSmallEl.textContent = `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try { localStorage.setItem(KEY_LOC_CACHE, JSON.stringify({ name: document.getElementById('lokasi').value, lat, lng })); } catch(e){}
    } catch(err){
      const lokasiEl = document.getElementById('lokasi'), btnGps = document.getElementById('btn-use-gps');
      if (lokasiEl) {
        if (err && err.code === 1) { lokasiEl.value = 'Izin lokasi ditolak'; }
        else if (err && err.code === 3) { lokasiEl.value = 'Timeout saat mendeteksi lokasi'; }
        else { lokasiEl.value = 'Gagal mendapatkan lokasi'; }
      }
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

/* ===== Attendance key helper & listener management ===== */
function makeAttendanceKey(payload){
  const base = (payload.nip && payload.nip.trim() && payload.nip !== '-') ? String(payload.nip).trim()
               : (payload.nama ? String(payload.nama).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'') : ('anon_' + Date.now()));
  return base;
}

const activeListeners = [];
function attachListener(ref, ev, cb){
  if (!ref) return;
  ref.on(ev, cb);
  activeListeners.push({ ref, ev, cb });
}
function detachAllListeners(){
  activeListeners.forEach(({ ref, ev, cb }) => {
    try { ref.off(ev, cb); } catch(e){}
  });
  activeListeners.length = 0;
}
window.addEventListener('beforeunload', detachAllListeners);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') detachAllListeners(); });

/* ===== Kehadiran: queue + send + duplicate check (kept) ===== */
(function setupKehadiran(){
  function loadPending(){ try { return JSON.parse(localStorage.getItem(KEY_PENDING) || '[]'); } catch(e){ return []; } }
  function savePending(arr){ try { localStorage.setItem(KEY_PENDING, JSON.stringify(arr)); } catch(e){} }
  function pushPending(item){ const a = loadPending(); a.push(item); savePending(a); updatePendingIndicator(); }
  function popPending(){ const a = loadPending(); if (!a.length) return null; const it = a.shift(); savePending(a); updatePendingIndicator(); return it; }
  function updatePendingIndicator(){ const pending = loadPending().length; const statusEl = document.getElementById('kehadiran-status'); if (statusEl) statusEl.textContent = pending ? `Pending: ${pending}` : '—'; }

  async function alreadyCheckedTodayLocal(nip, nama){
    const today = nowFormatted();
    try {
      const pend = loadPending();
      if (pend.some(p => p.tanggal === today && ((p.nip && nip && p.nip === nip) || (p.nama && nama && p.nama === nama)))) return true;
    } catch(e){}
    return false;
  }

  async function alreadyExistsOnServer(dateKey, attKey){
    if (!navigator.onLine || !db) return false;
    try {
      const snap = await db.ref(`kehadiran/${dateKey}/${attKey}`).once('value');
      return snap.exists();
    } catch(err){
      console.warn('alreadyExistsOnServer check failed', err);
      return false;
    }
  }

  async function sendAttendanceToServer(payload){
    if (!navigator.onLine || !db) return { ok: false, reason: 'offline' };
    const dateKey = payload.tanggal || nowFormatted();
    const attKey = makeAttendanceKey(payload);
    try {
      const exists = await alreadyExistsOnServer(dateKey, attKey);
      if (exists) {
        return { ok: false, reason: 'exists' };
      }
      const path = `kehadiran/${dateKey}/${attKey}`;
      await db.ref(path).set(Object.assign({}, payload, { timestamp: (firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
      return { ok: true, key: attKey };
    } catch(err){
      console.error('sendAttendanceToServer failed', err);
      return { ok: false, reason: 'error', err };
    }
  }

  async function flushOnePending(){
    if (!navigator.onLine) return false;
    const item = popPending();
    if (!item) return false;
    try {
      if (!db) throw new Error('Firebase DB tidak tersedia');
      const result = await sendAttendanceToServer(item);
      if (result && result.ok) {
        try { window.toast && window.toast('Pending berhasil dikirim', 'ok'); } catch(e){}
        return true;
      } else {
        const arr = loadPending();
        arr.unshift(item);
        savePending(arr);
        if (result && result.reason === 'exists') {
          const filtered = loadPending().filter(p => !(p.tanggal===item.tanggal && (p.nip===item.nip || p.nama===item.nama)));
          savePending(filtered);
          updatePendingIndicator();
          try { window.toast && window.toast('Pending ditemukan sudah ada di server — diabaikan', 'info'); } catch(e){}
          return true;
        }
        console.warn('flushOnePending failed — requeued', result && result.err ? result.err : 'unknown');
        return false;
      }
    } catch(err){
      const arr = loadPending();
      arr.unshift(item);
      savePending(arr);
      console.warn('flushOnePending exception — requeued', err);
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

  /* Handler: Kirim Kehadiran (button) */
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
      if (await alreadyCheckedTodayLocal(payload.nip, payload.nama)) {
        window.toast && window.toast('Guru sudah absen hari ini (pending)', 'err');
        return;
      }

      if (navigator.onLine && window.db) {
        const res = await sendToFirebaseOnce(payload);
        if (res.ok) {
          await addRecentLocal(payload);
          window.toast && window.toast('Kehadiran berhasil dikirim', 'ok');
          updatePendingIndicator();
          return;
        } else {
          if (res.reason === 'exists') {
            window.toast && window.toast('Guru sudah absen hari ini (server)', 'err');
            await addRecentLocal(payload);
            return;
          }
          pushPending(payload);
          await addRecentLocal(payload);
          window.toast && window.toast('Gagal kirim — disimpan lokal', 'err');
          return;
        }
      }

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
  document.getElementById('kirimKehadiranBtn')?.addEventListener('click', kirimHandler);
  window.flushPendingKehadiran = flushAllPending;

})(); // end setupKehadiran

/* ===== Dashboard listener (kehadiran hari ini) ===== */
(function initKehadiranListeners(){
  function updateFromSnapshot(dataObj){
    const data = dataObj || {};
    const today = nowFormatted();
    const arr = Array.isArray(data) ? data : Object.values(data || {});
    const hadir = arr.filter(x => x && (String(x.tanggal) === today) && x.status === 'Hadir').length;
    const lain = arr.filter(x => x && (String(x.tanggal) === today) && x.status !== 'Hadir').length;

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
      const sorted = (Array.isArray(data) ? data : Object.values(data)).filter(Boolean)
                     .sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)).slice(0,12);
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
    try {
      const ref = db.ref(path);
      attachListener(ref, 'value', snap => {
        const data = snap.val() || {};
        updateFromSnapshot(data);
      });
      db.ref(path).once('value').then(snap => updateFromSnapshot(snap.val() || {})).catch(()=>{});
    } catch(e){
      console.warn('attach today listener failed', e);
      updateFromSnapshot({});
    }
  } else {
    updateFromSnapshot({});
  }
})(); // end initKehadiranListeners

/* ===== Boot init ===== */
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

/* ===== Laporan: client triggers Cloud Function (download) ===== */
/*
  NOTE:
  - Do NOT hardcode secret in public code for production.
  - Prefer: Cloud Function that validates Firebase Auth token (custom claim admin) OR server-side signed URL.
  - If you use a 'secret' query param, do NOT store it in repo.
*/
window.downloadLaporan = function(cloudFnUrl){
  if (!cloudFnUrl) return window.toast && window.toast('URL laporan belum dikonfigurasi', 'err');
  const month = document.getElementById('bulan')?.value;
  if (!month) return window.toast && window.toast('Pilih bulan dahulu', 'err');

  // Production recommendation:
  // 1) Protect Cloud Function by verifying Firebase ID token and custom claim admin: true.
  // 2) Or generate signed URL server-side with Admin SDK.
  //
  // Quick (less secure) fallback: prompt for secret (do not hardcode).
  const secret = prompt('Masukkan secret laporan (admin):');
  if (!secret) return;
  const url = `${cloudFnUrl}?month=${encodeURIComponent(month)}&secret=${encodeURIComponent(secret)}`;
  window.location = url;
};

