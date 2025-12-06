/**
 * app.firebase.fixed.js — FINAL VERSION
 * WebsiteHadirGuru • SDN Muhara
 * Firebase V8 SDK
 */

console.log("Loading app.firebase.js (final version)...");

(function () {
  // ======================================================
  // 1) FIREBASE CONFIG
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

  // Check Firebase SDK
  if (typeof firebase === 'undefined' || !firebase.database) {
    console.error('Firebase SDK tidak ditemukan.');
    return;
  }

  // ======================================================
  // 2) INIT FIREBASE
  // ======================================================
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('Firebase init warning:', err.message || err);
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

  // ======================================================
  // 3) UTILITY FUNCTIONS
  // ======================================================
  function emit(name, detail) {
    try {
      const ev = new CustomEvent(name, { detail });
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
    } catch (e) {
      console.error('emit error', e);
    }
  }

  function normalizeSnapshotToArray(snapVal) {
    if (!snapVal) return [];
    if (Array.isArray(snapVal)) {
      return snapVal.map((v, i) => ({ ...v, id: v.id || String(i) }));
    }
    return Object.entries(snapVal).map(([k, v]) => ({ ...v, id: v.id || k }));
  }

  // PERBAIKAN: Async check admin
  async function checkAdminAuth() {
    const user = window.__WH_FIREBASE.currentUser;
    if (!user) {
      // Coba refresh auth state
      await new Promise(resolve => setTimeout(resolve, 100));
      const refreshedUser = window.__WH_FIREBASE.currentUser;
      if (!refreshedUser) {
        const error = new Error('Anda belum login. Silakan login sebagai admin.');
        error.code = 'auth/not-logged-in';
        throw error;
      }
      if (!refreshedUser.admin) {
        const error = new Error('Akses ditolak: Hanya Admin yang dapat melakukan operasi ini.');
        error.code = 'permission-denied';
        throw error;
      }
      return true;
    }
    if (!user.admin) {
      const error = new Error('Akses ditolak: Hanya Admin yang dapat melakukan operasi ini.');
      error.code = 'permission-denied';
      throw error;
    }
    return true;
  }

  // ======================================================
  // 4) AUTH HANDLERS
  // ======================================================
  async function signInWithEmail(email, password) {
    if (!email || !password) {
      throw Object.assign(new Error('Email & password diperlukan'), { code: 'auth/invalid-args' });
    }
    
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      
      // Get fresh token with claims
      let isAdmin = false;
      try {
        const token = await cred.user.getIdTokenResult(true);
        isAdmin = token && token.claims && token.claims.admin === true;
      } catch (tokenError) {
        console.warn('Token check failed:', tokenError);
        // Fallback: if email is admin@sdnmuhara.sch.id
        isAdmin = email === 'admin@sdnmuhara.sch.id';
      }

      window.__WH_FIREBASE.currentUser = {
        uid: cred.user.uid,
        email: cred.user.email,
        admin: isAdmin
      };

      emit("auth-changed", window.__WH_FIREBASE.currentUser);
      return window.__WH_FIREBASE.currentUser;
      
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  }

  async function signOutFirebase() {
    try {
      await auth.signOut();
      window.__WH_FIREBASE.currentUser = null;
      emit("auth-changed", null);
      return true;
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  }

  // Auth state listener
  auth.onAuthStateChanged(async (user) => {
    try {
      if (!user) {
        window.__WH_FIREBASE.currentUser = null;
        emit("auth-changed", null);
        return;
      }

      // Check admin status
      let isAdmin = false;
      try {
        const token = await user.getIdTokenResult(true);
        isAdmin = token && token.claims && token.claims.admin === true;
      } catch (e) {
        console.warn('Auth state token check failed:', e);
        // Fallback: check email
        isAdmin = user.email === 'admin@sdnmuhara.sch.id';
      }

      window.__WH_FIREBASE.currentUser = {
        uid: user.uid,
        email: user.email,
        admin: isAdmin
      };

      emit("auth-changed", window.__WH_FIREBASE.currentUser);
      
    } catch(e) {
      console.error('Auth state changed error:', e);
    }
  });

  // ======================================================
  // 5) GURU FUNCTIONS (Admin Only)
  // ======================================================
  async function addGuruFirebase(data) {
    try {
      await checkAdminAuth();
      
      const ref = db.ref("gurus").push();
      const newData = {
        id: ref.key,
        nip: data.nip || "",
        nama: data.nama || "",
        jabatan: data.jabatan || "",
        status: "Aktif",
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      
      await ref.set(newData);
      return newData;
      
    } catch (err) {
      console.error('addGuruFirebase error:', err);
      throw err;
    }
  }

  async function updateGuruFirebase(id, updates) {
    try {
      await checkAdminAuth();
      
      if (!id) {
        throw Object.assign(new Error("ID guru kosong"), { code: 'invalid-arg' });
      }
      
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      };
      
      await db.ref("gurus/" + id).update(updatesWithTimestamp);
      return true;
      
    } catch (err) {
      console.error('updateGuruFirebase error:', err);
      throw err;
    }
  }

  async function deleteGuruFirebase(id) {
    try {
      await checkAdminAuth();
      
      if (!id) {
        throw Object.assign(new Error("ID guru kosong"), { code: 'invalid-arg' });
      }
      
      await db.ref("gurus/" + id).remove();
      return true;
      
    } catch (err) {
      console.error('deleteGuruFirebase error:', err);
      throw err;
    }
  }

  // ======================================================
  // 6) ATTENDANCE FUNCTIONS (All Users)
  // ======================================================
  async function addAttendanceFirebase(data) {
    try {
      // Cek apakah user sudah login (tidak harus admin)
      if (!auth.currentUser) {
        throw new Error('Silakan login terlebih dahulu');
      }

      const today = data.tanggal || new Date().toISOString().slice(0, 10);
      const indexKey = `${data.idGuru}_${today}`;
      
      // 1. Cek sudah absen hari ini (server-side check)
      const indexSnap = await db.ref("attendance_index/" + indexKey).once('value');
      if (indexSnap.exists()) {
        const error = new Error('Anda sudah absen hari ini');
        error.code = 'already-attended';
        throw error;
      }

      // 2. Simpan data absensi
      const ref = db.ref("attendances").push();
      const payload = {
        id: ref.key,
        idGuru: data.idGuru || "",
        namaGuru: data.namaGuru || "",
        status: data.status || "Hadir",
        tanggal: today,
        jam: data.jam || new Date().toLocaleTimeString("id-ID"),
        tempat: data.tempat || "",
        lat: data.lat || null,
        lon: data.lon || null,
        photoBase64: data.photoBase64 || null,
        photoSize: data.photoSize || null,
        hasPhoto: !!data.photoBase64,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          isMobile: /Mobi|Android/i.test(navigator.userAgent)
        },
        userId: auth.currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        syncVersion: '3.0-base64'
      };
      
      await ref.set(payload);
      
      // 3. Update index untuk cegah double absen
      try {
        await db.ref("attendance_index/" + indexKey).set(true);
      } catch (indexError) {
        console.warn('Index update warning (mungkin permission):', indexError);
        // Lanjutkan saja, absen tetap tersimpan
      }
      
      return payload;
      
    } catch (err) {
      console.error('addAttendanceFirebase error:', err);
      throw err;
    }
  }

  // ======================================================
  // 7) REALTIME LISTENERS
  // ======================================================
  db.ref("gurus").on("value", (snap) => {
    try {
      const raw = snap.val() || {};
      const arr = normalizeSnapshotToArray(raw);
      emit("gurus-updated", arr);
      console.log("Realtime: gurus updated", arr.length);
    } catch (err) {
      console.error('gurus listener error:', err);
    }
  });

  db.ref("attendances").on("value", (snap) => {
    try {
      const raw = snap.val() || {};
      const arr = normalizeSnapshotToArray(raw);
      emit("attendances-updated", arr);
      console.log("Realtime: attendances updated", arr.length);
    } catch (err) {
      console.error('attendances listener error:', err);
    }
  });

  // ======================================================
  // 8) SYNC FUNCTION
  // ======================================================
  async function syncFromFirebase() {
    try {
      const [gSnap, aSnap] = await Promise.all([
        db.ref("gurus").once("value"),
        db.ref("attendances").once("value")
      ]);

      const gArr = normalizeSnapshotToArray(gSnap.val());
      const aArr = normalizeSnapshotToArray(aSnap.val());

      // Backup ke localStorage
      try {
        localStorage.setItem("wh_guru_list_v1", JSON.stringify(gArr));
        localStorage.setItem("wh_att_list_v1", JSON.stringify(aArr));
      } catch (storageError) {
        console.warn('LocalStorage error:', storageError);
      }

      emit("gurus-updated", gArr);
      emit("attendances-updated", aArr);

      return { gurus: gArr, attendances: aArr };
      
    } catch (err) {
      console.error('syncFromFirebase error:', err);
      throw err;
    }
  }

  // ======================================================
  // 9) EXPORT FUNCTIONS
  // ======================================================
  window.signInAdmin = signInWithEmail;
  window.signOutAdmin = signOutFirebase;
  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;
  window.addAttendanceFirebase = addAttendanceFirebase;
  window.syncFromFirebase = syncFromFirebase;
  window.whUseFirebase = true;

  // ======================================================
  // 10) INITIAL SYNC
  // ======================================================
  // Auto-sync on load
  setTimeout(() => {
    syncFromFirebase().catch(err => {
      console.warn('Initial sync failed:', err);
    });
  }, 1000);

  console.log("app.firebase.js (final) fully loaded ✓");

})();
