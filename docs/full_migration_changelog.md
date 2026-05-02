# Catatan Rilis & Dokumentasi Perubahan (Migration & Updates)
**Proyek:** Event Organizer BINUS
**Fase:** Migrasi Akses Publik, Sinkronisasi Skema Database, & Pemeliharaan Dependensi

Dokumen ini merangkum seluruh perubahan teknis yang dilakukan pada bagian *Frontend* (React) sejak awal transisi platform menuju sistem yang terbuka untuk publik (Binusian).

---

## 1. Transisi Akses Publik
Sistem telah dirombak untuk tidak lagi mewajibkan *login* bagi pengakses awam (mahasiswa/publik).
*   **Routing (`src/App.jsx`)**: Menghapus *route* berpelindung untuk pengguna biasa dan menjadikan `<DashboardUser />` sebagai halaman utama (`/`).
*   **Pembersihan Direktori**: Menghapus file `src/Pages/Login.jsx` dan `src/Pages/Register.jsx` beserta impornya di `App.jsx` karena mahasiswa kini tidak lagi memerlukan akun untuk melihat acara.
*   **Header (`src/Pages/Component/MainHeader.jsx`)**: Mengubah tampilan *header* agar jika pengguna belum *login*, sistem akan menampilkannya sebagai `PUBLIC` dengan sapaan "Hello Binusian", serta mengubah tombol aksi menjadi "Log In" (yang diarahkan ke halaman admin).

## 2. Sinkronisasi Skema *Frontend* & *Backend*
Terjadi perubahan besar pada *schema database* backend (Joi Validation & Model), sehingga *frontend* harus disesuaikan agar proses pembuatan dan penyuntingan acara tidak *error*.
*   **Pemisahan Tanggal (`src/Pages/Component/EventFormModal.jsx`)**: Memisahkan satu *input* `date` menjadi `startDate` dan `endDate` secara terpisah di *form* pendaftaran acara.
*   **Pemetaan Nama (Key Payload)**: Mengubah pengiriman *key* payload judul acara dari `eventName` menjadi `name` agar lolos validasi *backend*.
*   **Pemotongan String Tanggal**: Menambahkan *logic* `.substring(0, 10)` pada inisialisasi form modal agar data dari DB (*Date Object*) dapat terbaca oleh elemen HTML `<input type="date">`.

## 3. Perbaikan *Bug* Tampilan (*"Invalid Date" & Missing Name*)
Setelah struktur database diperbarui, beberapa tabel dan modal menampilkan *"Invalid Date"* dan gagal merender nama acara. Hal ini telah diatasi:
*   **Tabel Admin (`src/Pages/Component/TableData.jsx`)**: Mengubah variabel pemanggilan tabel dari `event.date` menjadi `event.startDate || event.date` dan `event.eventName` menjadi `event.name || event.eventName`.
*   **Modal Detail Super Admin (`src/Pages/Component/EventDetailModal.jsx`)**: Menyesuaikan pembacaan judul dan menambahkan fitur otomatis: *Jika Start Date dan End Date berbeda hari, maka tanggal akan ditampilkan sebagai rentang (contoh: 6 Mei - 8 Mei).*
*   **Dashboard Publik (`src/Pages/Dashboard.jsx`)**: Melakukan pencarian massal (*replace*) pada *Current Events Carousel*, daftar *This Week*, dan kartu *Next Events* agar semuanya menggunakan variabel pemetaan `startDate` dan `name` terbaru.

## 4. Penambahan Fitur (UI Enhancement)
*   **Pengajuan Event via QR Code (`src/Pages/Dashboard.jsx`)**: Menambahkan area informatif di sudut kanan bawah halaman (di sebelah kolom *Next Events*) yang berisi **QR Code Pengajuan Event**. QR Code ini ditujukan bagi mahasiswa yang memiliki ide dan ingin mengajukan acaranya ke PIC terkait.

## 5. Pemeliharaan Dependensi (React Router v7)
Buntut dari perintah `npm update`, *package* dependensi terangkat ke versi terbaru yang menimbulkan *deprecation warnings*.
*   **Migrasi React Router**: React Router v7 menyatakan *package* `react-router-dom` usang (*deprecated*). Sebuah skrip massal dieksekusi untuk merombak seluruh struktur `import { ... } from "react-router-dom"` menjadi `import { ... } from "react-router"` di 11 file yang terdampak (termasuk Auth, Router, Dashboard, dan Login).

---
**Status Saat Ini:** Selesai dan 100% stabil untuk sisi *frontend*. Semua pembaruan telah selaras dengan kode *backend* yang disediakan oleh tim pengembang lain.
