// app.firebase.js — WebsiteHadir with Email/Password Auth integrated

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

// ================= INIT FIREBASE =================
if (!window.firebase || !window.firebase.initializeApp) {
  console.error('Firebase SDK tidak ditemukan. Pastikan include firebase-app-compat, firebase-database-compat, firebase-auth-compat.');
} else {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();

// auth persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
  console.warn('Gagal set persistence:', err);
});

// ================ STATIC DATA ================
const guruList = [
  { nip: "G001", nama: "Ibu Ani", jabatan: "Kepala Sekolah", status: "Aktif" },
  { nip: "G002", nama: "Pak Budi", jabatan: "Guru Kelas 1", status: "Aktif" },
  { nip: "G003", nama: "Ibu Siti", jabatan: "Guru BK", status: "Aktif" },
  { nip: "G004", nama: "Pak Rudi", jabatan: "Guru PJOK", status: "Aktif" },
];

// ================ HELPERS ===================
function formatTanggal() { return new Date().toISOString().slice(0,10); }
function formatJam() { return new Date().toTimeString().split(' ')[0]; }

// ================ UI INIT ===================
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.tab-button');
  const pages = document.querySelectorAll('main section');
  function showPage(name){ pages.forEach(s=> s.classList.toggle('hidden', s.id !== `page-${name}`)); tabs.forEach(b=> b.classList.toggle('tab-active', b.dataset.page === name)); }
  tabs.forEach(b=> b.addEventListener('click', ()=> showPage(b.dataset.page)));
  showPage('kehadiran');

  // populate teachers & table
  const sel = document.getElementById('namaGuru'); sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
  guruList.forEach(g=> { const o=document.createElement('option'); o.value = `${g.nip}|${g.nama}`; o.textContent = `${g.nama} — ${g.jabatan}`; sel.appendChild(o); });

  const tbody = document.getElementById('guruTableBody'); tbody.innerHTML = '';
  guruList.forEach(g => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="border p-2">${g.nip}</td><td class="border p-2">${g.nama}</td><td class="border p-2">${g.jabatan}</td><td class="border p-2">${g.status}</td>`; tbody.appendChild(tr); });

  // clock & geolocation
  setTanggalSekarang(); drawClock(); setInterval(()=> { setTanggalSekarang(); drawClock(); }, 1000);
  const lokasiInput = document.getElementById('lokasi');
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => lokasiInput.value = `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`, () => {}, { timeout:7000 });

  // --- AUTH UI elements
  const btnOpenLogin = document.getElementById('btnOpenLogin');
  const btnLogout = document.getElementById('btnLogout');
  const userDisplay = document.getElementById('userDisplay');

  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');

  // open/close login modal
  btnOpenLogin.addEventListener('click', () => { loginModal.classList.remove('hidden'); loginModal.classList.add('flex'); });
  document.getElementById('btnCloseLogin').addEventListener('click', ()=> { loginModal.classList.add('hidden'); loginModal.classList.remove('flex'); });

  // open register
  document.getElementById('btnShowRegister').addEventListener('click', ()=> { registerModal.classList.remove('hidden'); registerModal.classList.add('flex'); });

  document.getElementById('btnCloseRegister').addEventListener('click', ()=> { registerModal.classList.add('hidden'); registerModal.classList.remove('flex'); });

  // login action
  document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!email || !pass) return alert('Masukkan email dan kata sandi.');
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      alert('Login berhasil ✅');
      loginModal.classList.add('hidden'); loginModal.classList.remove('flex');
    } catch (err) {
      console.error('Login error', err);
      alert('Login gagal: ' + err.message);
    }
  });

  // register action (use only if admin wants to create account from UI)
  document.getElementById('btnRegister').addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    if (!email || pass.length < 6) return alert('Masukkan email dan kata sandi (min 6 karakter).');
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      alert('Akun dibuat. Silakan login.');
      registerModal.classList.add('hidden'); registerModal.classList.remove('flex');
    } catch (err) {
      console.error('Register error', err);
      alert('Gagal membuat akun: ' + err.message);
    }
  });

  // forgot password
  document.getElementById('forgotPw').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) return alert('Masukkan email yang terdaftar di kolom email terlebih dahulu.');
    try {
      await auth.sendPasswordResetEmail(email);
      alert('Email reset password dikirim, periksa inbox.');
    } catch (err) {
      console.error('Reset pw error', err);
      alert('Gagal mengirim reset email: ' + err.message);
    }
  });

  // logout
  btnLogout.addEventListener('click', async () => {
    try {
      await auth.signOut();
      alert('Anda telah logout.');
    } catch (err) {
      console.error('Logout error', err);
    }
  });

  // auth state listener — update UI
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      userDisplay.textContent = user.email || user.displayName || 'Pengguna';
      userDisplay.classList.remove('hidden');
      btnOpenLogin.classList.add('hidden');
      btnLogout.classList.remove('hidden');
    } else {
      userDisplay.classList.add('hidden');
      btnOpenLogin.classList.remove('hidden');
      btnLogout.classList.add('hidden');
    }
  });

  // --- KIRIM KEHADIRAN (mengharuskan auth) ---
  document.getElementById('kirimKehadiranBtn').addEventListener('click', async function (e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      // open login modal
      loginModal.classList.remove('hidden'); loginModal.classList.add('flex');
      return alert('Silakan login terlebih dahulu untuk mengirim kehadiran.');
    }

    const selVal = document.getElementById('namaGuru').value;
    const status = document.getElementById('statusKehadiran').value;
    if (!selVal || !status) return alert('Pilih nama dan status terlebih dahulu.');

    const [nip, nama] = selVal.split('|');
    const payload = {
      nip,
      nama,
      status,
      jam: formatJam(),
      tanggal: formatTanggal(),
      lokasi: (document.getElementById('lokasi').value || '-'),
      uid: user.uid,
      email: user.email || '',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    const btn = this;
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Mengirim...';

    try {
      const newRef = db.ref('kehadiran').push();
      await newRef.set(payload);
      alert('✅ Kehadiran berhasil dikirim!');
    } catch (err) {
      console.error('Gagal kirim:', err);
      alert('❌ Gagal kirim. Periksa koneksi atau rules Firebase.\n\n' + (err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  // --- Chart + real-time listener (sama seperti sebelumnya) ---
  const ctx = document.getElementById('chartDashboard').getContext('2d');
  const chart = new Chart(ctx, { type: 'doughnut', data: { labels: ['Hadir','Izin/Sakit/Dinas'], datasets:[{ data: [0,0] }] } });

  db.ref('kehadiran').on('value', snap => {
    const data = snap.val() || {};
    const today = formatTanggal();
    let hadir = 0, lain = 0;
    const recent = [];
    Object.values(data).forEach(it => {
      if (it.tanggal === today) {
        if (it.status === 'Hadir') hadir++; else lain++;
        recent.push(it);
      }
    });
    chart.data.datasets[0].data = [hadir, lain]; chart.update();
    document.getElementById('totalGuru').textContent = guruList.length;
    document.getElementById('totalHadir').textContent = hadir;
    document.getElementById('totalLain').textContent = lain;

    const act = document.getElementById('recent-activity'); act.innerHTML = '';
    if (!recent.length) act.innerHTML = '<p class="text-gray-400">Belum ada aktivitas hari ini.</p>';
    else recent.reverse().slice(0,12).forEach(r => { const p = document.createElement('p'); p.textContent = `${r.jam} — ${r.nama} — ${r.status}`; act.appendChild(p); });
  });

  // laporan & export (sama)
  document.getElementById('tampilkanLaporanBtn').addEventListener('click', async () => {
    const bulan = document.getElementById('bulan').value; if (!bulan) return alert('Pilih bulan terlebih dahulu.');
    const snap = await db.ref('kehadiran').once('value'); const data = snap.val() || {};
    const rows = Object.values(data).filter(d => d.tanggal && d.tanggal.startsWith(bulan));
    const tbody = document.getElementById('laporanTableBody'); tbody.innerHTML = '';
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Tidak ada data bulan ini.</td></tr>'; document.getElementById('resume-laporan').textContent=''; return; }
    rows.sort((a,b)=> (a.tanggal + (a.jam||'')).localeCompare(b.tanggal + (b.jam||'')));
    rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="border p-2">${r.tanggal}</td><td class="border p-2">${r.nama}</td><td class="border p-2">${r.jam||'-'}</td><td class="border p-2">${r.lokasi||'-'}</td><td class="border p-2">${r.status}</td>`; tbody.appendChild(tr); });
    document.getElementById('resume-laporan').textContent = `Menampilkan ${rows.length} catatan untuk ${bulan}`;
  });

  document.getElementById('exportLaporanBtn').addEventListener('click', () => {
    const tbody = document.getElementById('laporanTableBody'); const rows = [];
    tbody.querySelectorAll('tr').forEach(tr => { const cols = [...tr.children].map(td => td.textContent.trim()); if (cols.length) rows.push(cols); });
    if (!rows.length) return alert('Tidak ada data untuk diexport.');
    const ws = XLSX.utils.aoa_to_sheet([['Tanggal','Nama Guru','Jam','Lokasi','Status'], ...rows]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, 'Laporan-Kehadiran.xlsx');
  });

}); // DOMContentLoaded end

/* =========== Clock & Draw ============ */
function setTanggalSekarang() {
  const now = new Date(); const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const el = document.getElementById('current-date'); if (el) el.textContent = now.toLocaleDateString('id-ID', opts);
}
function drawClock() {
  const c = document.getElementById('analogClock'); if (!c) return; const ctx = c.getContext('2d'); const r = c.width/2;
  ctx.clearRect(0,0,c.width,c.height); ctx.save(); ctx.translate(r,r);
  ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,r-4,0,2*Math.PI); ctx.stroke();
  const now = new Date(); const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours()%12;
  ctx.rotate((Math.PI/6)*(hr + min/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.5); ctx.stroke(); ctx.rotate(-(Math.PI/6)*(hr + min/60));
  ctx.rotate((Math.PI/30)*(min + sec/60)); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.75); ctx.stroke(); ctx.rotate(-(Math.PI/30)*(min + sec/60));
  ctx.strokeStyle = '#ef4444'; ctx.rotate((Math.PI/30)*sec); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*0.85); ctx.stroke(); ctx.restore();
}
