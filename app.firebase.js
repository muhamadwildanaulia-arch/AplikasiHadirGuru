// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DOM refs
const namaGuruEl = document.getElementById("namaGuru");
const statusEl = document.getElementById("statusKehadiran");
const lokasiEl = document.getElementById("lokasi");
const btnKirim = document.getElementById("kirimKehadiranBtn");
const tableGuru = document.getElementById("guruTableBody");

// Ambil daftar guru realtime
function syncFromFirebase() {
  db.ref("gurus").on("value", (snapshot) => {
    const val = snapshot.val() || {};
    const list = Object.keys(val).map((k) => ({ id: k, ...val[k] }));
    renderGuru(list);
  });
}

// Render tabel dan dropdown
function renderGuru(list) {
  namaGuruEl.innerHTML = `<option value="">-- Pilih Guru --</option>`;
  tableGuru.innerHTML = "";
  list.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.nama;
    opt.textContent = g.nama;
    namaGuruEl.appendChild(opt);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="border p-2">${g.nip || "-"}</td>
      <td class="border p-2">${g.nama}</td>
      <td class="border p-2">${g.jabatan || "-"}</td>`;
    tableGuru.appendChild(tr);
  });
  document.getElementById("totalGuru")?.textContent = list.length;
}
syncFromFirebase();

// Kirim kehadiran ke Firebase
btnKirim.addEventListener("click", () => {
  const nama = namaGuruEl.value;
  const status = statusEl.value;
  const lokasi = lokasiEl.value;
  if (!nama || !status) return alert("Lengkapi semua kolom!");
  const now = new Date();
  const data = {
    nama,
    status,
    lokasi,
    waktu: now.toLocaleString("id-ID"),
    tanggal: now.toLocaleDateString("id-ID"),
  };
  db.ref("kehadiran").push(data);
  document.getElementById("kehadiran-status").textContent = "✅ Terkirim!";
  setTimeout(() => (document.getElementById("kehadiran-status").textContent = "—"), 3000);
});

// Lokasi otomatis dengan nama tempat singkat 📍
if (navigator.geolocation && lokasiEl) {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude.toFixed(6);
    const lon = pos.coords.longitude.toFixed(6);
    lokasiEl.value = "📍 Mencari lokasi...";
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await resp.json();
      if (data && data.address) {
        const addr = data.address;
        const daerah =
          addr.suburb ||
          addr.village ||
          addr.town ||
          addr.city ||
          addr.county ||
          addr.state ||
          "";
        const prov = addr.state || "";
        lokasiEl.value =
          daerah && prov
            ? `📍 ${daerah}, ${prov}`
            : daerah
            ? `📍 ${daerah}`
            : prov
            ? `📍 ${prov}`
            : `${lat}, ${lon}`;
      } else {
        lokasiEl.value = `${lat}, ${lon}`;
      }
    } catch (err) {
      lokasiEl.value = `${lat}, ${lon}`;
    }
  });
}

// Jam & tanggal
function updateTopDate() {
  document.getElementById("current-date-top").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function updateClock() {
  document.getElementById("clock-small").textContent = new Date().toLocaleTimeString("id-ID");
}
setInterval(updateClock, 1000);
updateTopDate();
updateClock();
