// set-admin.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://websitehadirsekolah-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const uid = process.argv[2]; // jalankan: node set-admin.js <uid>

if (!uid) {
  console.error('Gunakan: node set-admin.js <uid>');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log('Custom claim "admin" diterapkan untuk UID:', uid);
    console.log('Login ulang diperlukan untuk melihat perubahan.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Gagal set claim:', err);
    process.exit(1);
  });
