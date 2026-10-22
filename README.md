# 📖 SatuJuz — Aplikasi Hafalan & Muroja'ah Al-Qur'an Juz 30

**SatuJuz** adalah aplikasi web modern (*Progressive Web App / PWA*) yang dirancang khusus untuk mempermudah santri, pelajar, dan penghafal Al-Qur'an dalam menghafal, menguji, dan mengulang (*muroja'ah / tikrar*) **37 Surat di Juz 30 (Juz 'Amma: QS. An-Naba' [78] s/d QS. An-Nas [114])**.

Aplikasi ini menggunakan **Rasm Utsmani Standar Kementerian Agama RI** dengan font resmi **LPMQ Isep Misbah**, terjemahan resmi Kemenag RI, audio murottal jernih dari **Quran.com API v4**, serta sistem jurnal riwayat dan pelacak progres hafalan yang komprehensif.

---

## 🌟 Fitur Utama Aplikasi

### 1. 🎧 Tab Latihan (Metode Tikrar & Talaqqi)
- **Pilih Surat & Ayat Fleksibel**:
  - Daftar lengkap **37 surat Juz 30** disertai filter cepat (Semua, Sedang Dihafal, Sudah Hafal, Mutqin, Belum Mulai).
  - Pilih **1 ayat**, **rentang ayat** (misal: Ayat 1–5), atau **pilih acak** (*multi-select*).
  - Tombol pintas preset: *"Semua Ayat"*, *"Ayat 1-3"*, *"Ayat 1-5"*, *"Ayat 6-10"*, dan *"5 Terakhir"*.
  - Stepper tombol `+` dan `-` untuk mengatur rentang ayat dengan cepat.
- **Pengulangan Audio (*Tikrar Engine*)**:
  - Pilihan jumlah putaran: **1x**, **3x**, **5x**, **7x**, **10x**, **20x**, **40x** *(metode tikrar 40 kali)*, hingga **∞ Loop**.
  - **Mode Per-Ayat (Talaqqi)**: Mengulang ayat yang sama *N* kali sebelum otomatis berpindah ke ayat berikutnya (ideal untuk menghafal ayat baru).
  - **Mode Seluruh Blok (Muraja'ah Rangkaian)**: Memutar seluruh ayat terpilih berurutan, lalu mengulang blok tersebut *N* kali (ideal untuk memperkuat sambungan ayat).
- **Jeda Waktu Menirukan (*Echo Delay*)**:
  - Memberi jeda hening (1.5 detik / 3 detik) setelah qari selesai membaca ayat disertai indikator visual agar pengguna menirukan bacaan.
- **Pilihan Qari Internasional**:
  - Mishari Rashid al-`Afasy *(Default)*
  - Mahmoud Khalil Al-Husary (Muallim)
  - Abdur-Rahman as-Sudais
  - Mohamed Siddiq al-Minshawi
  - Abu Bakr al-Shatri
- **Mode Uji Ingatan (*Blind / Quiz Mode*)**:
  - Tombol mata untuk menyamarkan teks ayat dengan efek blur untuk menguji kekuatan hafalan secara mandiri (dapat disentuh untuk mengintip).

---

### 2. 📊 Tab Progress (Pelacak Hafalan Lengkap)
Dashboard evaluasi progres hafalan dengan 3 sub-tampilan:

1. **Sub-Tab "Per Halaman" (Grid 20 Halaman)**:
   - Menampilkan seluruh **20 halaman Juz 30** (Halaman 582 s/d 604 Standar Mushaf Madinah/Kemenag).
   - Setiap kartu halaman menampilkan nomor halaman, daftar surat & ayat di halaman tersebut, serta persentase penguasaan.
   - Tombol cepat untuk mencatat setoran per halaman.
2. **Sub-Tab "Per Surat" (Tabel Monitoring & Status Dinamis)**:
   - Tabel ringkas 37 surat memuat: nama surat & nomor ayat, ayat yang sudah dihafal, persentase kelulusan, dan tanggal update.
   - **Bar Persentase Warna Dinamis (Aturan 7 Hari)**:
     - 🟢 **Hijau Mint (`#14b8a6`)**: Status **Lancar** jika surat baru saja disetor atau diulang dalam kurun waktu **<= 7 hari**.
     - 🟡 **Kuning/Orange (`#f59e0b`)**: Status **Perlu Murojaah** jika sudah melewati **> 7 hari** sejak update terakhir.
     - ⚪ **Abu-abu (`#cbd5e1`)**: Status **Belum Mulai** (0%).
   - **Kolom Tanggal Interaktif**: Format 2 digit tahun (contoh: `16/10/26`) yang dapat diklik untuk memilih tanggal manual lewat datepicker.
   - **Legenda Status Ringkas 1 Baris**: Memberikan petunjuk visual yang jelas dan rapi.
3. **Sub-Tab "Checklist"**:
   - Daftar checklist per ayat interaktif untuk menandai setiap ayat yang sudah dikuasai secara presisi.
4. **Statistik Kumulatif**:
   - Total Surat Hafal (contoh: *14 / 37 Surat*).
   - Total Ayat Dikuasai (contoh: *185 / 564 Ayat*).
   - Persentase Kelulusan Juz 30 & *Daily Streak*.

---

### 3. 📜 Tab Riwayat (History & Jurnal Mingguan)
Pencatatan aktivitas latihan dan setoran hafalan otomatis dan terstruktur:

- **Jurnal Mingguan (*7-Day Weekly Grid*)**:
  - Blok navigasi mingguan (navigasi mundur/maju antarminggu) dengan ringkasan total sesi dan menit latihan.
  - Setiap hari memiliki kartu blok tersendiri (*Day Block Card*).
- **Format 3 Kolom Seimbang & Rapi**:
  - **Kolom 1 (Jam)**: Waktu sesi (contoh: `10:42`, `18:19`) berposisi *center*.
  - **Kolom 2 (Surat & Ayat)**: Nama surat dan nomor ayat (contoh: `Al-'Alaq • 1 - 10`) berposisi *rapat kiri*, tanpa kata "Ayat" sehingga ringkas dan lurus vertikal.
  - **Kolom 3 (Pengulangan / Setoran)**: Badge pengulangan & durasi latihan (`20x  ⏱️ 19m`) atau label `Setoran` berposisi *rapat kiri*, sejajar lurus secara vertikal dengan badge jumlah sesi di bagian atas.
- **Urutan Kronologis Sesi Harian**:
  - Sesi di dalam satu hari terurut dari **pagi ke malam** (waktu paling awal di paling atas, waktu paling akhir di paling bawah).
- **Label Setoran Bersih**:
  - Sesi setoran murni hanya menampilkan badge **"Setoran"** tanpa embel-embel perkiraan waktu (5m) dan tidak menggembungkan total menit latihan.
- **Pembersihan Otomatis & Anti-Duplikasi (*Auto-Deduplication*)**:
  - Sistem otomatis membersihkan catatan input ganda pada profil pengguna dan mencegah duplikasi akibat klik berulang pada tombol simpan.
- **Multi-Profil & Pencadangan Data**:
  - Mendukung banyak profil santri/pengguna dalam satu perangkat.
  - Tombol **Ekspor JSON** dan **Impor JSON** untuk mencadangkan dan memulihkan seluruh data riwayat.

---

### 4. 📱 Progressive Web App (PWA) & Offline Ready
- **Bisa Diinstal di Smartphone**: Tampil layaknya aplikasi Android/iOS asli (*standalone window*, tanpa address bar browser, dengan splash screen dan ikon khusus).
- **Offline Ready**: Dilengkapi *Service Worker* dan database lokal teks 564 ayat Juz 30 (`verses_juz30.json`) sehingga aplikasi tetap dapat dibuka dan dipelajari kapan saja tanpa jaringan internet.
- **Responsif Mobile & Desktop**: Tampilan mobile-first yang dioptimalkan untuk layar sentuh, serta simulator smartphone yang elegan di layar laptop/PC.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi SatuJuz bersifat **zero-dependency** (tidak membutuhkan instalasi paket eksternal yang rumit):

### Cara 1: Buka Langsung File HTML
Buka file `index.html` dengan browser Google Chrome, Safari, atau Microsoft Edge:
```bash
open /Users/asrianti/.gemini/antigravity/scratch/hafalan-juz30/index.html
```

### Cara 2: Menjalankan Local Server (Direkomendasikan)
Jalankan server lokal mandiri menggunakan Node.js:
```bash
node server.js
```
Atau jalankan skrip shell:
```bash
./serve.sh
```
Akses di browser melalui: **`http://localhost:8080`**

---

## 📲 Cara Memasang (*Install*) Aplikasi di HP

### Metode Online / Cloud (Paling Direkomendasikan ⭐)
Gunakan berkas [satujuz.zip](file:///Users/asrianti/Downloads/satujuz.zip) untuk deploy instan:
1. Buka [app.netlify.com/drop](https://app.netlify.com/drop) di browser Mac Anda.
2. Tarik (*drag & drop*) berkas `satujuz.zip` atau folder `hafalan-juz30` ke halaman tersebut.
3. Netlify akan membuatkan link web HTTPS (contoh: `https://satujuz.netlify.app`).
4. Buka link tersebut di HP:
   - **Android (Chrome)**: Tekan menu titik tiga **⋮** ➔ pilih **"Install app"** / **"Pasang aplikasi"**.
   - **iPhone (Safari)**: Tekan tombol **Share** (kotak panah ke atas) ➔ pilih **"Tambahkan ke Layar Utama"** (*Add to Home Screen*).

### Metode Jaringan Wi-Fi Lokal
1. Pastikan HP dan Mac terhubung ke jaringan Wi-Fi yang sama.
2. Jalankan server lokal di Mac (`node server.js`).
3. Di HP Anda, buka browser dan ketik alamat IP lokal Mac Anda (contoh: `http://192.168.1.27:8080`).

---

## 📁 Struktur Berkas Proyek

```text
hafalan-juz30/
├── index.html                 # Halaman utama aplikasi (Latihan, Progress, Riwayat)
├── manifest.json              # Web App Manifest untuk instalasi PWA
├── sw.js                      # Service Worker untuk caching offline & PWA (v39)
├── server.js                  # HTTP server lokal mandiri (Zero-dependency Node.js)
├── serve.sh                   # Skrip otomatis untuk menjalankan server lokal
├── package.json               # Konfigurasi metadata proyek
├── satujuz.zip                # Arsip distribusi aplikasi lengkap siap pasang
├── README.md                  # Dokumentasi proyek
├── css/
│   └── style.css              # Styling visual responsif, tema mint/dark, grid 3 kolom
├── js/
│   ├── app.js                 # Kontroler UI utama, render grid mingguan, datepicker, event handlers
│   ├── audio-player.js        # Mesin audio pengulangan tikrar, mode talaqqi, echo delay
│   ├── history-manager.js     # Manajemen progres hafalan, multi-profil, auto-deduplikasi
│   └── api.js                 # Klien integrasi Quran.com API v4 & audio streams
├── data/
│   ├── verses_juz30.json      # Dataset lengkap teks 564 ayat Utsmani & terjemahan Kemenag RI
│   ├── juz30_surahs.json      # Metadata 37 surat Juz 30 (nama, tempat turun, jumlah ayat)
│   ├── juz30_data.js          # Skrip loader data offline
│   └── quran_metadata.js      # Metadata struktur Al-Qur'an
├── fonts/
│   └── LPMQ-IsepMisbah.ttf    # Font resmi Standar Mushaf Kemenag RI
└── icons/
    ├── icon-192.png           # Ikon PWA 192x192 px
    ├── icon-512.png           # Ikon PWA 512x512 px
    ├── icon.svg               # Ikon vektor aplikasi
    ├── favicon.png            # Favicon browser
    └── *-icon.png             # Ikon navigasi tab (latihan, progress, history, setoran)
```

---

## 📄 Lisensi & Kredit
- **Teks Al-Qur'an & Terjemahan**: Standar Kementerian Agama Republik Indonesia (LPMQ).
- **Font Kaligrafi**: Font Mushaf Standar Indonesia *LPMQ Isep Misbah*.
- **Audio Murattal**: Didukung oleh [Quran.com API v4](https://api.quran.com/).

---
*Dibuat dengan penuh cinta dan khidmat untuk para penghafal Al-Qur'an.* 🕌✨
