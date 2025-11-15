// app.firebase.js
// Menggunakan Firebase compat scripts yang sudah dimuat di index.html:
// <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database-compat.js"></script>
//
// File ini memasang listener realtime ke /gurus dan /attendances,
// menyediakan fungsi CRUD yang dipanggil dari index.html, dan
// menyimpan data hasil sync ke localStorage agar UI tetap bekerja offline.

(function(){
  // ---------- CONFIG: diisi dari input pengguna ----------
  const firebaseConfig = {
    apiKey: "AIzaSyDy5lJ8rk9yondEFH_ARB_GQAEdi-PMDIU",
    authDomain: "websitehadirsekolah.firebaseapp.com",
    databaseURL: "https://websitehadirsekolah-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "websitehadirsekolah",
    storageBucket: "websitehadirsekolah.firebasestorage.app",
    messagingSenderId: "811289978131",
    appId: "1:811289978131:web:ad0bd0b113dd1c733a26e6",
    measurementId: "G-PK0811G8VJ"
  };
  // -----------------------------------------------------------------------

  // init
  try {
    firebase.initializeApp(firebaseConfig);
  } catch(e){
    console.warn('Firebase init warning (may be already initialized):', e && e.message ? e.message : e);
  }
  const db = firebase.database();

  // helpers
  function now() { return Date.now(); }
  function uid() { return db.ref().push().key; } // generate key

  // read/write localStorage keys used in UI
  const LS_GURU = 'wh_demo_guru_v1';
  const LS_ATT = 'wh_demo_att_v1';

  // ----- Firebase listeners & sync -----
  let gurusListener = null;
  let attListener = null;

  // Convert snapshot children to array with id
  function snapToArray(snap){
    const out = [];
    snap.forEach(ch => {
      const v = ch.val();
      v.id = ch.key;
      out.push(v);
    });
    return out;
  }

  // start realtime listeners
  function startListeners(){
    // attach if not yet
    if (!gurusListener) {
      const refG = db.ref('/gurus');
      gurusListener = refG.on('value', (snap) => {
        const arr = snapToArray(snap);
        // normalize fields: ensure nama, nip, jabatan, status exist
        const normalized = arr.map(g => ({ id: g.id, nip: g.nip||'', nama: g.nama||g.name||'', jabatan: g.jabatan||'', status: g.status||'Aktif' }));
        try { localStorage.setItem(LS_GURU, JSON.stringify(normalized)); } catch(e){}
        // dispatch event for UI
        window.__latest_guru_list = normalized;
        window.dispatchEvent(new CustomEvent('gurus-updated', { detail: normalized }));
      }, (err) => { console.error('gurus listener error', err); });
    }

    if (!attListener) {
      const refA = db.ref('/attendances');
      attListener = refA.on('value', (snap) => {
        const arr = snapToArray(snap);
        // normalize attendance fields (idGuru, namaGuru, status, tanggal, jam, lokasiLabel, placeName, createdAt, yearMonth)
        const normalized = arr.map(a => ({
          id: a.id,
          idGuru: a.idGuru || '',
          namaGuru: a.namaGuru || a.name || '',
          status: a.status || '',
          tanggal: a.tanggal || '',        // 'YYYY-MM-DD'
          jam: a.jam || '',
          lokasiLabel: a.lokasiLabel || a.location || '',
          placeName: a.placeName || '',
          createdAt: a.createdAt || 0,
          yearMonth: a.yearMonth || ((a.tanggal||'').slice(0,7) || '')
        }));
        try { localStorage.setItem(LS_ATT, JSON.stringify(normalized)); } catch(e){}
        // dispatch event for attendance update
        window.__latest_att_list = normalized;
        window.dispatchEvent(new CustomEvent('attendances-updated', { detail: normalized }));
      }, (err) => { console.error('attendances listener error', err); });
    }
  }

  // public: trigger a manual one-shot sync (read once and store)
  async function syncFromFirebase(){
    try {
      const [gSnap, aSnap] = await Promise.all([ db.ref('/gurus').once('value'), db.ref('/attendances').once('value') ]);
      const gArr = snapToArray(gSnap).map(g => ({ id: g.id, nip: g.nip||'', nama: g.nama||g.name||'', jabatan: g.jabatan||'', status: g.status||'Aktif' }));
      const aArr = snapToArray(aSnap).map(a => ({
        id: a.id,
        idGuru: a.idGuru || '',
        namaGuru: a.namaGuru || a.name || '',
        status: a.status || '',
        tanggal: a.tanggal || '',
        jam: a.jam || '',
        lokasiLabel: a.lokasiLabel || a.location || '',
        placeName: a.placeName || '',
        createdAt: a.createdAt || 0,
        yearMonth: a.yearMonth || ((a.tanggal||'').slice(0,7) || '')
      }));
      localStorage.setItem(LS_GURU, JSON.stringify(gArr));
      localStorage.setItem(LS_ATT, JSON.stringify(aArr));
      window.__latest_guru_list = gArr;
      window.__latest_att_list = aArr;
      window.dispatchEvent(new CustomEvent('gurus-updated', { detail: gArr }));
      window.dispatchEvent(new CustomEvent('attendances-updated', { detail: aArr }));
      return { gurus: gArr, attendances: aArr };
    } catch(err){
      console.error('syncFromFirebase error', err);
      throw err;
    }
  }

  // ---------- CRUD functions for Gurus ----------
  async function addGuruFirebase(g){
    // g: { nip, nama, jabatan }
    if (!g || !g.nama) throw new Error('Nama guru diperlukan');
    const ref = db.ref('/gurus').push();
    const id = ref.key;
    const payload = {
      nip: g.nip || '',
      nama: g.nama,
      jabatan: g.jabatan || '',
      status: g.status || 'Aktif',
      createdAt: now()
    };
    await ref.set(payload);
    return Object.assign({ id }, payload);
  }

  async function updateGuruFirebase(id, payload){
    if (!id) throw new Error('ID guru diperlukan');
    const ref = db.ref(`/gurus/${id}`);
    await ref.update(payload);
    return true;
  }

  async function deleteGuruFirebase(id){
    if (!id) throw new Error('ID guru diperlukan');
    const ref = db.ref(`/gurus/${id}`);
    await ref.remove();
    return true;
  }

  // ---------- Attendance (Kehadiran) ----------
  // payload should contain: idGuru, namaGuru, status, tanggal (YYYY-MM-DD), jam (HH:MM), lokasiLabel, placeName
  async function addAttendanceFirebase(payload){
    if (!payload || !payload.tanggal) throw new Error('Payload attendance harus berisi tanggal');
    const ref = db.ref('/attendances').push();
    const id = ref.key;
    const yearMonth = (payload.tanggal || '').slice(0,7) || '';
    const p = Object.assign({}, payload, { createdAt: now(), yearMonth });
    await ref.set(p);
    return Object.assign({ id }, p);
  }

  // convenience: get monthly report directly from firebase (filtered by yearMonth)
  async function getMonthlyReportFirebase(yearMonth){
    if (!yearMonth) throw new Error('yearMonth diperlukan (format YYYY-MM)');
    const ref = db.ref('/attendances');
    const q = ref.orderByChild('yearMonth').equalTo(yearMonth);
    const snap = await q.once('value');
    const arr = snapToArray(snap).map(a => ({
      id: a.id,
      idGuru: a.idGuru || '',
      namaGuru: a.namaGuru || '',
      status: a.status || '',
      tanggal: a.tanggal || '',
      jam: a.jam || '',
      lokasiLabel: a.lokasiLabel || '',
      placeName: a.placeName || '',
      createdAt: a.createdAt || 0,
      yearMonth: a.yearMonth || (a.tanggal||'').slice(0,7)
    }));
    return arr;
  }

  // ---------- Expose functions on window for index.html to call ----------
  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;
  window.addAttendanceFirebase = addAttendanceFirebase;
  window.getMonthlyReportFirebase = getMonthlyReportFirebase;
  window.syncFromFirebase = syncFromFirebase;

  // auto-start listeners
  startListeners();

  // For debugging: attach db reference
  window.__WH_FIREBASE = { dbRef: db, startListeners };

  console.log('app.firebase.js initialized (Realtime DB compat). Listeners started.');

})();
