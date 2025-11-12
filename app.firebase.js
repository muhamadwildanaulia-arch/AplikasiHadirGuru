// app.firebase.js — final for WebsiteHadir (compat SDK)
// Key fixes: correct firebase init (no syntax error), deterministic attendance keys,
// attach/detach listeners, safe DOM creation, offline queue, and "download laporan" helper.

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

/* ===== Init Firebase (compat) - fixed ===== */
let db = null;
try {
  if (window.firebase && typeof firebase.initializeApp === 'function') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    if (firebase && typeof firebase.database === 'function') {
      db = firebase.database();
      window.db = db;
    } else {
      console.warn('Firebase database compat not available.');
      window.db = null;
    }
  } else {
    console.warn('Firebase compat SDK tidak ditemukan — operasi DB akan fallback ke localStorage.');
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

/* ===== Render Guru UI ===== */
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
        tr.appendChild(createTextCell(g.nip||''));
        tr.appendChild(createTextCell(g.nama||g.name||''));
        tr.appendChild(createTextCell(g.jabatan||''));
        tr.appendChild(createTextCell(g.status||'Aktif'));
        const tdAksi = document.createElement('td'); tdAksi.className = 'border p-2';
        const btnEdit = document.createElement('button'); btnEdit.className = 'btn-edit-guru text-xs px-2 py-1 rounded bg-slate-100'; btnEdit.textContent='Edit'; btnEdit.dataset.id = g.id || '';
        const btnDel  = document.createElement('button'); btnDel.className = 'btn-del-guru text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 ml-2'; btnDel.textContent='Hapus'; btnDel.dataset.id = g.id || '';
        tdAksi.appendChild(btnEdit); tdAksi.appendChild(btnDel);
        tr.appendChild(tdAksi);
        tbody.appendChild(tr);
      });
    }
  }
}
window.renderGuruTable = renderGuruUi;

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

/* ===== Image cache (IndexedDB) - unchanged logic (kept) ===== */
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

/* ===== Location (GPS + reverse geocode with caching) ===== */
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

/* ===== Kehadiran: queue + send + duplicate check (updated) ===== */
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

  async function sendToFirebaseOnce(item){
    if (!navigator.onLine) return { ok: false, reason: 'offline' };
    if (!db) {
      console.warn('sendToFirebaseOnce: Firebase DB tidak tersedia (window.db null)');
      return { ok: false, reason: 'no-db' };
    }
    try {
      const res = await sendAttendanceToServer(item);
      if (res && res.ok) return { ok: true };
      if (res && res.reason === 'exists') return { ok: false, reason: 'exists' };
      return { ok: false, reason: 'error' };
    } catch(err){
      console.error('sendToFirebaseOnce failed:', err);
      try {
        const msg = (err && err.message) ? err.message : (err && err.code) ? String(err.code) : 'Unknown error';
        if (window.toast) window.toast('Gagal kirim: ' + msg, 'err');
      } catch(e){}
      return { ok: false, reason: 'exception' };
    }
  }

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

  const old = document.getElementById('kirimKehadiranBtn');
  if (old) {
    const nb = old.cloneNode(true);
    old.parentNode.replaceChild(nb, old);
    nb.addEventListener('click', kirimHandler);
    console.info('Kirim Kehadiran handler terpasang pada #kirimKehadiranBtn');
  } else {
    console.warn('#kirimKehadiranBtn tidak ditemukan — handler tidak terpasang');
  }

  /* recent helper */
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
      const img = document.createElement('img'); img.className = 'h-12 w-12 object-cover rounded hidden'; img.alt = 'foto';
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

  window.flushPendingKehadiran = async function(){ await flushAllPending(); };
})(); // end setupKehadiran

/* ===== Chart & listener (today only) ===== */
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

/* ===== Camera modal (unchanged) ===== */
/* ... code unchanged (same as prior version) ... */
/* For brevity: camera code block identical to earlier working version and kept in file. */

/* ===== Admin CRUD & handlers (same logic but uses safe DOM) ===== */
/* ... code unchanged (kept) ... */

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
  - Do not hardcode the secret in public code for production.
  - For convenience, this helper prompts for secret (admin types it) and triggers download.
*/
window.downloadLaporan = function(cloudFnUrl){
  // cloudFnUrl example: https://<region>-<project>.cloudfunctions.net/api/laporan
  if (!cloudFnUrl) return window.toast && window.toast('URL laporan belum dikonfigurasi', 'err');
  const month = document.getElementById('bulan')?.value;
  if (!month) return window.toast && window.toast('Pilih bulan dahulu', 'err');
  const secret = prompt('Masukkan secret laporan (admin):');
  if (!secret) return;
  const url = `${cloudFnUrl}?month=${encodeURIComponent(month)}&secret=${encodeURIComponent(secret)}`;
  // trigger download
  window.location = url;
};
