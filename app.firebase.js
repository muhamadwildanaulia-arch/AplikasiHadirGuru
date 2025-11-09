// app.firebase.js — WebsiteHadir + Firebase Realtime Database (FINAL)
// Developer: D.A.N × GPT-5 | 2025
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getDatabase, ref, push, onValue, get } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// ---- MASUKKAN firebaseConfig milikmu DI SINI ----
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
// -----------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// local state
let guruList = [], kehadiranList = [], chartInstance = null;

// util
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showLoading(msg='Memuat...'){ if(document.getElementById('loadingOverlay')) return; const el=document.createElement('div'); el.id='loadingOverlay'; el.style='position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:9999'; el.innerHTML=`<div style="background:#fff;padding:14px 18px;border-radius:8px;box-shadow:0 8px 24px rgba(16,24,40,.12);font-weight:600;color:#0b5ed7">${msg}</div>`; document.body.appendChild(el); }
function hideLoading(){ const e=document.getElementById('loadingOverlay'); if(e) e.remove(); }

// init
async function initFirebaseApp(){
  showLoading('📡 Menyambung ke Firebase...');
  try {
    await loadGuru();
    await loadKehadiranOnce();
    initFormHandlers();
    renderDashboard();
    initRealtimeListeners();
  } catch(err){
    console.error('Init error', err);
    alert('Gagal inisialisasi Firebase — cek console.');
  } finally { hideLoading(); }
}

// load guru (one-time)
async function loadGuru(){
  try {
    const snapshot = await get(ref(db, 'guru'));
    const val = snapshot.exists() ? snapshot.val() : null;
    guruList = [];
    const select = document.getElementById('namaGuru');
    if (select) select.innerHTML = '';
    if (val) {
      Object.keys(val).forEach(k => {
        const it = val[k];
        guruList.push({ id:k, nama_guru: it.nama || it.name || '', jabatan: it.jabatan || '', status: it.status || '' });
      });
      guruList.sort((a,b)=> (a.nama_guru||'').localeCompare(b.nama_guru||''));
      if (select) select.innerHTML = guruList.map(g => `<option value="${escapeHtml(g.nama_guru)}">${escapeHtml(g.nama_guru)}</option>`).join('');
    } else {
      if (select) select.innerHTML = '<option value="">(Belum ada data guru)</option>';
    }
    renderGuruTable();
  } catch(e){ console.error('loadGuru', e); }
}

// load kehadiran (one-time)
async function loadKehadiranOnce(){
  try {
    const snapshot = await get(ref(db, 'kehadiran'));
    const val = snapshot.exists() ? snapshot.val() : null;
    kehadiranList = [];
    if (val) {
      Object.keys(val).forEach(k => {
        const it = val[k];
        kehadiranList.push({ id:k, nama_guru: it.nama || it.name || '', status: it.status || '', jam: it.jam || '', tanggal: it.tanggal || '', lokasi: it.lokasi || '' });
      });
      kehadiranList.sort((a,b) => (a.tanggal + (a.jam||'')) > (b.tanggal + (b.jam||'')) ? 1 : -1);
    }
  } catch(e){ console.error('loadKehadiranOnce', e); }
}

// realtime listener
function initRealtimeListeners(){
  const kRef = ref(db, 'kehadiran');
  onValue(kRef, snapshot => {
    const val = snapshot.exists() ? snapshot.val() : null;
    kehadiranList = [];
    if (val) {
      Object.keys(val).forEach(k => {
        const it = val[k];
        kehadiranList.push({ id:k, nama_guru: it.nama || it.name || '', status: it.status || '', jam: it.jam || '', tanggal: it.tanggal || '', lokasi: it.lokasi || '' });
      });
      kehadiranList.sort((a,b) => (a.tanggal + (a.jam||'')) > (b.tanggal + (b.jam||'')) ? 1 : -1);
    }
    renderDashboard();
  });
}

// form: lokasi + submit
function initFormHandlers(){
  const lokasiEl = document.getElementById('lokasi');
  if (lokasiEl){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos => { lokasiEl.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; }, err => { lokasiEl.value = "Lokasi tidak diizinkan"; }, { timeout:5000 });
    } else lokasiEl.value = "Perangkat tidak mendukung GPS";
  }
  const btn = document.getElementById('kirimKehadiranBtn');
  if (btn) btn.addEventListener('click', handleSubmitKehadiran);
}

async function handleSubmitKehadiran(e){
  e && e.preventDefault();
  const nama = document.getElementById('namaGuru')?.value?.trim() || '';
  const status = document.getElementById('statusKehadiran')?.value || '';
  const lokasi = document.getElementById('lokasi')?.value || '';
  if (!nama || !status) return alert('Pilih nama guru dan status kehadiran.');

  const now = new Date();
  const jam = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const tanggal = now.toISOString().split('T')[0];
  const payload = { nama, status, jam, tanggal, lokasi };

  try {
    showLoading('Mengirim kehadiran...');
    const pRef = push(ref(db, 'kehadiran'));
    await pRef.set(payload);
    hideLoading();
    alert('✅ Kehadiran berhasil dikirim.');
    const statusSel = document.getElementById('statusKehadiran');
    if (statusSel) statusSel.value = '';
  } catch(err){
    hideLoading();
    console.error('Gagal kirim kehadiran', err);
    alert('Gagal kirim. Periksa koneksi atau rules Firebase.');
  }
}

// render dashboard, chart, table, laporan — (fungsi ringkas)
function renderDashboard(){
  document.getElementById('totalGuru') && (document.getElementById('totalGuru').textContent = String(guruList.length || 0));
  const today = new Date().toISOString().split('T')[0];
  const todayData = kehadiranList.filter(x => x.tanggal === today);
  const hadir = todayData.filter(x => x.status === 'Hadir').length;
  const lain = todayData.filter(x => x.status !== 'Hadir').length;
  document.getElementById('totalHadir') && (document.getElementById('totalHadir').textContent = String(hadir));
  document.getElementById('totalLain') && (document.getElementById('totalLain').textContent = String(lain));
  renderChart(todayData);
  renderRecentActivity(todayData);
}

function renderChart(data){
  const ctxEl = document.getElementById('chartDashboard');
  if(!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  const counts = { Hadir:0, Izin:0, Sakit:0, 'Dinas Luar':0 };
  data.forEach(d => { if (counts[d.status]!==undefined) counts[d.status]++; });
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, { type:'bar', data:{ labels:Object.keys(counts), datasets:[{ data:Object.values(counts), backgroundColor:['#dc2626','#1e3a8a','#facc15','#16a34a'] }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } });
}

function renderRecentActivity(data){
  const el = document.getElementById('recent-activity');
  if(!el) return;
  const recent = data.slice(-10).reverse();
  if(!recent.length){ el.innerHTML = `<p class="text-gray-400">Belum ada data kehadiran hari ini.</p>`; return; }
  el.innerHTML = recent.map(r => `<div class="flex justify-between border-b py-1"><span>${escapeHtml(r.nama_guru || r.nama)}</span><span class="text-gray-500 text-xs">${escapeHtml(r.jam)}</span></div>`).join('');
}

function renderGuruTable(){
  const tbody = document.getElementById('guruTableBody');
  if(!tbody) return;
  if(!guruList.length){ tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data guru.</td></tr>`; return; }
  tbody.innerHTML = guruList.map(g => `<tr class="hover:bg-gray-50"><td class="border p-2">${escapeHtml(g.nip)}</td><td class="border p-2">${escapeHtml(g.nama_guru)}</td><td class="border p-2">${escapeHtml(g.jabatan)}</td><td class="border p-2">${escapeHtml(g.status||'')}</td></tr>`).join('');
}

function tampilkanLaporan(){
  const bulan = document.getElementById('bulan')?.value;
  if(!bulan) return alert('Pilih bulan terlebih dahulu.');
  const [y,m] = bulan.split('-');
  const data = kehadiranList.filter(d => d.tanggal && d.tanggal.startsWith(`${y}-${m}`));
  const tbody = document.getElementById('laporanTableBody');
  if(!tbody) return;
  if(!data.length){ tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Tidak ada data untuk bulan ini.</td></tr>`; document.getElementById('resume-laporan').innerHTML=''; return; }
  tbody.innerHTML = data.map(r => `<tr><td class="border p-2">${escapeHtml(r.tanggal)}</td><td class="border p-2">${escapeHtml(r.nama_guru||r.nama)}</td><td class="border p-2">${escapeHtml(r.jam)}</td><td class="border p-2">${escapeHtml(r.lokasi)}</td><td class="border p-2">${escapeHtml(r.status)}</td></tr>`).join('');
  const total = { Hadir:0, Izin:0, Sakit:0, 'Dinas Luar':0 };
  data.forEach(d => { if(total[d.status]!==undefined) total[d.status]++; });
  document.getElementById('resume-laporan') && (document.getElementById('resume-laporan').innerHTML = `<p>Hadir: <b>${total.Hadir}</b> | Izin: <b>${total.Izin}</b> | Sakit: <b>${total.Sakit}</b> | Dinas Luar: <b>${total['Dinas Luar']}</b></p><p>Total: <b>${data.length}</b></p>`);
}

function exportLaporanExcel(){
  const rows=[];
  document.querySelectorAll('#laporanTableBody tr').forEach(tr=>{
    const td=tr.querySelectorAll('td');
    if(td.length===5) rows.push({ Tanggal:td[0].textContent, Nama:td[1].textContent, Jam:td[2].textContent, Lokasi:td[3].textContent, Status:td[4].textContent });
  });
  if(!rows.length) return alert('Tidak ada data untuk diekspor.');
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, `laporan_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// attach buttons
document.addEventListener('DOMContentLoaded', ()=>{ const sBtn=document.getElementById('tampilkanLaporanBtn'); if(sBtn) sBtn.addEventListener('click', tampilkanLaporan); const eBtn=document.getElementById('exportLaporanBtn'); if(eBtn) eBtn.addEventListener('click', exportLaporanExcel); });

// init
initFirebaseApp();

// expose for debug
window.__firebaseDebug = { guruList, kehadiranList, renderDashboard, tampilkanLaporan };
