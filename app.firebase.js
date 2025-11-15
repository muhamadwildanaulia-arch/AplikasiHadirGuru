// ======================================================
//  app.firebase.js (FINAL — FULL ONLINE VERSION)
// ======================================================
// Wajib load compat scripts SEBELUM file ini:
//
// <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js"></script>
// <script src="app.firebase.js"></script>
//
// ======================================================

(function(){

// ---------------------------------------------
// Firebase Config (punyamu)
// ---------------------------------------------
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

try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized");
} catch (e) {
    console.warn("Firebase init error:", e);
}

const db = firebase.database();
const auth = firebase.auth();

const LS_GURU = 'wh_guru_list_v1';
const LS_ATT = 'wh_att_list_v1';

function now(){ return Date.now(); }

// Convert snapshot → array
function snapToArray(snap){
    const arr = [];
    snap.forEach(ch => {
        const v = ch.val();
        v.id = ch.key;
        arr.push(v);
    });
    return arr;
}

// ======================================================
//  REALTIME LISTENERS
// ======================================================
let gurusListener = null;
let attListener = null;

function startListeners(){

    // ---- GURUS LISTENER ----
    if (!gurusListener){
        const ref = db.ref('/gurus');
        gurusListener = ref.on('value', snap => {
            const arr = snapToArray(snap);
            try { localStorage.setItem(LS_GURU, JSON.stringify(arr)); } catch(e){}
            window.__latest_guru_list = arr;
            window.dispatchEvent(new CustomEvent('gurus-updated',{ detail: arr }));
            console.log("Realtime: gurus updated");
        }, err => console.error("Gurus listener error:", err));
    }

    // ---- ATTENDANCES LISTENER ----
    if (!attListener){
        const ref = db.ref('/attendances');
        attListener = ref.on('value', snap => {
            const arr = snapToArray(snap);
            try { localStorage.setItem(LS_ATT, JSON.stringify(arr)); } catch(e){}
            window.__latest_att_list = arr;
            window.dispatchEvent(new CustomEvent('attendances-updated',{ detail: arr }));
            console.log("Realtime: attendances updated");
        }, err => console.error("Attendance listener error:", err));
    }
}

startListeners();

// ======================================================
//  SYNC MANUAL
// ======================================================
async function syncFromFirebase(){
    const [gSnap, aSnap] = await Promise.all([
        db.ref('/gurus').once('value'),
        db.ref('/attendances').once('value')
    ]);

    const gArr = snapToArray(gSnap);
    const aArr = snapToArray(aSnap);

    try {
        localStorage.setItem(LS_GURU, JSON.stringify(gArr));
        localStorage.setItem(LS_ATT, JSON.stringify(aArr));
    } catch(e){}

    window.__latest_guru_list = gArr;
    window.__latest_att_list = aArr;

    window.dispatchEvent(new CustomEvent('gurus-updated',{ detail: gArr }));
    window.dispatchEvent(new CustomEvent('attendances-updated',{ detail: aArr }));

    return { gArr, aArr };
}

// ======================================================
//  CRUD GURU
// ======================================================

async function addGuruFirebase(data){
    if (!data.nama) throw new Error("Nama diperlukan");
    const ref = db.ref('/gurus').push();
    const payload = {
        nip: data.nip || "",
        nama: data.nama,
        jabatan: data.jabatan || "",
        status: "Aktif",
        createdAt: now()
    };
    await ref.set(payload);
    return true;
}

async function updateGuruFirebase(id, data){
    if (!id) throw new Error("ID guru diperlukan");
    await db.ref('/gurus/' + id).update(data);
    return true;
}

async function deleteGuruFirebase(id){
    if (!id) throw new Error("ID guru diperlukan");
    await db.ref('/gurus/' + id).remove();
    return true;
}

// ======================================================
//  ADD ATTENDANCE
// ======================================================

async function addAttendanceFirebase(p){
    if (!p.tanggal || !p.namaGuru) throw new Error("Invalid payload");

    const ref = db.ref('/attendances').push();
    const payload = {
        idGuru: p.idGuru,
        namaGuru: p.namaGuru,
        status: p.status,
        tanggal: p.tanggal,
        jam: p.jam,
        lokasi: p.lokasi || "",
        placeName: p.placeName || "",
        createdAt: now(),
        yearMonth: (p.tanggal || "").slice(0,7)
    };

    await ref.set(payload);
    return true;
}

// ======================================================
//  GET MONTHLY REPORT
// ======================================================

async function getMonthlyReportFirebase(ym){
    if (!ym) throw new Error("yearMonth diperlukan");
    const snap = await db.ref('/attendances').orderByChild('yearMonth').equalTo(ym).once('value');
    return snapToArray(snap);
}

// ======================================================
//  AUTH LISTENER (ADMIN CLAIM SUPPORT)
// ======================================================

auth.onAuthStateChanged(async user => {

    if (!user){
        window.__WH_FIREBASE = { currentUser:null };
        window.dispatchEvent(new CustomEvent('auth-changed',{ detail:null }));
        return;
    }

    try {
        const token = await user.getIdTokenResult(true);
        const isAdmin = !!token.claims.admin;

        const info = { uid: user.uid, email: user.email, admin: isAdmin };
        window.__WH_FIREBASE = { currentUser: info };

        console.log("Auth State:", info);

        window.dispatchEvent(new CustomEvent('auth-changed',{ detail: info }));

    } catch(e){
        console.error("Token error:", e);
    }
});

// ======================================================
//  LOGIN & LOGOUT
// ======================================================

async function signInWithEmail(email, pw){
    const cred = await auth.signInWithEmailAndPassword(email, pw);
    const token = await cred.user.getIdTokenResult(true);

    return {
        uid: cred.user.uid,
        email: cred.user.email,
        admin: !!token.claims.admin
    };
}

async function signOutFirebase(){
    await auth.signOut();
    return true;
}

// ======================================================
//  EXPOSE TO WINDOW
// ======================================================

window.addGuruFirebase = addGuruFirebase;
window.updateGuruFirebase = updateGuruFirebase;
window.deleteGuruFirebase = deleteGuruFirebase;
window.addAttendanceFirebase = addAttendanceFirebase;
window.getMonthlyReportFirebase = getMonthlyReportFirebase;
window.syncFromFirebase = syncFromFirebase;
window.signInWithEmail = signInWithEmail;
window.signOutFirebase = signOutFirebase;

console.log("app.firebase.js fully loaded + online");

})();
