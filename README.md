# E-MASTER AutoFill — Aktivitas Harian SKP

Userscript (Tampermonkey / Greasemonkey) untuk mengisi otomatis form **Aktivitas Harian SKP** di aplikasi [Si-MASTER BKD Jatim](https://master.bkd.jatimprov.go.id).

> **Login tetap manual** — skrip ini hanya mengisi data ke form, tidak menyimpan password.

---

## Fitur

- **GUI Panel** — panel mengambang yang bisa di-drag, minimize, dan tutup
- **Template Aktivitas** — simpan template kegiatan yang sering dipakai, pilih lalu klik isi
- **Detail Aktifitas via Popup** — otomatis klik ikon titik 3, buka popup pencarian, masukkan kata kunci, dan klik hasil
- **Auto-detect Form** — otomatis mendeteksi field form di halaman
- **Konfigurasi** — tambah/hapus template, atur delay, reset ke default
- **WPT Tracker** — bar progress WPT harian (target 330–660 menit)
- **Isi & Save** — opsi untuk langsung klik tombol Save setelah form terisi

## Field Form yang Didukung

| Field | Keterangan |
|---|---|
| Kegiatan Tugas Jabatan | Readonly/prefilled dari sistem |
| Tanggal Aktivitas | Format dd/mm/yyyy, default hari ini |
| Detail Aktifitas | **Diisi via popup** — skrip otomatis klik ikon titik 3, cari kata kunci di popup, klik hasil |
| Satuan | Satuan kerja (Dokumen, Laporan, dst) |
| WPT | Waktu Penyelesaian Tugas (menit) |
| Volume | Jumlah volume pekerjaan |
| Objek Kerja / Topik | Topik/objek pekerjaan |

---

## Cara Install

### 1. Install Extension Tampermonkey

- **Chrome/Brave**: [Tampermonkey di Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Tampermonkey di Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- **Edge**: [Tampermonkey di Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. Install Userscript

**Cara A — Install langsung dari GitHub:**

1. Buka file [`emaster-autofill.user.js`](emaster-autofill.user.js) di GitHub
2. Klik tombol **Raw**
3. Tampermonkey akan otomatis mendeteksi dan menawarkan install
4. Klik **Install**

**Cara B — Copy-paste manual:**

1. Klik icon Tampermonkey di browser → **Create a new script**
2. Hapus semua isi default
3. Copy-paste seluruh isi file `emaster-autofill.user.js`
4. Klik **File → Save** (atau Ctrl+S)

### 3. Gunakan

1. Buka [Si-MASTER](https://master.bkd.jatimprov.go.id) dan **login manual**
2. Navigasi ke halaman **Aktivitas Harian** (SKP → Realisasi Bulanan → Aktivitas Harian)
3. Panel **E-MASTER AutoFill** akan muncul di pojok kanan atas
4. Pilih template aktivitas → klik **Isi Form** atau **Isi & Save**

---

## Cara Pakai

### Tab "Isi Form"
- Klik salah satu template aktivitas (kartu biru)
- Opsional: isi tanggal manual (format dd/mm/yyyy), kosong = hari ini
- Klik **Isi Form** → skrip akan:
  1. Isi Tanggal Aktivitas
  2. Buka popup Detail Aktifitas (klik ikon titik 3 otomatis)
  3. Cari kata kunci di popup dan klik hasil
  4. Isi Satuan, WPT, Volume, Objek Kerja
- Klik **Isi & Save** untuk mengisi lalu otomatis klik tombol Save

### Alur Detail Aktifitas (Popup)
Karena field "Detail Aktifitas" tidak bisa diketik langsung, skrip melakukan:
1. Mendeteksi dan klik ikon titik 3 di sebelah field
2. Menunggu popup `popup_aktifitas.php` terbuka
3. Mengisi kata kunci pencarian dari template
4. Klik tombol Cari
5. Klik hasil pencarian pertama
6. Popup menutup dan field terisi otomatis

> Jika popup gagal terbuka (misalnya diblokir pop-up blocker), pastikan pop-up diizinkan untuk `master.bkd.jatimprov.go.id` di browser Anda.

### Tab "Konfigurasi"
- Tambah template baru dengan mengisi:
  - **Nama/Label** — nama template
  - **Kata kunci** — kata kunci untuk pencarian di popup Detail Aktifitas
  - **Satuan, WPT, Volume, Objek Kerja**
- Hapus template yang tidak diperlukan
- Atur delay antar pengisian (default 500ms)
- Reset ke default jika diperlukan

### Tab "Deteksi"
- Klik **Deteksi Ulang** untuk melihat field form apa saja yang terdeteksi di halaman
- Sekarang juga mendeteksi **Ikon Popup Detail (titik 3)**
- Hijau = ditemukan, Merah = tidak ditemukan
- Gunakan ini untuk troubleshoot jika auto-fill tidak bekerja

---

## Template Default

| Template | Kata Kunci | WPT | Volume | Satuan |
|---|---|---|---|---|
| Administrasi Surat | administrasi surat | 120 menit | 5 | Dokumen |
| Menyusun Laporan | menyusun laporan | 90 menit | 1 | Laporan |
| Rapat Koordinasi | rapat koordinasi | 60 menit | 1 | Kegiatan |
| Pelayanan Publik | pelayanan | 60 menit | 3 | Orang |
| Pengelolaan Data | pengelolaan data | 90 menit | 10 | Data |
| Tindakan Keperawatan | keperawatan | 120 menit | 5 | Pasien |

Template bisa ditambah/dihapus/diubah dari panel Konfigurasi. Data tersimpan di browser (Tampermonkey storage).

---

## Troubleshooting

### Popup Detail Aktifitas tidak terbuka
- Pastikan pop-up tidak diblokir browser (izinkan pop-up untuk `master.bkd.jatimprov.go.id`)
- Cek tab "Deteksi" — pastikan "Ikon Popup Detail (titik 3)" berwarna hijau
- Jika tetap gagal, isi Detail Aktifitas manual lalu klik "Isi Form" untuk field lainnya

### Field tidak terdeteksi
- Pastikan Anda berada di halaman form **Aktivitas Harian** (bukan halaman list)
- Gunakan tab "Deteksi" → "Deteksi Ulang" untuk melihat field mana yang ditemukan

---

## Catatan Penting

- **Skrip ini TIDAK menyimpan atau mengirimkan data login Anda**
- Data konfigurasi template tersimpan lokal di browser melalui Tampermonkey storage
- Pastikan WPT harian minimal 330 menit (5.5 jam) dan maksimal 660 menit (11 jam)
- Target bulanan: 6750 menit (112.5 jam)
- Selalu periksa data sebelum klik Save

## Lisensi

MIT
