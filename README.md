# E-MASTER AutoFill — Aktivitas Harian SKP

Userscript (Tampermonkey / Greasemonkey) untuk mengisi otomatis form **Aktivitas Harian SKP** di aplikasi [Si-MASTER BKD Jatim](https://master.bkd.jatimprov.go.id).

> **Login tetap manual** — skrip ini hanya mengisi data ke form, tidak menyimpan password.

---

## Fitur

- **GUI Panel** — panel mengambang yang bisa di-drag, minimize, dan tutup
- **Template Aktivitas** — simpan template kegiatan yang sering dipakai, pilih lalu klik isi
- **Detail Aktifitas via Popup** — otomatis klik ikon titik 3, buka popup "Kamus Aktifitas Harian", cari kata kunci, dan klik hasil
- **Auto-detect Form** — otomatis mendeteksi field form dan ikon popup di halaman
- **Konfigurasi** — tambah/hapus template, atur delay, reset ke default
- **Isi & Save** — opsi untuk langsung klik tombol Save setelah form terisi

## Field Form

| Field | Cara Pengisian |
|---|---|
| Kegiatan Tugas Jabatan | Readonly — sudah prefilled dari sistem |
| Tanggal Aktivitas | **Diisi skrip** — default hari ini, bisa override manual |
| Detail Aktifitas | **Otomatis dari popup** — skrip klik ikon titik 3, cari kata kunci, klik hasil |
| Satuan | **Otomatis dari popup** — terisi saat klik hasil di Kamus Aktifitas |
| WPT | **Otomatis dari popup** — terisi saat klik hasil di Kamus Aktifitas |
| Volume | **Diisi skrip** — dari template |
| Objek Kerja / Topik | **Diisi skrip** — dari template |

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
  1. Isi **Tanggal Aktivitas**
  2. Buka popup "Kamus Aktifitas Harian" (klik ikon titik 3 otomatis)
  3. Cari kata kunci di popup → klik **Cari** → klik hasil pertama
  4. **Detail Aktifitas, Satuan, WPT** otomatis terisi dari popup
  5. Isi **Volume** dan **Objek Kerja / Topik** dari template
- Klik **Isi & Save** untuk mengisi lalu otomatis klik tombol Save

### Alur Detail Aktifitas (Popup)
Field "Detail Aktifitas", "Satuan", dan "WPT" **tidak bisa diketik langsung** — harus via popup. Skrip otomatis:
1. Mendeteksi dan klik ikon titik 3 di sebelah field
2. Menunggu popup "Kamus Aktifitas Harian" terbuka
3. Mengisi kata kunci pencarian dari template
4. Klik tombol **Cari**
5. Klik hasil pencarian pertama
6. Detail Aktifitas, Satuan, dan WPT terisi otomatis

> Jika popup gagal terbuka (misalnya diblokir pop-up blocker), pastikan pop-up diizinkan untuk `master.bkd.jatimprov.go.id` di browser Anda.

### Tab "Konfigurasi"
- Tambah template baru dengan mengisi:
  - **Nama/Label** — nama template
  - **Kata kunci** — kata kunci pencarian di popup Kamus Aktifitas
  - **Volume** — jumlah volume pekerjaan
  - **Objek Kerja / Topik** — topik pekerjaan
- Detail Aktifitas, Satuan, dan WPT **otomatis** dari popup (tidak perlu diisi di template)
- Hapus template yang tidak diperlukan
- Atur delay antar pengisian (default 500ms)
- Reset ke default jika diperlukan

### Tab "Excel"
- Upload file Excel (.xlsx) atau CSV
- Skrip otomatis mendeteksi kolom: **Tanggal**, **Kegiatan Tugas Jabatan**, **Volume**, **Obyek Kerja**
- Navigasi baris data dengan tombol Prev/Next
- Klik **Isi Baris Saat Ini** untuk mengisi form dari baris Excel yang aktif
- Klik **Isi & Save Baris Ini** untuk isi + langsung save
- Setelah isi, otomatis pindah ke baris berikutnya

**Format Excel yang didukung:**

| Kolom | Keterangan |
|---|---|
| Tanggal | Tanggal aktivitas (otomatis inherit ke baris di bawahnya jika kosong) |
| Kegiatan Tugas Jabatan | Kata kunci pencarian di popup Kamus Aktifitas |
| Obyek Kerja | Objek kerja / topik |
| Volume | Jumlah volume |

> Header bisa di baris manapun (skrip otomatis mencari baris yang mengandung "Tanggal" dan "Kegiatan"). Format tanggal: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, atau Date Excel.

### Tab "Deteksi"
- Klik **Deteksi Ulang** untuk melihat field form apa saja yang terdeteksi di halaman
- Mendeteksi juga **Ikon Popup Detail (titik 3)**
- Hijau = ditemukan, Merah = tidak ditemukan
- Gunakan ini untuk troubleshoot jika auto-fill tidak bekerja

---

## Template Default

| Template | Kata Kunci | Volume | Objek Kerja |
|---|---|---|---|
| Administrasi Surat | administrasi surat | 5 | Surat masuk dan surat keluar |
| Menyusun Laporan | menyusun laporan | 1 | Laporan kegiatan berkala |
| Rapat Koordinasi | rapat koordinasi | 1 | Rapat internal |
| Pelayanan Publik | pelayanan | 3 | Pelayanan tamu / masyarakat |
| Pengelolaan Data | pengelolaan data | 10 | Data kepegawaian |
| Tindakan Keperawatan | keperawatan | 5 | Pasien rawat inap / rawat jalan |

Template bisa ditambah/dihapus/diubah dari panel Konfigurasi. Data tersimpan di browser (Tampermonkey storage).

---

## Troubleshooting

### Popup Detail Aktifitas tidak terbuka
- Pastikan pop-up tidak diblokir browser (izinkan pop-up untuk `master.bkd.jatimprov.go.id`)
- Cek tab "Deteksi" — pastikan "Ikon Popup Detail (titik 3)" berwarna hijau
- Jika tetap gagal, klik ikon titik 3 manual → cari & klik hasil → lalu klik "Isi Form" untuk isi Volume & Objek Kerja

### Field tidak terdeteksi
- Pastikan Anda berada di halaman form **Aktivitas Harian** (bukan halaman list)
- Gunakan tab "Deteksi" → "Deteksi Ulang" untuk melihat field mana yang ditemukan

---

## Catatan Penting

- **Skrip ini TIDAK menyimpan atau mengirimkan data login Anda**
- Data konfigurasi template tersimpan lokal di browser melalui Tampermonkey storage
- Selalu periksa data sebelum klik Save

## Lisensi

MIT
