/* app.firebase.js — Firestore + Storage (stabilized)
   - Tujuan: versi stabil yang membuat semua fitur di `index.html` bekerja.
   - LANGKAH PENTING: sebelum memakai file ini, pastikan di index.html sudah ada tag-script compat berikut (di <head> atau sebelum file ini dipanggil):

     <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-storage-compat.js"></script>

   - Ganti `firebaseConfig` di bawah dengan konfigurasi proyekmu.
   - File ini menggunakan API compat (sesuai script compat di index.html) agar mudah migrasi dari RTDB.
*/

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

(function(){
  // ---------------- Init Firebase ----------------
  if (!window.firebase) {
    console.error('Firebase SDK tidak ditemukan. Pastikan tag <script> compat sudah dimasukkan di index.html.');
    return;
  }
  if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
  const firestore = firebase.firestore();
  const storage = firebase.storage();
  const auth = firebase.auth ? firebase.auth() : null; // optional

  // Try enable offline persistence (best-effort)
  if (firestore && firestore.enablePersistence) {
    firestore.enablePersistence().catch(err => {
      // common: failed-precondition (multi-tab) or unimplemented
      console.warn('Firestore persistence unavailable:', err && err.code ? err.code : err);
    });
  }

  // ---------------- Helpers ----------------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const toastsEl = $('#toasts');
  function showToast(text, type='info', ms=3000){
    if (!toastsEl) return console.log('toast:', text);
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = text;
    toastsEl.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.remove(), 220); }, ms);
  }
  function pad(n){ return n < 10 ? '0' + n : String(n); }

  // safe querySelector
  function $(id, fallback=null){ try { return document.querySelector(id) || fallback; } catch(e){ return fallback; } }

  // ---------------- Navigation & UI basics ----------------
  const pages = ['kehadiran','dashboard','guru','laporan'];
  function showPage(page){
    pages.forEach(p=>{ const el = document.getElementById(`page-${p}`); if(el) el.classList.toggle('hidden', p!==page); });
    $$('.nav-item').forEach(btn => btn.classList.toggle('bg-white/10', btn.dataset.page === page));
  }
  // bind nav: guard if elements missing
  try { $$('.nav-item').forEach(btn => btn.addEventListener('click', ()=> showPage(btn.dataset.page))); } catch(e){}
  try { $$('.md:hidden [data-page]').forEach(b => b.addEventListener('click', ()=> showPage(b.dataset.page))); } catch(e){}
  try { $('#btn-toggle-sidebar')?.addEventListener('click', ()=> document.querySelector('aside.sidebar')?.classList.toggle('hidden')); } catch(e){}
  showPage('kehadiran');

  // ---------------- Clock & Date ----------------
  const topDate = document.getElementById('current-date-top');
  const smallClock = document.getElementById('clock-small');
  function updateClock(){
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (topDate) topDate.textContent = now.toLocaleDateString('id-ID', opts);
    if (smallClock) smallClock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  updateClock(); setInterval(updateClock, 1000);

  // ---------------- Chart ----------------
  let chart = null;
  function initChart(){
    const canvas = document.getElementById('chartDashboard');
    if (!canvas) return;
    try {
      chart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Hadir','Izin/Sakit/Dinas','Belum'], datasets: [{ data: [0,0,1] }] },
        options: { responsive:true, maintainAspectRatio:false }
      });
    } catch(e){ console.warn('Chart init error', e); }
  }
  initChart();

  // ---------------- Populate Guru ----------------
  const namaSelect = document.getElementById('namaGuru');
  function setNamaOptions(items){
    if (!namaSelect) return;
    namaSelect.innerHTML = `<option value="">-- Pilih Guru --</option>`;
    items.forEach(it => {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = `${it.nama || '-'}${it.nip ? ' • '+it.nip : ''}`;
      namaSelect.appendChild(opt);
    });
  }

  // Firestore listener for gurus collection
  try {
    firestore.collection('gurus').onSnapshot(snapshot => {
      if (snapshot.empty) {
        // sample fallback
        setNamaOptions([{id:'g1', nama:'Siti Aminah', nip:'12345'},{id:'g2', nama:'Budi Santoso', nip:'23456'}]);
        showToast('Data guru kosong — memakai sample lokal', 'info', 3000);
        // also update table
        const tbody = document.getElementById('guruTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500">Belum ada data.</td></tr>`;
        return;
      }
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNamaOptions(docs);
      // update table
      const tbody = document.getElementById('guruTableBody');
      if (tbody) {
        tbody.innerHTML = docs.map(g => `
          <tr class="align-top">
            <td class="p-2">${g.nip || '-'}</td>
            <td class="p-2">${g.nama || '-'}</td>
            <td class="p-2">${g.jabatan || '-'}</td>
            <td class="p-2">${g.status || '-'}</td>
            <td class="p-2"><button data-id="${g.id}" class="btn-edit text-xs underline">Edit</button></td>
          </tr>
        `).join('');
      }
    }, err => {
      console.error('gurus onSnapshot error', err);
      showToast('Gagal memuat data guru (Firestore).', 'err', 3000);
    });
  } catch(e) {
    console.error('bind gurus listener', e);
  }

  // ---------------- Recent activity helper ----------------
  const recentEl = document.getElementById('recent-activity');
  function pushRecent(text){
    if (!recentEl) return;
    const p = document.createElement('p');
    p.className = 'text-sm';
    p.textContent = `${(new Date()).toLocaleTimeString('id-ID')} — ${text}`;
    recentEl.prepend(p);
    while (recentEl.children.length > 10) recentEl.removeChild(recentEl.lastChild);
  }

  // ---------------- GPS ----------------
  const btnGPS = document.getElementById('btn-use-gps');
  btnGPS?.addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Geolocation tidak tersedia di peramban', 'err'); return; }
    btnGPS.disabled = true; const icon = document.getElementById('btn-gps-icon'); const label = document.getElementById('btn-gps-label');
    if (icon) icon.textContent = '⌛'; if (label) label.textContent = 'Mendeteksi...';
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      const txt = `Lat:${latitude.toFixed(6)}, Lon:${longitude.toFixed(6)} (±${Math.round(accuracy)} m)`;
      const lokasiInput = document.getElementById('lokasi'); const coordsSmall = document.getElementById('coords-small');
      if (lokasiInput) lokasiInput.value = txt; if (coordsSmall) coordsSmall.textContent = txt;
      showToast('Lokasi terdeteksi.', 'ok', 2000);
      if (icon) icon.textContent = '📍'; if (label) label.textContent = 'Gunakan GPS'; btnGPS.disabled = false;
    }, err => {
      console.error('geolocation error', err);
      showToast('Gagal mendapatkan lokasi: ' + (err && err.message ? err.message : err), 'err', 3500);
      if (icon) icon.textContent = '📍'; if (label) label.textContent = 'Gunakan GPS'; btnGPS.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000 });
  });

  // ---------------- Photo preview & clear ----------------
  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  document.getElementById('btn-open-camera')?.addEventListener('click', (e)=>{ e.preventDefault(); photoInput?.click(); });
  photoInput?.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { photoPreview.src = URL.createObjectURL(f); photoPreview.classList.remove('hidden'); showToast('Foto siap (tidak otomatis diupload sampai kirim).', 'info', 1600); } catch(e){ console.warn(e); }
  });
  document.getElementById('btn-clear-photo')?.addEventListener('click', ()=>{ if (photoInput) photoInput.value = ''; if (photoPreview){ photoPreview.src = ''; photoPreview.classList.add('hidden'); } showToast('Preview foto dihapus.', 'info', 1200); });

  // ---------------- Submit Kehadiran ----------------
  const kirimBtn = document.getElementById('kirimKehadiranBtn');
  const statusLabel = document.getElementById('kehadiran-status');
  kirimBtn?.addEventListener('click', async () => {
    const namaSel = document.getElementById('namaGuru');
    const statusSel = document.getElementById('statusKehadiran');
    if (!namaSel || !statusSel) { showToast('Form kehadiran tidak lengkap.', 'err'); return; }
    const guruId = namaSel.value;
    const status = statusSel.value;
    if (!guruId) { showToast('Pilih nama guru terlebih dahulu.', 'err'); return; }
    if (!status) { showToast('Pilih status kehadiran.', 'err'); return; }

    kirimBtn.disabled = true; if (statusLabel) statusLabel.textContent = 'Mengirim…';
    const lokasi = document.getElementById('lokasi')?.value || '';
    const fotoFile = photoInput?.files && photoInput.files[0] ? photoInput.files[0] : null;

    try {
      // add attendance doc
      const attendanceRef = await firestore.collection('kehadiran').add({
        guruId,
        status,
        lokasi,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // upload foto jika ada
      if (fotoFile) {
        const safeName = fotoFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const path = `kehadiran/${attendanceRef.id}/${Date.now()}_${safeName}`;
        const uploadTask = storage.ref(path).put(fotoFile);
        await new Promise((res, rej) => uploadTask.on('state_changed', ()=>{}, rej, res));
        const url = await storage.ref(path).getDownloadURL();
        await attendanceRef.update({ fotoURL: url });
      }

      showToast('Kehadiran terkirim ✓', 'ok', 2200);
      const selectedOptionText = namaSel.selectedOptions && namaSel.selectedOptions[0] ? namaSel.selectedOptions[0].text : guruId;
      pushRecent(`Kirim ${status} — (${selectedOptionText})`);
      // reset preview
      if (photoInput) photoInput.value = ''; if (photoPreview){ photoPreview.src=''; photoPreview.classList.add('hidden'); }

    } catch (err) {
      console.error('submit kehadiran error', err);
      // fallback: simpan lokal untuk sync manual
      const pending = JSON.parse(localStorage.getItem('kehadiran_pending') || '[]');
      pending.push({ guruId, status, lokasi, createdAt: new Date().toISOString() });
      localStorage.setItem('kehadiran_pending', JSON.stringify(pending));
      showToast('Gagal kirim ke server — disimpan lokal.', 'err', 3500);
    } finally {
      kirimBtn.disabled = false; if (statusLabel) setTimeout(()=> statusLabel.textContent = '—', 1500);
    }
  });

  // ---------------- Dashboard counts ----------------
  async function updateDashboardCounts(){
    try {
      const start = new Date(); start.setHours(0,0,0,0);
      const q = firestore.collection('kehadiran').where('createdAt', '>=', start);
      const snap = await q.get();
      let hadir = 0, lain = 0;
      snap.docs.forEach(d => { const v = d.data(); if (v && v.status === 'Hadir') hadir++; else if (v) lain++; });
      const gurusSnap = await firestore.collection('gurus').get();
      const totalGuru = gurusSnap.size || 0;
      document.getElementById('totalGuru') && (document.getElementById('totalGuru').textContent = totalGuru);
      document.getElementById('totalHadir') && (document.getElementById('totalHadir').textContent = hadir);
      document.getElementById('totalLain') && (document.getElementById('totalLain').textContent = lain);
      if (chart) { chart.data.datasets[0].data = [hadir, lain, Math.max(0, totalGuru - (hadir+lain))]; chart.update(); }
    } catch (err) { console.error('updateDashboardCounts error', err); }
  }
  updateDashboardCounts();

  // realtime-ish listener for today's attendance
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    firestore.collection('kehadiran').where('createdAt', '>=', todayStart).onSnapshot(snap => {
      updateDashboardCounts();
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added') {
          const d = ch.doc.data();
          // best-effort to resolve guru name
          firestore.collection('gurus').doc(d.guruId).get().then(gDoc => {
            const nama = gDoc.exists ? (gDoc.data().nama || 'Guru') : 'Guru';
            pushRecent(`${d.status} — (${nama})`);
          }).catch(()=> pushRecent(`${d.status} — (Guru)`));
        }
      });
    });
  } catch(e){ console.warn('attach kehadiran listener failed', e); }

  // ---------------- Admin (stub) ----------------
  document.getElementById('btn-open-admin')?.addEventListener('click', ()=>{
    // implement login flow here (email/password) if mau
    showToast('Fitur admin: login belum diaktifkan. Saya bisa tambahkan jika mau.', 'info', 2500);
  });
  document.getElementById('btn-admin-logout')?.addEventListener('click', ()=>{
    showToast('Logout (belum aktif).', 'info', 1400);
  });

  // ---------------- Laporan download ----------------
  window.downloadLaporan = function(url){
    if (!confirm('Download laporan bulanan? (Admin only)')) return;
    // if your cloud function perlu token admin, implement auth and pass token.
    window.open(url, '_blank');
  };

  // ---------------- Small accessibility helpers ----------------
  $$('.nav-item').forEach(btn=> btn.addEventListener('keydown', e=>{ if (e.key === 'Enter' || e.key === ' ') { btn.click(); e.preventDefault(); } }));

  // ---------------- End ----------------
})();
