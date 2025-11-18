/**
 * app.firebase.js — FINAL 2025
 * WebsiteHadirGuru • SDN Muhara
 * Firebase V10 compat
 */

console.log("Loading app.firebase.js...");

(function () {
  // ======================================================
  // 1) Firebase Config (gunakan milikmu)
  // ======================================================
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

  // ======================================================
  // 2) Init Firebase
  // ======================================================
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const auth = firebase.auth();

  window.__WH_FIREBASE = {
    app: firebase,
    auth,
    db,
    currentUser: null
  };

  console.log("Firebase initialized ✓");

  // small helper
  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // ======================================================
  // 3) AUTH HANDLERS (email/password login admin)
  // ======================================================
  async function signInWithEmail(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function signOutFirebase() {
    return auth.signOut();
  }

  window.signInWithEmail = signInWithEmail;
  window.signOutFirebase = signOutFirebase;

  // listen to auth state changes
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.__WH_FIREBASE.currentUser = null;
      emit("auth-changed", null);
      return;
    }

    // refresh token for custom claims
    const token = await user.getIdTokenResult(true);
    const isAdmin = token.claims.admin === true;

    window.__WH_FIREBASE.currentUser = {
      uid: user.uid,
      email: user.email,
      admin: isAdmin
    };

    emit("auth-changed", window.__WH_FIREBASE.currentUser);
  });

  // ======================================================
  // 4) GURU FUNCTIONS
  // ======================================================
  async function addGuruFirebase(data) {
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
  }

  async function updateGuruFirebase(id, updates) {
    if (!id) throw new Error("id guru kosong");
    await db.ref("gurus/" + id).update(updates);
    return true;
  }

  async function deleteGuruFirebase(id) {
    if (!id) throw new Error("id guru kosong");
    await db.ref("gurus/" + id).remove();
    return true;
  }

  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;

  // ======================================================
  // 5) ATTENDANCE FUNCTIONS
  // ======================================================
  async function addAttendanceFirebase(data) {
    const ref = db.ref("attendances").push();
    const payload = {
      id: ref.key,
      idGuru: data.idGuru || "",
      namaGuru: data.namaGuru || "",
      status: data.status || "Hadir",
      tanggal: data.tanggal || new Date().toISOString().slice(0, 10),
      jam: data.jam || new Date().toLocaleTimeString("id-ID"),
      lokasi: data.lokasi || "",
      tempat: data.tempat || "",
      lat: data.lat || "",
      lon: data.lon || ""
    };
    await ref.set(payload);
    return payload;
  }

  window.addAttendanceFirebase = addAttendanceFirebase;

  // ======================================================
  // 6) REALTIME LISTENERS (Guru + Attendance)
  // ======================================================
  db.ref("gurus").on("value", (snap) => {
    const data = snap.val() || {};
    const arr = Object.values(data);
    emit("gurus-updated", arr);
    console.log("Realtime: gurus updated", arr.length);
  });

  db.ref("attendances").on("value", (snap) => {
    const data = snap.val() || {};
    const arr = Object.values(data);
    emit("attendances-updated", arr);
    console.log("Realtime: attendances updated", arr.length);
  });

  // ======================================================
  // 7) SYNC FROM SERVER (called on load)
  // ======================================================
  async function syncFromFirebase() {
    const gSnap = await db.ref("gurus").once("value");
    const aSnap = await db.ref("attendances").once("value");

    const gArr = gSnap.val() ? Object.values(gSnap.val()) : [];
    const aArr = aSnap.val() ? Object.values(aSnap.val()) : [];

    localStorage.setItem("wh_guru_list_v1", JSON.stringify(gArr));
    localStorage.setItem("wh_att_list_v1", JSON.stringify(aArr));

    return { gArr, aArr };
  }

  window.syncFromFirebase = syncFromFirebase;

  // ======================================================
  // 8) READY
  // ======================================================
  console.log("app.firebase.js fully loaded ✓");
})();
