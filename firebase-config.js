// =========================================================
// ISI BAGIAN INI dengan config project Firebase kamu sendiri.
// Cara dapetinnya ada di README.md bagian "Setup Firebase".
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyBiWL8OR-h-YKrwi_jyTzaVU4MVDFlyMpo",
  authDomain: "seputarbokep-f4fc6.firebaseapp.com",
  projectId: "seputarbokep-f4fc6",
  storageBucket: "seputarbokep-f4fc6.firebasestorage.app",
  messagingSenderId: "719473682207",
  appId: "1:719473682207:web:929c2fb1e3a7b5c713b22a"
};

// Kode admin sederhana buat proteksi tombol Tambah/Edit/Hapus.
// PENTING: ini BUKAN keamanan yang kuat (siapa pun yang buka DevTools
// bisa lihat kode ini di script). Cukup buat nyaring pengunjung random,
// bukan buat data rahasia/sensitif. Ganti sesuka kamu.
const ADMIN_PASSCODE = "123445678";
