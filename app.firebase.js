// =======================================================
//  app.firebase.js — Full Online (Realtime + Auth + CRUD)
// =======================================================

(function(){

// ---------------------------------------------
// Firebase Config (punya kamu)
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

// init firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("%cFirebase initialized ✓", "color:green");
} catch(e){
    console.warn("Firebase init error:", e);
}

const db = firebase.database();
const auth = firebase.auth();

// local cache keys
const LS_GURU = 'wh_guru_list_v1';
const LS_ATT  = 'wh_att_list_v1';

function now(){ return Date.now(); }

// convert snapshot to array
function snapToArray(snap){
    const arr = [];
    snap.forEach(ch => {
        const v = ch.val();
        v.id = ch.key;
        arr.push(v);
    });
    return arr;
}

// =============================================
//  REALTIME LISTENERS
// =============================================
let guruListener = null;
let attListener  = null;

function startRealtime(){

    if (!guruListener){
        guruListener = db.ref('/gurus').on('value', snap => {
            const arr = snapToArray(snap);
            try { localStorage.setItem(LS_GURU, JSON.stringify(arr)); } catch(e){}
            window.__latest_guru_list = arr;
            window.dispatchEvent(new CustomEvent('gurus-updated',{ detail: arr }));
            console.log("Realtime: gurus updated", arr.length);
        }, err => console.error("Guru listener error:", err));
    }

    if (!attListener){
        attListener = db.ref('/attendances').on('value', snap => {
            const arr = snapToArray(snap);
            try { localStorage.setItem(LS_ATT, JSON.stringify(arr)); } catch(e){}
            window.__latest_att_list = arr;
            window.dispatchEvent(new CustomEvent('attendances-updated',{ detail: arr }));
            console.log("Realtime: attendances updated", arr.length);
        }, err => console.error("Attendance listener error:", err));
    }
}

startRealtime();

// =============================================
//  SYNC MANUAL
// =============================================
async function syncFromFirebase(){
    const [gSnap, aSnap] = await Promise.all([
        db.ref('/gurus').once('value'),
        db.ref('/attendances').once('value')
    ]);

    const gArr = snapToArray(gSnap);
    const aArr = snapToArray(aSnap);

    localStorage.setItem(LS_GURU, JSON.stringify(gArr));
    localStorage.setItem(LS_ATT, JSON.stringify(aArr));

    window.__latest_guru_list = gArr;
    window.__latest_att_list  = aArr;

    window.dispatchEvent(new CustomEvent('gurus-updated',{ detail: gArr }));
    window.dispatchEvent(new CustomEvent('attendances-updated',{ detail: aArr }));

    return { gArr, aArr };
}

// =============================================
//  CRUD GURU
// =============================================
async function addGuruFirebase(data){
    if (!data.nama) throw new Error("Nama diperlukan!");

    const ref = db.ref('/gurus').push();
    await ref.set({
        nip: data.nip || "",
        nama: data.nama,
        jabatan: data.jabatan || "",
        status: "Aktif",
        createdAt: now()
    });

    return true;
}

async function updateGuruFirebase(id, data){
    if (!id) throw new Error("ID diperlukan!");
    await db.ref('/gurus/' + id).update(data);
    return true;
}

async function deleteGuruFirebase(id){
    if (!id) throw new Error("ID diperlukan!");
    await db.ref('/gurus/' + id).remove();
    return true;
}

// =============================================
//  ADD ATTENDANCE
// =============================================
async function addAttendanceFirebase(p){
    if (!p.tanggal || !p.namaGuru) throw new Error("Data tidak lengkap");

    const ref = db.ref('/attendances').push();
    await ref.set({
        idGuru: p.idGuru,
        namaGuru: p.namaGuru,
        status: p.status,
        tanggal: p.tanggal,
        jam: p.jam,
        lokasi: p.lokasi || "",
        placeName: p.placeName || "",
        createdAt: now(),
        yearMonth: (p.tanggal || "").slice(0,7)
    });

    return true;
}

// =============================================
//  LAPORAN BULANAN (FILTER)
// =============================================
async function getMonthlyReportFirebase(ym){
    const snap = await db.ref('/attendances')
        .orderByChild('yearMonth').equalTo(ym)
        .once('value');

    return snapToArray(snap);
}

// =============================================
//  AUTH LISTENER + CUSTOM CLAIM ADMIN
// =============================================
auth.onAuthStateChanged(async user => {
    if (!user){
        window.__WH_FIREBASE = { currentUser:null };
        window.dispatchEvent(new CustomEvent('auth-changed',{ detail:null }));
        return;
    }

    try {
        const token = await user.getIdTokenResult(true);
        const isAdmin = !!token.claims.admin;

        const info = {
            uid: user.uid,
            email: user.email,
            admin: isAdmin
        };

        window.__WH_FIREBASE = { currentUser: info };
        window.dispatchEvent(new CustomEvent('auth-changed',{ detail: info }));

        console.log("Auth state:", info);

    } catch(err){
        console.error("auth token error:", err);
    }
});

// =============================================
//  LOGIN / LOGOUT
// =============================================
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

// =============================================
//  EXPORT to window (dipakai index.html)
// =============================================
window.addGuruFirebase         = addGuruFirebase;
window.updateGuruFirebase      = updateGuruFirebase;
window.deleteGuruFirebase      = deleteGuruFirebase;
window.addAttendanceFirebase   = addAttendanceFirebase;
window.getMonthlyReportFirebase= getMonthlyReportFirebase;
window.syncFromFirebase        = syncFromFirebase;
window.signInWithEmail         = signInWithEmail;
window.signOutFirebase         = signOutFirebase;

console.log("%capp.firebase.js fully loaded ✓", "color:green");

})();
