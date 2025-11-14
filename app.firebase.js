// app.firebase.js

// --- Konfigurasi Firebase Anda (Telah Diperbarui) ---
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

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Menggunakan Firestore (asumsi untuk data master guru)
const rtdb = firebase.database(); // Menggunakan Realtime DB (asumsi untuk data kehadiran real-time)
const storage = firebase.storage();

// --- Variabel Global & DOM References ---
let isAdminLoggedIn = false;
let currentGuruData = {}; // Cache data guru
let chartInstance; // Untuk Chart.js

// Elemen DOM
const navItems = document.querySelectorAll('.nav-item');
const pageSections = {
    dashboard: document.getElementById('page-dashboard'),
    kehadiran: document.getElementById('page-kehadiran'),
    guru: document.getElementById('page-guru'),
    laporan: document.getElementById('page-laporan'),
};
const btnOpenAdmin = document.getElementById('btn-open-admin');
const btnAdminLogout = document.getElementById('btn-admin-logout');
const adminBadge = document.getElementById('admin-badge');
const namaGuruSelect = document.getElementById('namaGuru');
const statusKehadiranSelect = document.getElementById('statusKehadiran');
const lokasiInput = document.getElementById('lokasi');
const coordsSmall = document.getElementById('coords-small');
const btnUseGPS = document.getElementById('btn-use-gps');
const btnGpsLabel = document.getElementById('btn-gps-label');
const kirimKehadiranBtn = document.getElementById('kirimKehadiranBtn');
const kehadiranStatusDiv = document.getElementById('kehadiran-status');
const guruTableBody = document.getElementById('guruTableBody');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const btnClearPhoto = document.getElementById('btn-clear-photo');

let currentPhotoFile = null; // Menyimpan file foto sementara

// --- UTILITY FUNCTIONS ---

/**
 * Menampilkan notifikasi Toast
 * @param {string} message Pesan yang ditampilkan
 * @param {'ok'|'err'|'info'} type Jenis toast
 */
const showToast = (message, type = 'info') => {
    const toastsContainer = document.getElementById('toasts');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastsContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toastsContainer.removeChild(toast);
        }, { once: true });
    }, 4000);
};

/**
 * Mengubah halaman yang ditampilkan
 * @param {string} pageKey Kunci halaman ('kehadiran', 'dashboard', 'guru', 'laporan')
 */
const navigateTo = (pageKey) => {
    Object.keys(pageSections).forEach(key => {
        const section = pageSections[key];
        if (section) {
            section.classList.add('hidden');
        }
    });

    const targetSection = pageSections[pageKey];
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    navItems.forEach(btn => {
        btn.classList.remove('font-bold', 'bg-white/20', 'text-white');
        btn.classList.add('text-red-100'); // Atur default warna
        if (btn.dataset.page === pageKey) {
            btn.classList.add('font-bold', 'bg-white/20', 'text-white');
            btn.classList.remove('text-red-100');
        }
    });

    // Aturan khusus untuk Dashboard (Grid)
    const dashboardGrid = document.getElementById('page-dashboard');
    if (pageKey === 'dashboard' && isAdminLoggedIn) {
        dashboardGrid.classList.remove('hidden');
    } else if (dashboardGrid) {
        dashboardGrid.classList.add('hidden');
    }
};

/**
 * Update tanggal dan jam
 */
const updateDateTime = () => {
    const now = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    
    const dateStr = now.toLocaleDateString('id-ID', dateOptions);
    const timeStr = now.toLocaleTimeString('id-ID', timeOptions);

    document.getElementById('current-date-top').textContent = dateStr;
    document.getElementById('clock-small').textContent = timeStr;
};

// --- GPS/LOKASI HANDLING ---

const getLocation = () => {
    if (!navigator.geolocation) {
        showToast('Browser Anda tidak mendukung Geolocation.', 'err');
        return;
    }

    btnGpsLabel.textContent = 'Mendeteksi...';
    btnUseGPS.disabled = true;
    lokasiInput.value = 'Mendeteksi lokasi...';
    coordsSmall.textContent = '-';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            lokasiInput.value = `Koordinat didapatkan: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            coordsSmall.textContent = `Lat: ${lat}, Lon: ${lon}`;
            btnGpsLabel.textContent = 'Lokasi Terdeteksi';
            btnUseGPS.disabled = false;
            btnUseGPS.classList.remove('bg-rose-600');
            btnUseGPS.classList.add('bg-green-600');
            showToast('Lokasi berhasil dideteksi!', 'ok');
        },
        (error) => {
            let errorMessage = 'Gagal mendapatkan lokasi.';
            if (error.code === error.PERMISSION_DENIED) {
                errorMessage = 'Izin lokasi ditolak. Aktifkan lokasi di browser/perangkat Anda.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = 'Informasi lokasi tidak tersedia.';
            } else if (error.code === error.TIMEOUT) {
                errorMessage = 'Permintaan waktu habis.';
            }
            
            lokasiInput.value = errorMessage;
            coordsSmall.textContent = '-';
            btnGpsLabel.textContent = 'Gunakan GPS';
            btnUseGPS.disabled = false;
            btnUseGPS.classList.remove('bg-green-600');
            btnUseGPS.classList.add('bg-rose-600');
            showToast(`Gagal Lokasi: ${errorMessage}`, 'err');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

btnUseGPS.addEventListener('click', getLocation);

// --- PHOTO/CAMERA HANDLING ---

photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentPhotoFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreview.src = e.target.result;
            photoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        currentPhotoFile = null;
        photoPreview.classList.add('hidden');
        photoPreview.src = '';
    }
});

btnClearPhoto.addEventListener('click', () => {
    currentPhotoFile = null;
    photoInput.value = '';
    photoPreview.classList.add('hidden');
    photoPreview.src = '';
});

// --- DATA: Guru Master (Firestore) ---

/**
 * Mengambil data guru dari Firestore dan mengisi dropdown/tabel
 */
const loadGuruData = async () => {
    try {
        const snapshot = await db.collection('guru').orderBy('nama', 'asc').get();
        currentGuruData = {}; // Reset cache
        
        // Bersihkan dropdown
        namaGuruSelect.innerHTML = '<option value="">-- Pilih Guru --</option>';
        
        // Bersihkan tabel
        guruTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-500">Memuat...</td></tr>';
        
        if (snapshot.empty) {
            guruTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-500">Tidak ada data guru.</td></tr>';
            return;
        }
        
        let tableHtml = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            currentGuruData[doc.id] = data; // Cache data
            
            // Isi Dropdown
            const option = document.createElement('option');
            option.value = doc.id; // Menggunakan ID dokumen sebagai value
            option.textContent = data.nama;
            namaGuruSelect.appendChild(option);
            
            // Isi Tabel Guru
            const statusClass = data.aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
            const statusText = data.aktif ? 'Aktif' : 'Nonaktif';
            
            tableHtml += `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-2 text-sm">${data.nip || '-'}</td>
                    <td class="p-2 font-medium">${data.nama}</td>
                    <td class="p-2 text-sm">${data.jabatan || '-'}</td>
                    <td class="p-2"><span class="text-xs px-2 py-1 rounded-full ${statusClass}">${statusText}</span></td>
                    <td class="p-2">
                        ${isAdminLoggedIn ? `<button class="text-sm text-red-600 hover:underline" data-guru-id="${doc.id}" onclick="deleteGuru(this)">Hapus</button>` : '—'}
                    </td>
                </tr>
            `;
        });
        
        if (tableHtml) {
            guruTableBody.innerHTML = tableHtml;
        }

    } catch (error) {
        console.error("Gagal memuat data guru: ", error);
        showToast("Gagal memuat data guru.", 'err');
    }
};

/**
 * Fungsi untuk menghapus guru (Hanya Admin)
 * @param {HTMLElement} btn Tombol yang diklik
 */
window.deleteGuru = async (btn) => {
    if (!isAdminLoggedIn) {
        showToast('Akses ditolak. Hanya admin yang dapat menghapus guru.', 'err');
        return;
    }
    
    const guruId = btn.dataset.guruId;
    const guruName = currentGuruData[guruId]?.nama || 'Guru ini';

    if (confirm(`Yakin ingin menghapus data ${guruName}? Aksi ini TIDAK dapat dibatalkan!`)) {
        try {
            await db.collection('guru').doc(guruId).delete();
            showToast(`Data ${guruName} berhasil dihapus.`, 'ok');
            loadGuruData(); // Reload data
        } catch (error) {
            console.error("Gagal menghapus guru: ", error);
            showToast("Gagal menghapus guru: " + error.message, 'err');
        }
    }
};

// --- DATA: Kehadiran (Realtime DB) ---

/**
 * Mengirim data kehadiran ke Realtime Database
 */
kirimKehadiranBtn.addEventListener('click', async () => {
    const guruId = namaGuruSelect.value;
    const status = statusKehadiranSelect.value;
    const lokasi = lokasiInput.value;
    const coords = coordsSmall.textContent;
    
    if (!guruId || !status || lokasi.includes('Gagal') || lokasi.includes('Tekan')) {
        showToast('Lengkapi Nama Guru, Status, dan Lokasi (Gunakan GPS).', 'err');
        return;
    }

    const guruName = currentGuruData[guruId].nama;
    const dateKey = new Date().toLocaleDateString('en-CA'); // Format YYYY-MM-DD
    const timeStamp = firebase.database.ServerValue.TIMESTAMP;
    
    kirimKehadiranBtn.disabled = true;
    kehadiranStatusDiv.textContent = 'Mengirim...';

    try {
        let photoUrl = null;
        if (currentPhotoFile) {
            // Upload foto ke Storage
            const storageRef = storage.ref(`kehadiran_photos/${dateKey}/${guruId}_${Date.now()}`);
            const snapshot = await storageRef.put(currentPhotoFile);
            photoUrl = await snapshot.ref.getDownloadURL();
        }

        const dataKehadiran = {
            guruId: guruId,
            nama: guruName,
            status: status,
            lokasi: lokasi,
            coords: coords,
            timestamp: timeStamp,
            tanggal: dateKey,
            photoUrl: photoUrl,
        };
        
        // Simpan ke Realtime DB dengan key YYYY-MM-DD/GuruID
        await rtdb.ref(`kehadiran/${dateKey}/${guruId}`).set(dataKehadiran);

        showToast(`${guruName} berhasil mengirim kehadiran: ${status}!`, 'ok');
        kehadiranStatusDiv.textContent = `Terakhir: ${new Date().toLocaleTimeString()} - Berhasil`;
        
        // Reset form
        namaGuruSelect.value = '';
        statusKehadiranSelect.value = '';
        lokasiInput.value = 'Tekan \'Gunakan GPS\' untuk mendeteksi lokasi';
        coordsSmall.textContent = '-';
        btnClearPhoto.click(); // Reset foto
        btnUseGPS.classList.remove('bg-green-600');
        btnUseGPS.classList.add('bg-rose-600');
        btnGpsLabel.textContent = 'Gunakan GPS';

    } catch (error) {
        console.error("Gagal mengirim kehadiran: ", error);
        showToast("Gagal mengirim kehadiran: " + error.message, 'err');
    } finally {
        kirimKehadiranBtn.disabled = false;
    }
});

/**
 * Mendengarkan data kehadiran hari ini untuk Dashboard/Grafik/Aktivitas
 */
const listenToDailyAttendance = () => {
    const dateKey = new Date().toLocaleDateString('en-CA'); // Format YYYY-MM-DD
    const ref = rtdb.ref(`kehadiran/${dateKey}`);
    
    ref.off(); // Hentikan listener lama
    ref.on('value', (snapshot) => {
        const rawData = snapshot.val();
        updateDashboard(rawData);
    }, (error) => {
        console.error("Gagal mendengarkan kehadiran harian: ", error);
        showToast("Gagal memuat data kehadiran harian.", 'err');
    });
};

/**
 * Update UI Dashboard dan Grafik
 * @param {object} rawData Data kehadiran hari ini dari RTDB
 */
const updateDashboard = (rawData) => {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, 'Dinas Luar': 0, Total: 0 };
    const activities = [];
    
    if (rawData) {
        Object.values(rawData).forEach(data => {
            counts.Total++;
            if (counts[data.status] !== undefined) {
                counts[data.status]++;
            } else {
                counts.Izin++; // Default untuk status yang tidak terdaftar
            }

            const time = new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            activities.push(`
                <div class="flex justify-between items-center border-b pb-1">
                    <span class="font-medium">${data.nama}</span>
                    <span class="text-sm text-slate-500">${time}</span>
                    <span class="text-xs px-2 py-0.5 rounded ${data.status === 'Hadir' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${data.status}</span>
                </div>
            `);
        });
    }

    // Update Header Cards (hanya terlihat jika isAdminLoggedIn)
    document.getElementById('totalGuru').textContent = Object.keys(currentGuruData).length;
    document.getElementById('totalHadir').textContent = counts.Hadir;
    document.getElementById('totalLain').textContent = counts.Izin + counts.Sakit + counts['Dinas Luar'];
    
    // Update Recent Activity
    const recentActivityDiv = document.getElementById('recent-activity');
    if (activities.length > 0) {
        // Balik urutan agar yang terbaru di atas
        recentActivityDiv.innerHTML = activities.reverse().slice(0, 5).join('');
    } else {
        recentActivityDiv.innerHTML = '<p class="text-slate-400">Belum ada kehadiran hari ini.</p>';
    }

    // Update Chart
    renderChart(counts);
};

/**
 * Membuat atau memperbarui Chart Kehadiran
 * @param {object} counts Objek hitungan kehadiran
 */
const renderChart = (counts) => {
    const ctx = document.getElementById('chartDashboard').getContext('2d');
    
    const data = {
        labels: ['Hadir', 'Izin', 'Sakit', 'Dinas Luar'],
        datasets: [{
            data: [counts.Hadir, counts.Izin, counts.Sakit, counts['Dinas Luar']],
            backgroundColor: ['#10b981', '#f59e0b', '#f87171', '#3b82f6'], // green, amber, red, blue
            hoverOffset: 4
        }]
    };

    if (chartInstance) {
        chartInstance.data = data;
        chartInstance.update();
    } else {
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: false,
                    }
                }
            }
        });
    }
};

// --- ADMIN LOGIN/LOGOUT ---

btnOpenAdmin.addEventListener('click', () => {
    const email = prompt("Masukkan Email Admin:");
    const password = prompt("Masukkan Password Admin:");

    if (email && password) {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                // `auth.onAuthStateChanged` akan memverifikasi apakah ini akun admin
                showToast("Mencoba Login Admin...", 'info');
            })
            .catch((error) => {
                console.error("Login Admin Gagal: ", error);
                showToast(`Login Gagal: ${error.message}`, 'err');
            });
    }
});

btnAdminLogout.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            showToast("Logout Admin Berhasil.", 'info');
        })
        .catch((error) => {
            console.error("Logout Admin Gagal: ", error);
        });
});

// --- AUTH STATE LISTENER (Menentukan Admin atau Guru) ---

auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in. Kita cek apakah dia benar-benar Admin.
        // Ganti 'admin@sekolah.com' dengan email admin yang sebenarnya
        if (user.email === 'admin@sekolah.com') {
            isAdminLoggedIn = true;
        } else {
            isAdminLoggedIn = false;
            // Jika bukan admin (meski login), paksa logout karena dashboard hanya untuk admin
            auth.signOut(); 
            return;
        }
        
        // Tampilan Admin
        adminBadge.classList.remove('hidden');
        btnOpenAdmin.classList.add('hidden');
        btnAdminLogout.classList.remove('hidden');
        
        // Tampilkan Dashboard Grid
        document.getElementById('page-dashboard').classList.remove('hidden');
        document.getElementById('admin-controls-placeholder').innerHTML = `
            <button id="btnAddGuru" class="px-3 py-1 rounded bg-rose-600 text-white text-sm">➕ Tambah Guru</button>
        `;
        document.getElementById('btnAddGuru').addEventListener('click', addGuru);
        
        // Muat ulang data saat admin masuk
        loadGuruData(); 
        listenToDailyAttendance();
        navigateTo('dashboard'); // Arahkan ke dashboard admin
        
    } else {
        // User is signed out.
        isAdminLoggedIn = false;
        adminBadge.classList.add('hidden');
        btnOpenAdmin.classList.remove('hidden');
        btnAdminLogout.classList.add('hidden');
        document.getElementById('page-dashboard').classList.add('hidden'); // Sembunyikan Grid
        document.getElementById('admin-controls-placeholder').innerHTML = '';
        
        // Muat data guru (tanpa akses admin)
        loadGuruData(); 
        listenToDailyAttendance();
        navigateTo('kehadiran'); // Kembali ke form kehadiran
    }
});

// --- ADMIN FUNCTION: Tambah Guru ---
const addGuru = async () => {
    if (!isAdminLoggedIn) {
        showToast('Akses ditolak. Hanya admin yang dapat menambah guru.', 'err');
        return;
    }
    const nama = prompt("Masukkan Nama Lengkap Guru:");
    if (!nama) return;

    const nip = prompt("Masukkan NIP (opsional):");
    const jabatan = prompt("Masukkan Jabatan (opsional):");

    try {
        await db.collection('guru').add({
            nama: nama,
            nip: nip || '',
            jabatan: jabatan || 'Guru',
            aktif: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast(`Guru ${nama} berhasil ditambahkan.`, 'ok');
        loadGuruData();
    } catch (error) {
        console.error("Gagal menambah guru: ", error);
        showToast("Gagal menambah guru: " + error.message, 'err');
    }
};

// --- INIT APP & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Navigasi
    document.querySelectorAll('.nav-item, .md\\:hidden button').forEach(button => {
        button.addEventListener('click', (e) => {
            navigateTo(e.currentTarget.dataset.page);
        });
    });

    // Toggle Sidebar (Mobile)
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('hidden');
        sidebar.classList.toggle('absolute'); 
        sidebar.classList.toggle('z-50');
    });

    // Inisialisasi tampilan default
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update jam setiap detik
    
    // Default: tampilkan form kehadiran
    navigateTo('kehadiran'); 
});

// --- XLSX/Laporan (Export Lokal) ---

/**
 * Fungsi untuk mendownload laporan (Export lokal menggunakan XLSX.js)
 */
window.downloadLaporan = async () => {
    if (!isAdminLoggedIn) {
        showToast('Akses ditolak. Hanya admin yang dapat mendownload laporan.', 'err');
        return;
    }
    
    const bulan = document.getElementById('bulan').value;
    if (!bulan) {
        showToast('Pilih bulan yang ingin didownload.', 'err');
        return;
    }

    showToast('Membuat laporan... (Tunggu sebentar)', 'info');

    const [year, month] = bulan.split('-');
    // Realtime DB Key: YYYY-MM-DD. Kita perlu rentang tanggal dalam format ini.
    // Dapatkan hari pertama dan terakhir bulan
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); 
    
    // Konversi ke format key (YYYY-MM-DD)
    const startDateKey = startDate.toLocaleDateString('en-CA');
    const endDateKey = endDate.toLocaleDateString('en-CA');
    
    try {
        // Ambil semua data kehadiran bulan ini (Realtime DB)
        // Kita menggunakan `orderByKey` dan `startAt`/`endAt` untuk rentang waktu.
        const snapshot = await rtdb.ref('kehadiran')
            .orderByKey()
            .startAt(startDateKey)
            .endAt(endDateKey)
            .once('value');

        const allKehadiran = snapshot.val();
        
        if (!allKehadiran) {
            showToast('Tidak ada data kehadiran untuk bulan ini.', 'err');
            return;
        }

        const exportData = [];
        // Header
        exportData.push(['Tanggal', 'Nama Guru', 'Status', 'Waktu', 'Lokasi', 'Koordinat', 'Photo URL']);

        // Flatten data
        Object.keys(allKehadiran).forEach(date => {
            // Pastikan data di bawah tanggal valid
            if (typeof allKehadiran[date] === 'object' && allKehadiran[date] !== null) {
                 Object.values(allKehadiran[date]).forEach(data => {
                    const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString('id-ID') : '-';
                    exportData.push([
                        data.tanggal || date,
                        data.nama || '-',
                        data.status || 'Tidak Diketahui',
                        time,
                        data.lokasi || '-',
                        data.coords || '-',
                        data.photoUrl || '-'
                    ]);
                });
            }
        });

        if (exportData.length <= 1) { // Hanya header
            showToast('Tidak ada data kehadiran untuk bulan ini.', 'err');
            return;
        }

        // Buat file Excel
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Kehadiran");
        XLSX.writeFile(wb, `Laporan_Kehadiran_${bulan}.xlsx`);
        
        showToast(`Laporan bulan ${bulan} berhasil dibuat.`, 'ok');

    } catch (error) {
        console.error("Gagal membuat laporan: ", error);
        showToast("Gagal membuat laporan: " + error.message, 'err');
    }
};
