/**
 * app.firebase.js - FINAL VERSION WITH PASSWORD PROTECTION
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
  // 3. PASSWORD PROTECTION SYSTEM
  // ======================================================
  const ACCESS_CONFIG = {
    password: "sdnmuhara123",  // Password utama untuk akses sistem
    sessionHours: 12,          // Lama sesi dalam jam
    maxAttempts: 5,            // Maksimal percobaan salah
    lockTimeMinutes: 15        // Waktu lockout setelah max attempts
  };

  let passwordAttempts = 0;
  let isLocked = false;
  let unlockTime = 0;

  // Function utama untuk cek akses
  function checkAccessPassword() {
    // 1. Cek jika sudah login sebagai admin Firebase
    if (window.whCurrentUser && window.whCurrentUser.admin === true) {
      console.log('✅ Akses sebagai admin Firebase');
      return true;
    }
    
    // 2. Cek jika sistem sedang locked
    if (isLocked) {
      const now = Date.now();
      if (now < unlockTime) {
        const remainingMinutes = Math.ceil((unlockTime - now) / 60000);
        showLockedScreen(remainingMinutes);
        return false;
      } else {
        // Reset lock state
        isLocked = false;
        passwordAttempts = 0;
        localStorage.removeItem('wh_password_lock');
        localStorage.removeItem('wh_unlock_time');
      }
    }
    
    // 3. Cek sesi password yang masih valid
    const hasAccess = sessionStorage.getItem('wh_access_granted');
    const expiry = sessionStorage.getItem('wh_access_expiry');
    
    if (hasAccess === 'true' && expiry && Date.now() < parseInt(expiry)) {
      console.log('✅ Akses melalui password session');
      return true;
    }
    
    // 4. Jika semua gagal, tampilkan password prompt
    console.log('⏳ Butuh password untuk akses');
    return false;
  }

  // Function untuk menampilkan password prompt
  function showPasswordPrompt() {
    // Cek jika sudah ada modal
    if (document.getElementById('password-modal')) {
      return;
    }
    
    // Hitung attempt dari localStorage
    const storedAttempts = localStorage.getItem('wh_password_attempts');
    if (storedAttempts) {
      passwordAttempts = parseInt(storedAttempts);
    }
    
    // Cek lock status
    const storedLock = localStorage.getItem('wh_password_lock');
    const storedUnlock = localStorage.getItem('wh_unlock_time');
    
    if (storedLock === 'true' && storedUnlock) {
      const now = Date.now();
      unlockTime = parseInt(storedUnlock);
      
      if (now < unlockTime) {
        isLocked = true;
        const remainingMinutes = Math.ceil((unlockTime - now) / 60000);
        showLockedScreen(remainingMinutes);
        return;
      } else {
        // Reset lock
        isLocked = false;
        passwordAttempts = 0;
        localStorage.removeItem('wh_password_lock');
        localStorage.removeItem('wh_unlock_time');
      }
    }
    
    // Tampilkan modal password
    const modalHTML = `
      <div id="password-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 transition-all duration-300">
        <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all duration-300 scale-100">
          <div class="text-center mb-8">
            <div class="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <span class="text-3xl">🔐</span>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">SDN Muhara</h1>
            <h2 class="text-xl font-semibold text-indigo-700 mt-2">Sistem Kehadiran Guru</h2>
            <div class="mt-4">
              <span class="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                🔒 Akses Terproteksi
              </span>
            </div>
          </div>
          
          <form id="password-form" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Password Akses
                ${passwordAttempts > 0 ? 
                  `<span class="text-amber-600 float-right">(${ACCESS_CONFIG.maxAttempts - passwordAttempts} percobaan tersisa)</span>` 
                  : ''}
              </label>
              <div class="relative">
                <input type="password" id="access-password" 
                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center text-lg tracking-widest"
                       placeholder="••••••••" 
                       required
                       autocomplete="off"
                       autofocus
                       ${isLocked ? 'disabled' : ''}>
                <button type="button" onclick="togglePasswordVisibility()" 
                        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1">
                  👁️
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2 text-center">
                Password diberikan oleh admin sekolah
              </p>
            </div>
            
            <div class="flex flex-col gap-3">
              <button type="submit" 
                      class="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      ${isLocked ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                <span>🔓</span>
                <span>Masuk ke Sistem</span>
              </button>
              
              <button type="button" onclick="showFirebaseLogin()" 
                      class="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all">
                🔑 Login sebagai Admin
              </button>
            </div>
          </form>
          
          <div id="password-error" class="mt-4 p-3 bg-red-50 text-red-700 rounded-lg hidden text-sm text-center"></div>
          
          <div class="mt-6 pt-6 border-t border-gray-200 text-center">
            <p class="text-xs text-gray-500">
              Sistem kehadiran guru - versi 1.0<br>
              © SDN Muhara 2026
            </p>
            ${passwordAttempts >= 3 ? `
              <p class="text-xs text-amber-600 mt-2">
                ⚠️ ${passwordAttempts} percobaan gagal
              </p>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    // Tambahkan ke body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Setup CSS untuk animasi
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
        20%, 40%, 60%, 80% { transform: translateX(8px); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .animate-shake {
        animation: shake 0.5s ease-in-out;
      }
      .animate-pulse-slow {
        animation: pulse 2s infinite;
      }
      #password-modal {
        backdrop-filter: blur(10px);
      }
    `;
    document.head.appendChild(style);
    
    // Setup event listeners
    setupPasswordListeners();
  }

  // Function untuk setup event listeners
  function setupPasswordListeners() {
    const modal = document.getElementById('password-modal');
    const form = document.getElementById('password-form');
    const passwordInput = document.getElementById('access-password');
    const errorDiv = document.getElementById('password-error');
    
    // Function toggle visibility password
    window.togglePasswordVisibility = function() {
      if (!passwordInput) return;
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
    };
    
    // Function untuk tampilkan login Firebase
    window.showFirebaseLogin = function() {
      // Sembunyikan modal password
      if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
      }
      
      // Tampilkan modal login admin yang sudah ada
      const loginModal = document.getElementById('login-modal');
      if (loginModal) {
        loginModal.classList.remove('hidden');
        
        // Auto focus ke email
        setTimeout(() => {
          const emailInput = document.getElementById('login-email');
          if (emailInput) emailInput.focus();
        }, 100);
      }
    };
    
    // Handle form submission
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (isLocked) {
          errorDiv.textContent = 'Sistem terkunci. Silakan coba lagi nanti.';
          errorDiv.classList.remove('hidden');
          return;
        }
        
        const enteredPassword = passwordInput.value.trim();
        
        // Validasi password
        if (enteredPassword === ACCESS_CONFIG.password) {
          // SUCCESS - Grant access
          passwordAttempts = 0;
          localStorage.removeItem('wh_password_attempts');
          
          // Simpan sesi
          const expiryTime = Date.now() + (ACCESS_CONFIG.sessionHours * 60 * 60 * 1000);
          sessionStorage.setItem('wh_access_granted', 'true');
          sessionStorage.setItem('wh_access_expiry', expiryTime.toString());
          sessionStorage.setItem('wh_last_login', Date.now().toString());
          
          // Update UI untuk menunjukkan login
          updateUIAfterLogin();
          
          // Sembunyikan modal dengan animasi
          if (modal) {
            modal.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
              modal.remove();
              
              // Tampilkan toast sukses
              if (typeof window.toast === 'function') {
                window.toast('✅ Akses diberikan! Selamat menggunakan sistem', 'success', 3000);
              }
              
              // Jika ada initApp function, panggil
              if (typeof window.initApp === 'function') {
                setTimeout(window.initApp, 500);
              }
            }, 300);
          }
          
        } else {
          // FAILED - Wrong password
          passwordAttempts++;
          localStorage.setItem('wh_password_attempts', passwordAttempts.toString());
          
          // Tampilkan error
          const remainingAttempts = ACCESS_CONFIG.maxAttempts - passwordAttempts;
          errorDiv.textContent = `❌ Password salah! ${remainingAttempts > 0 ? 
            `Percobaan ${passwordAttempts}/${ACCESS_CONFIG.maxAttempts}` : 
            'Sistem akan terkunci!'}`;
          errorDiv.classList.remove('hidden');
          
          // Animasi shake
          passwordInput.classList.add('animate-shake');
          setTimeout(() => {
            passwordInput.classList.remove('animate-shake');
          }, 500);
          
          // Kosongkan field
          passwordInput.value = '';
          passwordInput.focus();
          
          // Cek jika sudah mencapai max attempts
          if (passwordAttempts >= ACCESS_CONFIG.maxAttempts) {
            isLocked = true;
            unlockTime = Date.now() + (ACCESS_CONFIG.lockTimeMinutes * 60 * 1000);
            
            localStorage.setItem('wh_password_lock', 'true');
            localStorage.setItem('wh_unlock_time', unlockTime.toString());
            
            // Tampilkan locked screen
            showLockedScreen(ACCESS_CONFIG.lockTimeMinutes);
          }
        }
      });
    }
    
    // Auto focus
    setTimeout(() => {
      if (passwordInput && !isLocked) {
        passwordInput.focus();
      }
    }, 100);
  }

  // Function untuk tampilkan locked screen
  function showLockedScreen(minutesRemaining) {
    // Hapus modal password jika ada
    const existingModal = document.getElementById('password-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const lockedHTML = `
      <div id="locked-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-red-900 via-rose-900 to-pink-900 p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div class="mx-auto w-24 h-24 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <span class="text-4xl">🔒</span>
          </div>
          
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Akses Dikunci</h1>
          <p class="text-gray-600 mb-6">
            Terlalu banyak percobaan password yang salah.
          </p>
          
          <div class="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div class="text-5xl font-bold text-red-600 mb-2" id="countdown-timer">
              ${String(Math.floor(minutesRemaining)).padStart(2, '0')}:00
            </div>
            <p class="text-sm text-red-700">
              Sistem akan terbuka dalam
            </p>
          </div>
          
          <p class="text-sm text-gray-500">
            Hubungi admin sekolah untuk reset password<br>
            atau tunggu hingga timer habis.
          </p>
          
          <div class="mt-8">
            <button onclick="tryAgainAfterLock()" 
                    class="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
              ⏳ Coba Lagi
            </button>
          </div>
          
          <div class="mt-6 pt-6 border-t border-gray-200">
            <p class="text-xs text-gray-500">
              🔐 Sistem Keamanan SDN Muhara
            </p>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', lockedHTML);
    
    // Start countdown timer
    let totalSeconds = minutesRemaining * 60;
    const timerElement = document.getElementById('countdown-timer');
    const tryAgainButton = document.querySelector('#locked-modal button');
    
    const countdownInterval = setInterval(() => {
      totalSeconds--;
      
      if (totalSeconds <= 0) {
        clearInterval(countdownInterval);
        
        // Unlock system
        isLocked = false;
        passwordAttempts = 0;
        localStorage.removeItem('wh_password_lock');
        localStorage.removeItem('wh_unlock_time');
        localStorage.removeItem('wh_password_attempts');
        
        // Enable button
        if (tryAgainButton) {
          tryAgainButton.disabled = false;
          tryAgainButton.innerHTML = '🔄 Coba Lagi Sekarang';
          tryAgainButton.classList.remove('from-gray-600', 'to-gray-700');
          tryAgainButton.classList.add('from-green-600', 'to-emerald-600');
        }
        
        if (timerElement) {
          timerElement.textContent = '00:00';
          timerElement.classList.remove('text-red-600');
          timerElement.classList.add('text-green-600');
        }
      } else {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        if (timerElement) {
          timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      }
    }, 1000);
    
    // Setup try again function
    window.tryAgainAfterLock = function() {
      if (!isLocked) {
        const lockedModal = document.getElementById('locked-modal');
        if (lockedModal) {
          lockedModal.remove();
        }
        showPasswordPrompt();
      }
    };
  }

  // Function untuk update UI setelah login
  function updateUIAfterLogin() {
    // Tambahkan tombol logout di sidebar
    setTimeout(() => {
      const sidebar = document.getElementById('sidebar');
      const adminSection = document.querySelector('#sidebar .mt-8');
      
      if (sidebar && adminSection) {
        // Hapus tombol logout lama jika ada
        const oldLogoutBtn = document.getElementById('logout-access-btn');
        if (oldLogoutBtn) {
          oldLogoutBtn.remove();
        }
        
        // Tambahkan tombol logout baru
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-access-btn';
        logoutBtn.className = 'w-full mt-4 text-left px-3 py-2 rounded-md bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 font-medium transition-all flex items-center justify-center gap-2';
        logoutBtn.innerHTML = `
          <span>🚪</span>
          <span>Logout Sistem</span>
        `;
        logoutBtn.onclick = logoutAccess;
        
        adminSection.appendChild(logoutBtn);
      }
      
      // Tampilkan notifikasi di UI
      const toastContainer = document.getElementById('toast-container');
      if (toastContainer) {
        const notification = document.createElement('div');
        notification.className = 'bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-2';
        notification.innerHTML = `
          <div class="flex items-center">
            <span class="mr-2">✅</span>
            <span>Akses diberikan hingga ${new Date(Date.now() + (ACCESS_CONFIG.sessionHours * 60 * 60 * 1000)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `;
        toastContainer.appendChild(notification);
        
        // Auto remove setelah 5 detik
        setTimeout(() => notification.remove(), 5000);
      }
    }, 1000);
  }

  // Function untuk logout
  function logoutAccess() {
    if (confirm('Anda yakin ingin logout dari sistem?')) {
      // Hapus semua session data
      sessionStorage.removeItem('wh_access_granted');
      sessionStorage.removeItem('wh_access_expiry');
      sessionStorage.removeItem('wh_last_login');
      
      // Reset password attempts
      passwordAttempts = 0;
      localStorage.removeItem('wh_password_attempts');
      
      // Hapus tombol logout dari UI
      const logoutBtn = document.getElementById('logout-access-btn');
      if (logoutBtn) {
        logoutBtn.remove();
      }
      
      // Reload halaman untuk kembali ke password screen
      location.reload();
    }
  }

  // Function untuk check session secara periodik
  function startSessionChecker() {
    setInterval(() => {
      if (checkAccessPassword()) {
        // Cek jika sesi hampir habis (kurang dari 5 menit)
        const expiry = sessionStorage.getItem('wh_access_expiry');
        if (expiry) {
          const timeLeft = parseInt(expiry) - Date.now();
          const minutesLeft = Math.floor(timeLeft / 60000);
          
          if (minutesLeft > 0 && minutesLeft <= 5) {
            // Tampilkan warning
            if (typeof window.toast === 'function') {
              window.toast(`⚠️ Sesi akan berakhir dalam ${minutesLeft} menit`, 'warning', 5000);
            }
          }
          
          if (timeLeft <= 0) {
            // Sesi habis, logout otomatis
            sessionStorage.removeItem('wh_access_granted');
            sessionStorage.removeItem('wh_access_expiry');
            if (typeof window.toast === 'function') {
              window.toast('Sesi telah berakhir. Silakan login kembali.', 'info', 3000);
            }
            setTimeout(() => location.reload(), 3000);
          }
        }
      }
    }, 60000); // Check setiap menit
  }

  // Initialize password system
  function initPasswordSystem() {
    console.log('🔐 Password Protection System Initializing...');
    
    // Cek jika akses sudah diberikan
    if (!checkAccessPassword()) {
      console.log('🔒 Access denied. Showing password prompt...');
      
      // Sembunyikan konten utama dulu
      const mainContent = document.querySelector('main');
      const sidebar = document.getElementById('sidebar');
      const footer = document.querySelector('footer');
      
      if (mainContent) mainContent.style.display = 'none';
      if (sidebar) sidebar.style.display = 'none';
      if (footer) footer.style.display = 'none';
      
      // Tampilkan password prompt
      showPasswordPrompt();
    } else {
      console.log('✅ Access granted');
      
      // Tampilkan semua konten
      const mainContent = document.querySelector('main');
      const sidebar = document.getElementById('sidebar');
      const footer = document.querySelector('footer');
      
      if (mainContent) mainContent.style.display = 'block';
      if (sidebar) sidebar.style.display = 'block';
      if (footer) footer.style.display = 'block';
      
      // Update UI untuk menunjukkan user sudah login
      updateUIAfterLogin();
      
      // Start session checker
      startSessionChecker();
    }
  }

  // ======================================================
  // 4. AUTHENTICATION FUNCTIONS
  // ======================================================
  async function signInWithEmail(email, password) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      
      // Always treat as admin for demo
      const isAdmin = true;
      
      // Simpan user info
      window.whCurrentUser = {
        uid: cred.user.uid,
        email: cred.user.email,
        admin: isAdmin
      };
      
      emit('auth-changed', window.whCurrentUser);
      
      // Jika login admin berhasil, hapus password prompt jika ada
      const passwordModal = document.getElementById('password-modal');
      if (passwordModal) {
        passwordModal.remove();
      }
      
      // Tampilkan semua konten
      const mainContent = document.querySelector('main');
      const sidebar = document.getElementById('sidebar');
      const footer = document.querySelector('footer');
      
      if (mainContent) mainContent.style.display = 'block';
      if (sidebar) sidebar.style.display = 'block';
      if (footer) footer.style.display = 'block';
      
      return cred.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function signOutFirebase() {
    try {
      await auth.signOut();
      window.whCurrentUser = null;
      emit('auth-changed', null);
      
      // Juga logout dari password system
      logoutAccess();
      
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
      window.whCurrentUser = {
        uid: user.uid,
        email: user.email,
        admin: true
      };
      
      emit('auth-changed', window.whCurrentUser);
      
      // Jika login sebagai admin, bypass password protection
      const passwordModal = document.getElementById('password-modal');
      if (passwordModal) {
        passwordModal.remove();
      }
      
      // Tampilkan semua konten
      const mainContent = document.querySelector('main');
      const sidebar = document.getElementById('sidebar');
      const footer = document.querySelector('footer');
      
      if (mainContent) mainContent.style.display = 'block';
      if (sidebar) sidebar.style.display = 'block';
      if (footer) footer.style.display = 'block';
    } else {
      window.whCurrentUser = null;
      emit('auth-changed', null);
    }
  });

  // ======================================================
  // 5. GURU FUNCTIONS (Admin Only)
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
  // 6. ATTENDANCE FUNCTIONS (All Users)
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
  // 7. REALTIME LISTENERS
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
  // 8. SYNC FUNCTION
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
  // 9. EXPORT FUNCTIONS
  // ======================================================
  window.signInAdmin = signInWithEmail;
  window.signOutAdmin = signOutFirebase;
  window.addGuruFirebase = addGuruFirebase;
  window.updateGuruFirebase = updateGuruFirebase;
  window.deleteGuruFirebase = deleteGuruFirebase;
  window.addAttendanceFirebase = addAttendanceFirebase;
  window.syncFromFirebase = syncFromFirebase;
  
  // Password protection functions
  window.checkAccessPassword = checkAccessPassword;
  window.logoutAccess = logoutAccess;
  window.showPasswordPrompt = showPasswordPrompt;
  
  window.whUseFirebase = true;

  console.log('✅ app.firebase.js loaded successfully');

  // Initial sync
  setTimeout(() => {
    syncFromFirebase().catch(err => {
      console.warn('Initial sync failed:', err);
    });
  }, 1000);

  // Initialize password system setelah DOM siap
  document.addEventListener('DOMContentLoaded', function() {
    // Tunggu Firebase siap jika digunakan
    if (window.whUseFirebase) {
      // Tunggu 2 detik untuk Firebase initialization
      setTimeout(initPasswordSystem, 2000);
    } else {
      initPasswordSystem();
    }
  });

})();
