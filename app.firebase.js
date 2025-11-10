// app.firebase.js — Bagian 1/3
// (Firebase, helper, sync guru, CRUD guru, awal Image Cache)
// Pastikan index.html memuat: firebase compat, Chart.js, XLSX

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
window.renderGuruTable = renderGuruUi; // alias

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

// ----------------- Image cache (IndexedDB) — local-only photos -----------------
(function setupImageCache(){
  const DB_NAME = 'wh_images_db_v1';
  const STORE = 'images';
  const DB_VER = 1;
  let dbPromise = null;

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = e => rej(e.target.error || new Error('IndexedDB open failed'));
    });
    return dbPromise;
  }

  function runTx(storeName, mode, fn){
    return openDB().then(db => new Promise((res, rej) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      fn(store, res, rej);
      tx.oncomplete = () => {};
      tx.onerror = (ev) => rej(ev.target.error || new Error('Transaction error'));
    }));
  }

  function fileToDataURLCompressed(file, maxWidth = 1200, quality = 0.75){
    return new Promise((res, rej) => {
      const img = new Image();
      const reader = new FileReader();
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
              const reader2 = new FileReader();
              reader2.onload = ev2 => res(ev2.target.result);
              reader2.onerror = e2 => rej(e2);
              reader2.readAsDataURL(blob);
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
      req.onerror = (e) => reject(e.target.error || new Error('add image failed'));
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
      req.onerror = (e) => reject(e.target.error || new Error('get image failed'));
    });
  }

  async function deleteImage(id){
    if (!id) return;
    return await runTx(STORE, 'readwrite', (store, resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error || new Error('delete failed'));
    });
  }

  async function clearAllImages(){
    return await runTx(STORE, 'readwrite', (store, resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error || new Error('clear failed'));
    });
  }

  // expose cache API
  window.__whImageCache = { saveImageFromFile, getImageDataURL, deleteImage, clearAllImages };

  // ---------- UI wiring for photo input (file input, preview, clear) ----------
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
          const dataURL = await window.__whImageCache.getImageDataURL(id);
          await showPreviewFromDataURL(dataURL);
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

    // form helper: get & clear form image id (used when submit)
    window.__whImageCache.getAndClearFormImageId = function(){
      const id = currentImageId;
      currentImageId = null;
      if (input) input.value = '';
      if (preview) { preview.src=''; preview.classList.add('hidden'); }
      return id;
    };

    // helper to embed image into an <img> element by id
    window.__whImageCache.embedImageToElement = async function(imageId, imgElement){
      if (!imageId || !imgElement) return;
      try {
        const d = await window.__whImageCache.getImageDataURL(imageId);
        if (d) { imgElement.src = d; imgElement.classList.remove('hidden'); }
      } catch(e){}
    };

  } catch(e){ console.warn('Image cache UI wiring failed', e); }

})(); // end setupImageCache IIFE


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
      // try cached (close-by) first
      try {
        const cacheRaw = localStorage.getItem(CACHE_KEY);
        if (cacheRaw) {
          const parsed = JSON.parse(cacheRaw);
          if (parsed && parsed.lat && Math.abs(parsed.lat - lat) < 0.0005 && parsed.lng && Math.abs(parsed.lng - lng) < 0.0005 && (Date.now() - parsed._ts) < CACHE_TTL_MS) {
            return parsed.name;
          }
        }
      } catch(e){}

      // Nominatim reverse geocode (OpenStreetMap)
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
      lokasiEl.value = 'Tekan \"Gunakan GPS\" untuk mendeteksi lokasi';
      if (coordsSmallEl) coordsSmallEl.textContent = '—';
    } catch(e){
      lokasiEl.value = 'Tekan \"Gunakan GPS\" untuk mendeteksi lokasi';
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

})(); // end setupLocationWithGpsButton IIFE
// ----------------- Kehadiran: enhanced send + offline queue + cek absen ganda -----------------
(function setupKehadiranQueueAndSend(){
  // pending in localStorage
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

  // quick helper: check if same guru already absen hari ini (by nip or nama)
  async function alreadyCheckedToday(nip, nama){
    const today = nowFormatted();
    // check local pending queue first
    try {
      const pend = loadPending();
      if (pend.some(p => p.tanggal === today && ((p.nip && nip && p.nip === nip) || (p.nama && nama && p.nama === nama)))) {
        return true;
      }
    } catch(e){}
    // if online & db available, try query
    if (navigator.onLine && db) {
      try {
        // we will fetch kehadiran with tanggal==today then check
        const snap = await db.ref('kehadiran').orderByChild('tanggal').equalTo(today).once('value');
        const val = snap.val() || {};
        const arr = Object.values(val);
        if (arr.some(x => (x.nip && nip && String(x.nip) === String(nip)) || (x.nama && nama && String(x.nama).trim() === String(nama).trim()))) {
          return true;
        }
      } catch(err){
        console.warn('alreadyCheckedToday query failed', err);
      }
    }
    return false;
  }

  // flush pending (one by one)
  async function flushOnePending(){
    if (!navigator.onLine) return false;
    const item = popPending();
    if (!item) return false;
    try {
      if (!db) throw new Error('Firebase DB tidak tersedia');
      // server payload should NOT include imageId (local-only)
      const payloadToSend = Object.assign({}, item);
      if (payloadToSend.imageId) delete payloadToSend.imageId;
      const ref = db.ref('kehadiran').push();
      await ref.set(Object.assign({}, payloadToSend, { timestamp: (window.firebase && firebase.database)? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
      try { window.toast && window.toast('Pending berhasil dikirim', 'ok'); } catch(e){}
      return true;
    } catch(err){
      // put back to queue (at head)
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
      await new Promise(r => setTimeout(r, 250));
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

  // send handler (with absen ganda prevention)
  const kirimBtn = document.getElementById('kirimKehadiranBtn');
  if (kirimBtn) {
    kirimBtn.addEventListener('click', async function(){
      const selVal = document.getElementById('namaGuru')?.value;
      const status = document.getElementById('statusKehadiran')?.value;
      if (!selVal) { window.toast ? window.toast('Pilih nama guru terlebih dahulu', 'err') : alert('Pilih nama guru terlebih dahulu.'); return; }
      if (!status) { window.toast ? window.toast('Pilih status kehadiran', 'err') : alert('Pilih status kehadiran.'); return; }

      const [nip, name] = selVal.split('|');
      const lokasiVal = document.getElementById('lokasi')?.value || '';
      const payload = {
        nip: nip || '',
        nama: (name || '').trim(),
        status,
        jam: timeFormatted(),
        tanggal: nowFormatted(),
        lokasi: lokasiVal
      };

      // attach imageId to pending item ONLY (not to server payload)
      try {
        if (window.__whImageCache && typeof window.__whImageCache.getAndClearFormImageId === 'function') {
          const imageId = window.__whImageCache.getAndClearFormImageId();
          if (imageId) payload.imageId = imageId; // will remain local only in pending queue
        }
      } catch(e){}

      // UI feedback
      const btn = this;
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Mengirim...';
      const statusEl = document.getElementById('kehadiran-status');
      if (statusEl) statusEl.textContent = 'Mengirim...';

      try {
        // first: check duplicate attendance for today
        const dup = await alreadyCheckedToday(payload.nip, payload.nama);
        if (dup) {
          window.toast ? window.toast('Guru sudah absen hari ini (dibatasi 1x)', 'err') : alert('Anda sudah absen hari ini.');
          btn.disabled = false;
          btn.innerHTML = orig;
          if (statusEl) statusEl.textContent = '—';
          return;
        }

        if (navigator.onLine && db) {
          // send to Firebase (without imageId)
          const payloadToSend = Object.assign({}, payload);
          if (payloadToSend.imageId) delete payloadToSend.imageId;
          const newRef = db.ref('kehadiran').push();
          await newRef.set(Object.assign({}, payloadToSend, { timestamp: (window.firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() }));
          // optimistic recent UI includes local image preview if present
          await addRecentLocal(payload);
          try { window.toast && window.toast('Kehadiran berhasil dikirim', 'ok'); } catch(e){}
        } else {
          // offline: push to pending
          pushPending(payload);
          await addRecentLocal(payload);
          try { window.toast && window.toast('Kehadiran disimpan ke antrian (offline)', 'info'); } catch(e){}
        }
      } catch (err) {
        console.error('Gagal kirim/queue', err);
        pushPending(payload);
        await addRecentLocal(payload);
        try { window.toast && window.toast('Terjadi kesalahan — data disimpan sementara', 'err'); } catch(e){}
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
        updatePendingIndicator();
      }
    });
  }

  // helper: add to recent activity in UI (uses local image cache if available)
  async function addRecentLocal(entry){
    const recent = document.getElementById('recent-activity');
    if (!recent) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-3';
    const txt = document.createElement('div');
    const jam = entry.jam || new Date().toLocaleTimeString('id-ID');
    txt.className = 'text-gray-700';
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
    // prepend
    recent.prepend(wrapper);
    // trim long list
    const items = recent.querySelectorAll('div.flex');
    if (items.length > 25) items[items.length-1].remove();
  }

  // expose flush
  window.flushPendingKehadiran = flushAllPending;

})(); // end setupKehadiranQueueAndSend IIFE


// ----------------- Chart & Kehadiran realtime listener -----------------
(function initKehadiranListeners(){
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

    const totalGuruEl = document.getElementById('totalGuru');
    if (totalGuruEl) {
      try {
        const local = JSON.parse(localStorage.getItem(KEY_GURU) || '[]');
        totalGuruEl.textContent = String(Array.isArray(local) ? local.length : 0);
      } catch(e){ totalGuruEl.textContent = String(0); }
    }
    const totalHadirEl = document.getElementById('totalHadir'); if (totalHadirEl) totalHadirEl.textContent = String(hadir);
    const totalLainEl = document.getElementById('totalLain'); if (totalLainEl) totalLainEl.textContent = String(lain);

    try {
      if (window.dashboardChart) {
        window.dashboardChart.data.datasets[0].data = [hadir, lain];
        window.dashboardChart.update();
      }
    } catch(e){ console.warn('update chart failed', e); }

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

})(); // end initKehadiranListeners


// ----------------- Camera modal capture -> save to IndexedDB via __whImageCache -----------------
(function setupCameraCapture(){
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

  function openModal(){ modal.classList.remove('hidden'); startCamera(); }
  function closeModal(){ modal.classList.add('hidden'); stopCamera(); resetUI(); }

  async function startCamera(){
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch(err){
      console.error('startCamera failed', err);
      alert('Tidak dapat membuka kamera. Gunakan tombol unggah foto sebagai alternatif.');
      closeModal();
    }
  }
  function stopCamera(){
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  function resetUI(){
    if (acceptBtn) acceptBtn.classList.add('hidden');
    if (retakeBtn) retakeBtn.classList.add('hidden');
    if (snapBtn) snapBtn.classList.remove('hidden');
    if (canvas) { canvas.width = canvas.height = 0; canvas.classList.add('hidden'); }
    lastBlob = null;
  }

  async function snap(){
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
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
        // put id into form cache (so send handler will pick it up)
        // note: our getAndClearFormImageId uses currentImageId var inside image input wiring,
        // so we provide an alternate last-form id here for camera flow.
        window.__whImageCache._lastFormImageId = id;
        const preview = document.getElementById('photoPreview');
        if (preview) {
          const dataURL = await window.__whImageCache.getImageDataURL(id);
          if (dataURL) { preview.src = dataURL; preview.classList.remove('hidden'); }
        }
        if (window.toast) window.toast('Foto disimpan di cache lokal', 'ok');
      } else {
        alert('Image cache tidak tersedia.');
      }
    } catch(err){
      console.error('save captured image failed', err);
      if (window.toast) window.toast('Gagal menyimpan foto', 'err');
    } finally {
      closeModal();
    }
  }

  function retake(){
    lastBlob = null;
    resetUI();
  }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (snapBtn) snapBtn.addEventListener('click', snap);
  if (retakeBtn) retakeBtn.addEventListener('click', retake);
  if (acceptBtn) acceptBtn.addEventListener('click', accept);

  // Patch getAndClearFormImageId to prefer _lastFormImageId from camera
  (function patchGetAndClear(){
    if (!window.__whImageCache) return;
    const orig = window.__whImageCache.getAndClearFormImageId;
    window.__whImageCache.getAndClearFormImageId = function(){
      const idFromCamera = window.__whImageCache._lastFormImageId || null;
      if (idFromCamera) {
        delete window.__whImageCache._lastFormImageId;
        // clear any file-input's currentImageId via original if exists
        try { if (typeof orig === 'function') orig(); } catch(e){}
        return idFromCamera;
      }
      if (typeof orig === 'function') return orig();
      return null;
    };
  })();

})(); // end setupCameraCapture


// ----------------- Laporan Bulanan (matrix) & Export (reuse functions from earlier section) -----------------
// (Bagian laporan sudah ditulis di Bagian 2 — fungsi buildMatrixForMonth & renderMatrixToDOM & exportMatrixToExcel
// berada di app.firebase.js bagian sebelumnya in our full file — if you split, ensure those functions are present.
// For completeness, we assume they are defined in the earlier combined code; if you split files, keep consistency.)

// ----------------- Clock helpers & Boot -----------------
function setCurrentDate(){
  const now = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const elTop = document.getElementById('current-date-top');
  if (elTop) elTop.textContent = now.toLocaleDateString('id-ID', opts);
}
function drawClock(){
  const small = document.getElementById('clock-small');
  if (small) small.textContent = new Date().toLocaleTimeString('id-ID');
}

// Boot sequence
(function boot(){
  try { setCurrentDate(); drawClock(); setInterval(()=>{ setCurrentDate(); drawClock(); },1000); } catch(e){}
  try {
    const local = JSON.parse(localStorage.getItem(KEY_GURU) || '[]');
    if (local && local.length) { renderGuruUi(local); }
  } catch(e){}
  try { if (db) syncFromFirebase(); } catch(e){ console.warn('syncFromFirebase error', e); }
  // attempt flush pending if online
  try { if (navigator.onLine) { window.flushPendingKehadiran && window.flushPendingKehadiran(); } } catch(e){}
})();