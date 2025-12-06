/**
 * app.firebase.js - DEBUG VERSION
 */

console.log("🚀 Loading app.firebase.js - DEBUG MODE");

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
  console.log("📦 Firebase SDK status:", typeof firebase);
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK tidak ditemukan!');
    window.whUseFirebase = false;
    return;
  }

  // Initialize Firebase
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
  } catch (err) {
    console.warn('Firebase already initialized:', err.message);
  }

  const db = firebase.database();
  const auth = firebase.auth();
  
  console.log('🔗 Database reference:', db);
  console.log('🔐 Auth reference:', auth);

  // ======================================================
  // 2. UTILITY FUNCTIONS
  // ======================================================
  function emit(name, detail) {
    console.log(`📡 Emitting event: ${name}`, detail);
    try {
      const ev = new CustomEvent(name, { detail });
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
    } catch (e) {
      console.error('❌ Emit error:', e);
    }
  }

  function normalizeSnapshotToArray(snapVal) {
    console.log('📊 Normalizing snapshot:', snapVal);
    if (!snapVal) {
      console.log('📭 Snapshot is empty/null');
      return [];
    }
    
    if (Array.isArray(snapVal)) {
      console.log('📋 Snapshot is array');
      return snapVal.map((v, i) => ({ ...v, id: v.id || String(i) }));
    }
    
    console.log('📋 Snapshot is object, converting to array');
    const arr = Object.entries(snapVal).map(([k, v]) => ({ ...v, id: v.id || k }));
    console.log('📋 Converted array length:', arr.length);
    return arr;
  }

  // ======================================================
  // 3. AUTHENTICATION FUNCTIONS
  // ======================================================
  async function signInWithEmail(email, password) {
    console.log('🔐 Attempting login with:', email);
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      console.log('✅ Login successful:', cred.user.email);
      
      emit('auth-changed', {
        uid: cred.user.uid,
        email: cred.user.email,
        admin: true
      });
      
      return cred.user;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  async function signOutFirebase() {
    console.log('🚪 Attempting logout');
    try {
      await auth.signOut();
      emit('auth-changed', null);
      console.log('✅ Logout successful');
      return true;
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }

  // Auth state listener
  auth.onAuthStateChanged((user) => {
    console.log('👤 Auth state changed:', user ? user.email : 'No user');
    if (user) {
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
  // 4. GURU FUNCTIONS
  // ======================================================
  async function addGuruFirebase(data) {
    console.log('👨‍🏫 Adding guru:', data.nama);
    try {
      const ref = db.ref('gurus').push();
      const guruId = ref.key;
      console.log('📝 Generated guru ID:', guruId);
      
      const guruData = {
        id: guruId,
        nip: data.nip || '',
        nama: data.nama || '',
        jabatan: data.jabatan || '',
        password: '20203605',
        status: 'Aktif',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      
      console.log('💾 Saving guru data:', guruData);
      await ref.set(guruData);
      
      // Refresh data
      const updatedSnap = await db.ref('gurus').once('value');
      const updatedData = normalizeSnapshotToArray(updatedSnap.val());
      console.log('🔄 Updated guru list:', updatedData);
      
      emit('gurus-updated', updatedData);
      return guruData;
    } catch (error) {
      console.error('❌ Add guru error:', error);
      throw error;
    }
  }

  async function updateGuruFirebase(id, data) {
    console.log('✏️ Updating guru:', id, data);
    try {
      await db.ref('gurus/' + id).update({
        ...data,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      
      const updatedSnap = await db.ref('gurus').once('value');
      emit('gurus-updated', normalizeSnapshotToArray(updatedSnap.val()));
      return true;
    } catch (error) {
      console.error('❌ Update guru error:', error);
      throw error;
    }
  }

  async function deleteGuruFirebase(id) {
    console.log('🗑️ Deleting guru:', id);
    try {
      await db.ref('gurus/' + id).remove();
      
      const updatedSnap = await db.ref('gurus').once('value');
      emit('gurus-updated', normalizeSnapshotToArray(updatedSnap.val()));
      return true;
    } catch (error) {
      console.error('❌ Delete guru error:', error);
      throw error;
    }
  }

  // ======================================================
  // 5. TEST DATA FUNCTIONS (Untuk testing)
  // ======================================================
  async function addTestGuru() {
    console.log('🧪 Adding test guru data');
    try {
      const testGurus = [
        {
          nip: '196512031987021001',
          nama: 'Drs. Budi Santoso, M.Pd.',
          jabatan: 'Kepala Sekolah',
          password: '20203605',
          status: 'Aktif'
        },
        {
          nip: '197803151998022002',
          nama: 'Siti Aminah, S.Pd.',
          jabatan: 'Guru Kelas 1',
          password: '20203605',
          status: 'Aktif'
        },
        {
          nip: '198506201999032003',
          nama: 'Agus Wijaya, S.Pd.',
          jabatan: 'Guru Kelas 2',
          password: '20203605',
          status: 'Aktif'
        },
        {
          nip: '199012152001022004',
          nama: 'Rina Dewi, S.Pd.',
          jabatan: 'Guru Kelas 3',
          password: '20203605',
          status: 'Aktif'
        },
        {
          nip: '199308102003032005',
          nama: 'Joko Prasetyo, S.Pd.',
          jabatan: 'Guru Kelas 4',
          password: '20203605',
          status: 'Aktif'
        }
      ];

      const promises = testGurus.map(guru => addGuruFirebase(guru));
      await Promise.all(promises);
      
      console.log('✅ Test guru data added successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to add test data:', error);
      return false;
    }
  }

  // ======================================================
  // 6. ATTENDANCE FUNCTIONS
  // ======================================================
  async function addAttendanceFirebase(data) {
    console.log('📝 Adding attendance for:', data.namaGuru);
    try {
      const today = data.tanggal;
      const indexKey = `${data.idGuru}_${today}`;
      
      console.log('🔍 Checking attendance index:', indexKey);
      const indexSnap = await db.ref('attendance_index/' + indexKey).once('value');
      
      if (indexSnap.exists()) {
        console.log('⏰ User already attended today');
        const error = new Error('Anda sudah absen hari ini');
        error.code = 'already-attended';
        throw error;
      }

      const ref = db.ref('attendances').push();
      const attendanceId = ref.key;
      console.log('📝 Generated attendance ID:', attendanceId);
      
      const attendanceData = {
        id: attendanceId,
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
      
      console.log('💾 Saving attendance data');
      await ref.set(attendanceData);
      
      // Save index
      try {
        await db.ref('attendance_index/' + indexKey).set({
          attendanceId: attendanceId,
          timestamp: Date.now()
        });
        console.log('✅ Attendance index saved');
      } catch (indexError) {
        console.warn('⚠️ Index save warning:', indexError);
      }
      
      // Update listeners
      const updatedSnap = await db.ref('attendances').once('value');
      const updatedData = normalizeSnapshotToArray(updatedSnap.val());
      emit('attendances-updated', updatedData);
      
      console.log('✅ Attendance saved successfully');
      return attendanceData;
    } catch (error) {
      console.error('❌ Add attendance error:', error);
      throw error;
    }
  }

  // ======================================================
  // 7. REALTIME LISTENERS
  // ======================================================
  console.log('👂 Setting up Firebase listeners...');
  
  // Guru listener
  db.ref('gurus').on('value', (snap) => {
    try {
      console.log('📡 Guru data received from Firebase');
      const data = snap.val();
      console.log('📊 Raw guru data:', data);
      
      const arr = normalizeSnapshotToArray(data);
      console.log(`👨‍🏫 Processed ${arr.length} gurus`);
      
      emit('gurus-updated', arr);
    } catch (error) {
      console.error('❌ Gurus listener error:', error);
    }
  }, (error) => {
    console.error('❌ Gurus listener failed:', error);
  });

  // Attendance listener
  db.ref('attendances').on('value', (snap) => {
    try {
      console.log('📡 Attendance data received from Firebase');
      const arr = normalizeSnapshotToArray(snap.val());
      console.log(`📝 Processed ${arr.length} attendances`);
      
      emit('attendances-updated', arr);
    } catch (error) {
      console.error('❌ Attendances listener error:', error);
    }
  }, (error) => {
    console.error('❌ Attendances listener failed:', error);
  });

  // ======================================================
  // 8. SYNC FUNCTION
  // ======================================================
  async function syncFromFirebase() {
    console.log('🔄 Starting sync from Firebase...');
    try {
      console.log('📥 Fetching gurus data...');
      const gurusSnap = await db.ref('gurus').once('value');
      console.log('📥 Fetching attendances data...');
      const attendancesSnap = await db.ref('attendances').once('value');
      
      const gurus = normalizeSnapshotToArray(gurusSnap.val());
      const attendances = normalizeSnapshotToArray(attendancesSnap.val());
      
      console.log(`📊 Sync results: ${gurus.length} gurus, ${attendances.length} attendances`);
      
      // Save to localStorage as backup
      try {
        localStorage.setItem('wh_guru_list_v1', JSON.stringify(gurus));
        localStorage.setItem('wh_att_list_v1', JSON.stringify(attendances));
        console.log('💾 Data saved to localStorage');
      } catch (e) {
        console.warn('⚠️ LocalStorage error:', e);
      }
      
      emit('gurus-updated', gurus);
      emit('attendances-updated', attendances);
      
      console.log('✅ Sync completed successfully');
      return { gurus, attendances };
    } catch (error) {
      console.error('❌ Sync error:', error);
      throw error;
    }
  }

  // ======================================================
  // 9. MANUAL TEST FUNCTIONS (Untuk debugging)
  // ======================================================
  async function checkDatabaseConnection() {
    console.log('🔍 Checking database connection...');
    try {
      const testRef = db.ref('.info/connected');
      testRef.on('value', (snap) => {
        console.log('📡 Database connection status:', snap.val() ? 'Connected' : 'Disconnected');
      });
      
      // Test read
      const testData = await db.ref('gurus').once('value');
      console.log('📊 Database read test:', testData.exists() ? 'Success' : 'Empty');
      
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  // ======================================================
  // 10. EXPORT FUNCTIONS
  // ======================================================
  window.signInAdmin = signInWithEmail;
  window.signOutAdmin = signOutFirebase;
  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;
  window.addAttendanceFirebase = addAttendanceFirebase;
  window.syncFromFirebase = syncFromFirebase;
  window.addTestGuru = addTestGuru;  // Untuk testing
  window.checkDatabaseConnection = checkDatabaseConnection; // Untuk debugging
  window.whUseFirebase = true;

  console.log('✅ app.firebase.js loaded successfully');

  // Initial sync dengan delay
  setTimeout(() => {
    console.log('🔄 Starting initial sync...');
    syncFromFirebase().catch(err => {
      console.warn('⚠️ Initial sync failed:', err);
    });
    
    // Test connection
    checkDatabaseConnection();
  }, 2000);

})();
