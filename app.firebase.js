// app.firebase.js
// Realtime Database (compat) + Auth (compat) integration for WebsiteHadir
// Place this file in the same folder as index.html and ensure index.html loads:
//  - firebase-app-compat.js
//  - firebase-database-compat.js
//  - firebase-auth-compat.js
// BEFORE loading this file.

(function(){
  // ---------- CONFIG: paste your firebaseConfig here ----------
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

  // initialize
  try {
    firebase.initializeApp(firebaseConfig);
  } catch(e){
    console.warn('Firebase init warning:', e && e.message ? e.message : e);
  }

  const db = firebase.database();
  const auth = firebase.auth();

  // localStorage keys used by UI (keep consistent with index.html)
  const LS_GURU = 'wh_demo_guru_v1';
  const LS_ATT = 'wh_demo_att_v1';

  // Helpers
  function now(){ return Date.now(); }
  function snapToArray(snap){
    const out = [];
    snap.forEach(ch => {
      const v = ch.val();
      v.id = ch.key;
      out.push(v);
    });
    return out;
  }

  // ------------------ Realtime DB listeners ------------------
  let gurusListener = null;
  let attListener = null;

  function startListeners(){
    // /gurus
    if (!gurusListener){
      const refG = db.ref('/gurus');
      gurusListener = refG.on('value', (snap) => {
        const arr = snapToArray(snap);
        const normalized = arr.map(g => ({ id: g.id, nip: g.nip||'', nama: g.nama||g.name||'', jabatan: g.jabatan||'', status: g.status||'Aktif', createdAt: g.createdAt||0 }));
        try { localStorage.setItem(LS_GURU, JSON.stringify(normalized)); } catch(e){}
        window.__latest_guru_list = normalized;
        window.dispatchEvent(new CustomEvent('gurus-updated', { detail: normalized }));
      }, (err) => { console.error('gurus listener error', err); });
    }

    // /attendances
    if (!attListener){
      const refA = db.ref('/attendances');
      attListener = refA.on('value', (snap) => {
        const arr = snapToArray(snap);
        const normalized = arr.map(a => ({
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
        try { localStorage.setItem(LS_ATT, JSON.stringify(normalized)); } catch(e){}
        window.__latest_att_list = normalized;
        window.dispatchEvent(new CustomEvent('attendances-updated', { detail: normalized }));
      }, (err) => { console.error('attendances listener error', err); });
    }
  }

  // manual one-shot sync (reads & stores into localStorage)
  async function syncFromFirebase(){
    try {
      const [gSnap, aSnap] = await Promise.all([ db.ref('/gurus').once('value'), db.ref('/attendances').once('value') ]);
      const gArr = snapToArray(gSnap).map(g => ({ id: g.id, nip: g.nip||'', nama: g.nama||g.name||'', jabatan: g.jabatan||'', status: g.status||'Aktif', createdAt: g.createdAt||0 }));
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

  // ------------------ CRUD: Gurus ------------------
  async function addGuruFirebase(g){
    if (!g || !g.nama) throw new Error('Nama guru diperlukan');
    const ref = db.ref('/gurus').push();
    const id = ref.key;
    const payload = { nip: g.nip||'', nama: g.nama, jabatan: g.jabatan||'', status: g.status||'Aktif', createdAt: now() };
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

  // ------------------ CRUD: Attendances ------------------
  // payload: { idGuru, namaGuru, status, tanggal, jam, lokasiLabel, placeName }
  async function addAttendanceFirebase(payload){
    if (!payload || !payload.tanggal) throw new Error('Payload attendance harus berisi tanggal');
    const ref = db.ref('/attendances').push();
    const id = ref.key;
    const yearMonth = (payload.tanggal || '').slice(0,7) || '';
    const p = Object.assign({}, payload, { createdAt: now(), yearMonth });
    await ref.set(p);
    return Object.assign({ id }, p);
  }

  // query monthly report from server efficiently (orderByChild + equalTo on yearMonth)
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

  // ------------------ Auth (email/password) ------------------
  // Ensure firebase-auth-compat.js loaded in index.html
  // Expose signInWithEmail & signOut, and dispatch 'auth-changed' events with admin claim
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
      window.__WH_FIREBASE = window.__WH_FIREBASE || {};
      window.__WH_FIREBASE.currentUser = null;
      return;
    }
    try {
      const idTokenResult = await user.getIdTokenResult(true);
      const claims = idTokenResult.claims || {};
      const isAdmin = !!claims.admin;
      const detail = { uid: user.uid, email: user.email, admin: isAdmin };
      window.__WH_FIREBASE = window.__WH_FIREBASE || {};
      window.__WH_FIREBASE.currentUser = detail;
      window.dispatchEvent(new CustomEvent('auth-changed', { detail }));
    } catch(err){
      console.error('getIdTokenResult error', err);
      const detail = { uid: user.uid, email: user.email, admin: false };
      window.__WH_FIREBASE = window.__WH_FIREBASE || {};
      window.__WH_FIREBASE.currentUser = detail;
      window.dispatchEvent(new CustomEvent('auth-changed', { detail }));
    }
  });

  async function signInWithEmail(email, password){
    if (!email || !password) throw new Error('Email & password diperlukan');
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const idTokenResult = await cred.user.getIdTokenResult(true);
    const isAdmin = !!(idTokenResult.claims && idTokenResult.claims.admin);
    const detail = { uid: cred.user.uid, email: cred.user.email, admin: isAdmin };
    window.__WH_FIREBASE = window.__WH_FIREBASE || {};
    window.__WH_FIREBASE.currentUser = detail;
    window.dispatchEvent(new CustomEvent('auth-changed', { detail }));
    return detail;
  }

  async function signOutFirebase(){
    await auth.signOut();
    window.__WH_FIREBASE = window.__WH_FIREBASE || {};
    window.__WH_FIREBASE.currentUser = null;
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
    return true;
  }

  // ------------------ Expose functions to window ------------------
  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;
  window.addAttendanceFirebase = addAttendanceFirebase;
  window.getMonthlyReportFirebase = getMonthlyReportFirebase;
  window.syncFromFirebase = syncFromFirebase;
  window.signInWithEmail = signInWithEmail;
  window.signOutFirebase = signOutFirebase;

  // start listeners immediately
  startListeners();

  // expose debug object
  window.__WH_FIREBASE = Object.assign(window.__WH_FIREBASE||{}, { dbRef: db, authRef: auth, startListeners });

  console.log('app.firebase.js initialized — DB listeners & auth handlers active.');
})();
