/**
 * app.firebase.js - FINAL VERSION
 * Sistem Kehadiran Guru SDN Muhara
 */

console.log("🚀 Loading app.firebase.js");

(function () {
  // ======================================================
  // 1. FIREBASE CONFIGURATION
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
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK tidak ditemukan!');
    window.whUseFirebase = false;
    return;
  }

  // Initialize Firebase
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized');
  } catch (err) {
    console.warn('Firebase sudah diinisialisasi:', err.message);
  }

  const db = firebase.database();
  const auth = firebase.auth();

  // ======================================================
  // 2. UTILITY FUNCTIONS
  // ======================================================
  function emit(name, detail) {
    try {
      const ev = new CustomEvent(name, { detail });
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
    } catch (e) {
      console.error('Emit error:', e);
    }
  }

  function normalizeSnapshotToArray(snapVal) {
    if (!snapVal) return [];
    if (Array.isArray(snapVal)) {
      return snapVal.map((v, i) => ({ ...v, id: v.id || String(i) }));
    }
    return Object.entries(snapVal).map(([k, v]) => ({ ...v, id: v.id || k }));
  }

  // ======================================================
  // 3. AUTHENTICATION FUNCTIONS
  // ======================================================
  async function signInWithEmail(email, password) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      
      // Always treat as admin for demo
      const isAdmin = true;
      
      emit('auth-changed', {
        uid: cred.user.uid,
        email: cred.user.email,
        admin: isAdmin
      });
      
      return cred.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function signOutFirebase() {
    try {
      await auth.signOut();
      emit('auth-changed', null);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Auth state listener
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Always treat as admin for demo
      emit('auth-changed', {
        uid: user.uid,
        email: user.email,
        admin: true
      });
    } else {
      emit('auth-changed', null);
    }
  });

  // ======================================================
  // 4. GURU FUNCTIONS (Admin Only)
  // ======================================================
  async function addGuruFirebase(data) {
    try {
      const ref = db.ref('gurus').push();
      const guruData = {
        id: ref.key,
        nip: data.nip || '',
        nama: data.nama || '',
        jabatan: data.jabatan || '',
        password: '20203605', // PIN SAMA UNTUK SEMUA
        status: 'Aktif',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      
      await ref.set(guruData);
      emit('gurus-updated', normalizeSnapshotToArray((await db.ref('gurus').once('value')).val()));
      return guruData;
    } catch (error) {
      console.error('Add guru error:', error);
      throw error;
    }
  }

  async function updateGuruFirebase(id, data) {
    try {
      await db.ref('gurus/' + id).update({
        ...data,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      emit('gurus-updated', normalizeSnapshotToArray((await db.ref('gurus').once('value')).val()));
      return true;
    } catch (error) {
      console.error('Update guru error:', error);
      throw error;
    }
  }

  async function deleteGuruFirebase(id) {
    try {
      await db.ref('gurus/' + id).remove();
      emit('gurus-updated', normalizeSnapshotToArray((await db.ref('gurus').once('value')).val()));
      return true;
    } catch (error) {
      console.error('Delete guru error:', error);
      throw error;
    }
  }

  // ======================================================
  // 5. ATTENDANCE FUNCTIONS (All Users)
  // ======================================================
  async function addAttendanceFirebase(data) {
    try {
      // Check if already attended today
      const today = data.tanggal;
      const indexKey = `${data.idGuru}_${today}`;
      const indexSnap = await db.ref('attendance_index/' + indexKey).once('value');
      
      if (indexSnap.exists()) {
        const error = new Error('Anda sudah absen hari ini');
        error.code = 'already-attended';
        throw error;
      }

      // Save attendance
      const ref = db.ref('attendances').push();
      const attendanceData = {
        id: ref.key,
        idGuru: data.idGuru || '',
        namaGuru: data.namaGuru || '',
        status: data.status || 'Hadir',
        tanggal: today,
        jam: data.jam || new Date().toLocaleTimeString('id-ID'),
        tempat: data.tempat || '',
        lat: data.lat || null,
        lon: data.lon || null,
        photoBase64: data.photoBase64 || null,
        photoSize: data.photoSize || null,
        hasPhoto: !!data.photoBase64,
        verifiedByPin: data.verifiedByPin || false,
        userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
        timestamp: firebase.database.ServerValue.TIMESTAMP
      };
      
      await ref.set(attendanceData);
      
      // Save index to prevent double attendance
      try {
        await db.ref('attendance_index/' + indexKey).set({
          attendanceId: ref.key,
          timestamp: Date.now()
        });
      } catch (indexError) {
        console.warn('Index save warning:', indexError);
      }
      
      emit('attendances-updated', normalizeSnapshotToArray((await db.ref('attendances').once('value')).val()));
      return attendanceData;
    } catch (error) {
      console.error('Add attendance error:', error);
      throw error;
    }
  }

  // ======================================================
  // 6. REALTIME LISTENERS
  // ======================================================
  db.ref('gurus').on('value', (snap) => {
    try {
      const arr = normalizeSnapshotToArray(snap.val());
      emit('gurus-updated', arr);
      console.log('Gurus updated:', arr.length);
    } catch (error) {
      console.error('Gurus listener error:', error);
    }
  });

  db.ref('attendances').on('value', (snap) => {
    try {
      const arr = normalizeSnapshotToArray(snap.val());
      emit('attendances-updated', arr);
      console.log('Attendances updated:', arr.length);
    } catch (error) {
      console.error('Attendances listener error:', error);
    }
  });

  // ======================================================
  // 7. SYNC FUNCTION
  // ======================================================
  async function syncFromFirebase() {
    try {
      const [gurusSnap, attendancesSnap] = await Promise.all([
        db.ref('gurus').once('value'),
        db.ref('attendances').once('value')
      ]);
      
      const gurus = normalizeSnapshotToArray(gurusSnap.val());
      const attendances = normalizeSnapshotToArray(attendancesSnap.val());
      
      // Save to localStorage as backup
      try {
        localStorage.setItem('wh_guru_list_v1', JSON.stringify(gurus));
        localStorage.setItem('wh_att_list_v1', JSON.stringify(attendances));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      
      emit('gurus-updated', gurus);
      emit('attendances-updated', attendances);
      
      return { gurus, attendances };
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }

  // ======================================================
  // 8. EXPORT FUNCTIONS
  // ======================================================
  window.signInAdmin = signInWithEmail;
  window.signOutAdmin = signOutFirebase;
  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;
  window.addAttendanceFirebase = addAttendanceFirebase;
  window.syncFromFirebase = syncFromFirebase;
  window.whUseFirebase = true;

  console.log('✅ app.firebase.js loaded successfully');

  // Initial sync
  setTimeout(() => {
    syncFromFirebase().catch(err => {
      console.warn('Initial sync failed:', err);
    });
  }, 1000);

})();
