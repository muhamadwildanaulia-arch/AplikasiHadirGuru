/**
 * app.firebase.fixed.js — Final with Admin & Auth Check
 * WebsiteHadirGuru • SDN Muhara
 * Firebase V10 compat (compat SDK)
 */

console.log("Loading app.firebase.js (fixed)...");

(function () {
  // ======================================================
  // 1) Firebase Config (gunakan milikmu)
  // ======================================================
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

  // defensive: ensure firebase lib hadir
  if (typeof firebase === 'undefined' || !firebase.database) {
    console.error('Firebase SDK tidak ditemukan. Pastikan <script src="https://www.gstatic.com/firebasejs/..."> sudah dimuat di index.html');
    return;
  }

  // ======================================================
  // 2) Init Firebase
  // ======================================================
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (err) {
    // jika sudah di-init sebelumnya di halaman lain, ignore
    console.warn('firebase.initializeApp warning:', err && err.message ? err.message : err);
  }
  const db = firebase.database();
  const auth = firebase.auth();

  window.__WH_FIREBASE = {
    app: firebase,
    auth,
    db,
    currentUser: null
  };

  console.log("Firebase initialized ✓");

  // small helper: emit to both window & document for compatibility
  function emit(name, detail) {
    try {
      // older code attached listeners to window; some to document — kirim ke keduanya
      const ev = new CustomEvent(name, { detail });
      try { window.dispatchEvent(ev); } catch(e) { /* ignore */ }
      try { document.dispatchEvent(ev); } catch(e) { /* ignore */ }
    } catch (e) {
      console.error('emit error', e);
    }
  }

  // utility: normalisasi snapshot value -> array of items with id
  function normalizeSnapshotToArray(snapVal) {
    if (!snapVal) return [];
    if (Array.isArray(snapVal)) {
      // ensure each item has id if available
      return snapVal.map((v, i) => (v && v.id) ? v : Object.assign({}, v || {}, { id: (v && v.id) ? v.id : String(i) }));
    }
    // object map: include key as id if missing
    return Object.entries(snapVal).map(([k, v]) => {
      if (!v) return { id: k };
      if (typeof v === 'object') {
        return Object.assign({}, v, { id: (v.id || k) });
      }
      // scalar value (unexpected) -> wrap
      return { id: k, value: v };
    });
  }

  // Utility: Cek apakah pengguna saat ini adalah Admin
  function checkAdminAuth() {
    const user = window.__WH_FIREBASE.currentUser;
    if (!user || !user.admin) {
      const error = new Error('Akses ditolak: Hanya Admin yang dapat melakukan operasi ini.');
      error.code = 'permission-denied';
      throw error;
    }
    return true;
  }

  // ======================================================
  // 3) AUTH HANDLERS (email/password login admin)
  // ======================================================
  async function signInWithEmail(email, password) {
    if (!email || !password) throw Object.assign(new Error('email & password diperlukan'), { code: 'auth/invalid-args' });
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      // return user object for UI fallback; `auth.onAuthStateChanged` akan emit event
      return cred.user;
    } catch (err) {
      // forward firebase error (has .code & .message)
      console.error('signIn error', err);
      throw err;
    }
  }

  async function signOutFirebase() {
    try {
      return await auth.signOut();
    } catch (err) {
      console.error('signOut error', err);
      throw err;
    }
  }

  // Alias yang digunakan di index.html untuk fitur Admin
  window.signInAdmin = signInWithEmail;
  window.signOutAdmin = signOutFirebase;

  // listen to auth state changes
  auth.onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        window.__WH_FIREBASE.currentUser = null;
        emit("auth-changed", null);
        return;
      }

      // refresh token for custom claims — prefer force refresh only when needed
      let isAdmin = false;
      try {
        // Mendapatkan token baru untuk memeriksa custom claims
        const token = await user.getIdTokenResult(true); 
        // Asumsi: Admin memiliki custom claim { admin: true }
        isAdmin = token && token.claims && token.claims.admin === true;
      } catch (e) {
        console.warn('getIdTokenResult failed', e);
      }

      window.__WH_FIREBASE.currentUser = {
        uid: user.uid,
        email: user.email,
        admin: !!isAdmin
      };

      emit("auth-changed", window.__WH_FIREBASE.currentUser);
    } catch(e){
      console.error('onAuthStateChanged handler error', e);
    }
  });

  // ======================================================
  // 4) GURU FUNCTIONS (Admin-Only)
  // ======================================================
  async function addGuruFirebase(data) {
    checkAdminAuth(); // <-- Admin Check
    try {
      const ref = db.ref("gurus").push();
      const newData = {
        id: ref.key,
        nip: data.nip || "",
        nama: data.nama || "",
        jabatan: data.jabatan || "",
        status: "Aktif"
      };
      await ref.set(newData);
      return newData;
    } catch (err) {
      console.error('addGuruFirebase error', err);
      throw err;
    }
  }

  async function updateGuruFirebase(id, updates) {
    checkAdminAuth(); // <-- Admin Check
    if (!id) throw Object.assign(new Error("id guru kosong"), { code: 'invalid-arg' });
    try {
      await db.ref("gurus/" + id).update(updates);
      return true;
    } catch (err) {
      console.error('updateGuruFirebase error', err);
      throw err;
    }
  }

  async function deleteGuruFirebase(id) {
    checkAdminAuth(); // <-- Admin Check
    if (!id) throw Object.assign(new Error("id guru kosong"), { code: 'invalid-arg' });
    try {
      await db.ref("gurus/" + id).remove();
      return true;
    } catch (err) {
      console.error('deleteGuruFirebase error', err);
      throw err;
    }
  }

  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;

  // ======================================================
  // 5) ATTENDANCE FUNCTIONS (Open Access)
  // ======================================================
  async function addAttendanceFirebase(data) {
    // Tidak perlu checkAdminAuth, karena ini adalah aksi pengisian kehadiran
    try {
      const ref = db.ref("attendances").push();
      const payload = {
        id: ref.key,
        idGuru: data.idGuru || "",
        namaGuru: data.namaGuru || (data.nama || ""),
        status: data.status || "Hadir",
        // store ISO date (YYYY-MM-DD) for easy grouping
        tanggal: data.tanggal || new Date().toISOString().slice(0, 10),
        jam: data.jam || new Date().toLocaleTimeString("id-ID"),
        lokasi: data.lokasi || "",
        tempat: data.tempat || data.tempatName || data.placeName || "",
        lat: (typeof data.lat !== 'undefined') ? data.lat : (data.latitude || ''),
        lon: (typeof data.lon !== 'undefined') ? data.lon : (data.longitude || '')
      };
      await ref.set(payload);
      return payload;
    } catch (err) {
      console.error('addAttendanceFirebase error', err);
      throw err;
    }
  }

  window.addAttendanceFirebase = addAttendanceFirebase;

  // ======================================================
  // 6) REALTIME LISTENERS (Guru + Attendance)
  // ======================================================
  // Use 'value' listeners and normalize to arrays with id fields
  db.ref("gurus").on("value", (snap) => {
    try {
      const raw = snap.val() || {};
      const arr = normalizeSnapshotToArray(raw);
      emit("gurus-updated", arr);
      console.log("Realtime: gurus updated", arr.length);
    } catch (err) {
      console.error('gurus on value handler', err);
    }
  });

  db.ref("attendances").on("value", (snap) => {
    try {
      const raw = snap.val() || {};
      const arr = normalizeSnapshotToArray(raw);
      emit("attendances-updated", arr);
      console.log("Realtime: attendances updated", arr.length);
    } catch (err) {
      console.error('attendances on value handler', err);
    }
  });

  // ======================================================
  // 7) SYNC FROM SERVER (called on load)
  // ======================================================
  async function syncFromFirebase() {
    try {
      const gSnap = await db.ref("gurus").once("value");
      const aSnap = await db.ref("attendances").once("value");

      const gArr = normalizeSnapshotToArray(gSnap.val());
      const aArr = normalizeSnapshotToArray(aSnap.val());

      // Simpan ke LocalStorage sebagai backup/cache
      localStorage.setItem("wh_guru_list_v1", JSON.stringify(gArr));
      localStorage.setItem("wh_att_list_v1", JSON.stringify(aArr));

      // also emit events so UI updates immediately
      emit("gurus-updated", gArr);
      emit("attendances-updated", aArr);

      return { gArr, aArr };
    } catch (err) {
      console.error('syncFromFirebase error', err);
      throw err;
    }
  }

  window.syncFromFirebase = syncFromFirebase;
  window.whUseFirebase = true; // Flag to indicate Firebase is active

  // ======================================================
  // 8) READY
  // ======================================================
  console.log("app.firebase.js (fixed) fully loaded ✓");
})();
