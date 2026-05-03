// ==UserScript==
// @name         E-MASTER Auto-Fill Aktivitas Harian
// @namespace    https://github.com/kangsotox991/emasterjs
// @version      1.7.0
// @description  Skrip auto-fill form Aktivitas Harian SKP di Si-MASTER BKD Jatim dengan GUI panel. Login manual, skrip hanya mengisi data form.
// @author       kangsotox991
// @match        https://master.bkd.jatimprov.go.id/*
// @match        https://wbs.jatimprov.go.id/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  //  KONFIGURASI DEFAULT
  //  Field form sesuai halaman "Edit Akfitas" E-MASTER:
  //    - Tanggal Aktivitas   (isi manual via skrip, format dd/mm/yyyy)
  //    - Detail Aktifitas    (otomatis via popup Kamus Aktifitas)
  //    - Satuan              (otomatis dari popup)
  //    - WPT                 (otomatis dari popup)
  //    - Volume              (isi manual via skrip)
  //    - Objek Kerja / Topik (isi manual via skrip)
  //
  //  Klik ikon titik 3 → popup "Kamus Aktifitas Harian" terbuka
  //  → cari kata kunci → klik hasil → Detail, Satuan, WPT terisi.
  //  Skrip hanya perlu isi: Tanggal, Volume, dan Objek Kerja.
  // ============================================================
  const DEFAULT_CONFIG = {
    templates: [
      {
        label: 'Administrasi Surat',
        kataKunci: 'administrasi surat',
        volume: 5,
        objekKerja: 'Surat masuk dan surat keluar',
      },
      {
        label: 'Menyusun Laporan',
        kataKunci: 'menyusun laporan',
        volume: 1,
        objekKerja: 'Laporan kegiatan berkala',
      },
      {
        label: 'Rapat Koordinasi',
        kataKunci: 'rapat koordinasi',
        volume: 1,
        objekKerja: 'Rapat internal',
      },
      {
        label: 'Pelayanan Publik',
        kataKunci: 'pelayanan',
        volume: 3,
        objekKerja: 'Pelayanan tamu / masyarakat',
      },
      {
        label: 'Pengelolaan Data',
        kataKunci: 'pengelolaan data',
        volume: 10,
        objekKerja: 'Data kepegawaian',
      },
      {
        label: 'Tindakan Keperawatan',
        kataKunci: 'keperawatan',
        volume: 5,
        objekKerja: 'Pasien rawat inap / rawat jalan',
      },
    ],
    delayMs: 500,
    popupWaitMs: 2000,
    kataKunciMap: {
      'Melaksanakan asuhan keperawatan sesuai SOP': [
        'Asuhan Keperawatan',
      ],
      'Menginput dokumentasi tindakan keperawatan': [
        'Dokumentasi Keperawatan',
      ],
      'Melaksanakan tindakan keperawatan tepat waktu': [
        'Sampling Darah Vena Instalasi',
        'Terapi Injeksi Parenteral',
        'Pasang Infus',
      ],
      'Melaksanakan prosedur keperawatan sesuai SOP': [
        'Sampling Darah Vena Instalasi',
        'Terapi Injeksi Parenteral',
        'Pasang Infus',
      ],
      'Menyiapkan alat medis pelayanan': [
        'Menyiapkan Alat Medis',
      ],
    },
  };

  // ============================================================
  //  STORAGE
  // ============================================================
  function loadConfig() {
    try {
      const saved = GM_getValue('emasterConfig3', null);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('[EM-AutoFill] load error', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function saveConfig(cfg) {
    try {
      GM_setValue('emasterConfig3', JSON.stringify(cfg));
    } catch (e) {
      console.warn('[EM-AutoFill] save error', e);
    }
  }

  let config = loadConfig();

  // ============================================================
  //  DOM HELPERS
  // ============================================================
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  function setVal(el, v) {
    if (!el) return false;
    const setter =
      Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value'
      )?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function waitMs(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ============================================================
  //  FORM FIELD DETECTION
  // ============================================================
  function findFieldByLabel(labelText) {
    const allLabels = $$('td, th, label, span, div, b, strong');
    for (const lbl of allLabels) {
      if (
        lbl.childElementCount <= 1 &&
        lbl.textContent.trim().toLowerCase().includes(labelText.toLowerCase())
      ) {
        let next = lbl.nextElementSibling;
        while (next) {
          const field =
            next.querySelector('input, textarea, select') ||
            (next.matches?.('input, textarea, select') ? next : null);
          if (field) return field;
          next = next.nextElementSibling;
        }
        const row = lbl.closest('tr');
        if (row) {
          const field = row.querySelector('input, textarea, select');
          if (field) return field;
        }
        const parent = lbl.parentElement;
        if (parent) {
          const field = parent.querySelector('input, textarea, select');
          if (field) return field;
        }
      }
    }
    return null;
  }

  function findPopupTrigger() {
    // Cari ikon/tombol titik 3 di dekat field "Detail Aktifitas"
    // Biasanya berupa <a>, <img>, <button>, atau <span> yang membuka popup
    const detailField = findFieldByLabel('Detail Aktifitas') || findFieldByLabel('Detail Aktivitas');
    if (detailField) {
      const parent = detailField.parentElement;
      if (parent) {
        // Cari link/button/img yang bisa diklik di sekitar field detail
        const triggers = $$('a, button, img, span, i', parent);
        for (const t of triggers) {
          const href = t.getAttribute('href') || '';
          const onclick = t.getAttribute('onclick') || '';
          const title = (t.getAttribute('title') || '').toLowerCase();
          const cls = (t.className || '').toLowerCase();

          if (
            href.includes('popup') ||
            onclick.includes('popup') ||
            onclick.includes('window.open') ||
            title.includes('cari') ||
            title.includes('pilih') ||
            title.includes('browse') ||
            cls.includes('popup') ||
            cls.includes('browse') ||
            t.tagName === 'IMG'
          ) {
            return t;
          }
        }
        // Fallback: cari semua elemen clickable di row/container yang sama
        const row = detailField.closest('tr') || parent;
        const allClickable = $$('a, button, img[onclick], span[onclick], i[onclick]', row);
        for (const t of allClickable) {
          if (t !== detailField) return t;
        }
      }
    }

    // Fallback global: cari link yang mengandung popup_aktifitas
    const popupLink = $('a[href*="popup_aktifitas"], a[onclick*="popup_aktifitas"]');
    if (popupLink) return popupLink;

    // Fallback: cari semua onclick yang mengandung popup
    const allOnclick = $$('[onclick*="popup"], [onclick*="window.open"]');
    for (const el of allOnclick) {
      const onclick = el.getAttribute('onclick') || '';
      if (onclick.includes('aktifitas') || onclick.includes('aktivitas')) {
        return el;
      }
    }

    return null;
  }

  function detectFields() {
    return {
      kegiatan: findFieldByLabel('Kegiatan Tugas Jabatan'),
      tanggal: findFieldByLabel('Tanggal Aktivitas'),
      detail: findFieldByLabel('Detail Aktifitas') || findFieldByLabel('Detail Aktivitas'),
      satuan: findFieldByLabel('Satuan'),
      wpt: findFieldByLabel('WPT'),
      volume: findFieldByLabel('Volume'),
      objekKerja: findFieldByLabel('Objek Kerja') || findFieldByLabel('Topik'),
      popupTrigger: findPopupTrigger(),
      saveBtn: $$('input[type="submit"], input[type="button"], button').find(
        (b) =>
          b.value?.toLowerCase() === 'save' ||
          b.textContent?.trim().toLowerCase() === 'save'
      ),
      cancelBtn: $$('input[type="submit"], input[type="button"], button').find(
        (b) =>
          b.value?.toLowerCase() === 'cancel' ||
          b.textContent?.trim().toLowerCase() === 'cancel'
      ),
    };
  }

  // ============================================================
  //  POPUP HANDLER — Detail Aktifitas
  //  Popup: "Kamus Aktifitas Harian - DINAS ..."
  //    - Input "Aktifitas:" + tombol "Cari"
  //    - Tabel hasil: No, Aktifitas, Satuan, WPT, Deskripsi,
  //      Objek Kerja, OPD
  //    - Klik baris hasil → data masuk ke form utama
  //
  //  Alur: klik ikon titik 3 → popup terbuka → isi kata kunci
  //        → klik Cari → tunggu tabel → klik baris pertama
  // ============================================================
  async function fillDetailViaPopup(kataKunci) {
    const trigger = findPopupTrigger();
    if (!trigger) {
      return { ok: false, msg: 'Ikon popup Detail Aktifitas tidak ditemukan' };
    }

    // Intercept window.open agar kita bisa akses popup window
    let popupWin = null;
    const origOpen = window.open;
    window.open = function (...args) {
      popupWin = origOpen.apply(this, args);
      return popupWin;
    };

    // Klik trigger
    trigger.click();

    // Tunggu popup terbuka
    const maxWait = config.popupWaitMs || 3000;
    const startTime = Date.now();
    while (!popupWin && Date.now() - startTime < maxWait) {
      await waitMs(200);
    }

    // Restore window.open
    window.open = origOpen;

    if (!popupWin) {
      return {
        ok: false,
        msg: 'Popup tidak terbuka. Pastikan pop-up diizinkan untuk master.bkd.jatimprov.go.id',
      };
    }

    // Tunggu popup DOM siap
    await waitMs(1500);

    try {
      const popupDoc = popupWin.document;
      if (!popupDoc || !popupDoc.body) {
        return { ok: false, msg: 'Tidak bisa akses konten popup (cross-origin?)' };
      }

      // Tunggu sampai halaman popup benar-benar loaded
      if (popupDoc.readyState !== 'complete') {
        await new Promise((resolve) => {
          popupWin.addEventListener('load', resolve);
          setTimeout(resolve, 3000);
        });
      }

      // ---- STEP 1: Cari input pencarian "Aktifitas:" ----
      const searchInput =
        popupDoc.querySelector('input[name*="aktifitas" i]') ||
        popupDoc.querySelector('input[name*="aktivitas" i]') ||
        popupDoc.querySelector('input[name*="search" i]') ||
        popupDoc.querySelector('input[name*="cari" i]') ||
        popupDoc.querySelector('input[name*="keyword" i]') ||
        popupDoc.querySelector('input[type="text"]') ||
        popupDoc.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');

      if (!searchInput) {
        popupWin.close();
        return { ok: false, msg: 'Kolom pencarian "Aktifitas" di popup tidak ditemukan' };
      }

      // Isi kata kunci
      searchInput.value = kataKunci;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      await waitMs(300);

      // ---- STEP 2: Klik tombol "Cari" ----
      const allBtns = [
        ...popupDoc.querySelectorAll('input[type="submit"], input[type="button"], button'),
      ];
      const cariBtn =
        allBtns.find((b) => (b.value || b.textContent || '').trim().toLowerCase() === 'cari') ||
        allBtns.find((b) => {
          const t = (b.value || b.textContent || '').trim().toLowerCase();
          return t.includes('cari') || t.includes('search') || t.includes('find');
        }) ||
        popupDoc.querySelector('input[type="submit"]');

      if (cariBtn) {
        cariBtn.click();
      } else {
        const form = searchInput.closest('form');
        if (form) {
          form.submit();
        } else {
          searchInput.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })
          );
        }
      }

      // ---- STEP 3: Tunggu hasil tabel muncul ----
      await waitMs(2000);

      // ---- STEP 4: Klik baris hasil pertama ----
      // Tabel "Kamus Aktifitas Harian" punya header di baris pertama
      // Hasil data mulai dari baris ke-2 dst
      const rows = popupDoc.querySelectorAll('table tr');
      let clicked = false;

      // Cari baris data (skip header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          // Cek apakah baris ini punya onclick
          if (row.onclick || row.getAttribute('onclick')) {
            row.click();
            clicked = true;
            break;
          }
          // Cek apakah ada link di dalam sel
          const link = row.querySelector('a');
          if (link) {
            link.click();
            clicked = true;
            break;
          }
          // Cek apakah sel sendiri punya onclick
          for (const cell of cells) {
            if (cell.onclick || cell.getAttribute('onclick')) {
              cell.click();
              clicked = true;
              break;
            }
            const cellLink = cell.querySelector('a');
            if (cellLink) {
              cellLink.click();
              clicked = true;
              break;
            }
          }
          if (clicked) break;
          // Last resort: klik baris langsung
          row.click();
          clicked = true;
          break;
        }
      }

      if (clicked) {
        await waitMs(500);
        return {
          ok: true,
          msg: `Detail Aktifitas diisi via popup (kata kunci: "${kataKunci}")`,
        };
      }

      return {
        ok: false,
        msg: `Tidak ada hasil untuk kata kunci "${kataKunci}". Coba kata kunci lain.`,
      };
    } catch (e) {
      return {
        ok: false,
        msg: `Error popup: ${e.message}. Isi Detail Aktifitas manual, lalu klik "Isi Form" untuk field lainnya.`,
      };
    }
  }

  // ============================================================
  //  GUI — STYLES
  // ============================================================
  GM_addStyle(`
    #em-panel{position:fixed;top:16px;right:16px;width:370px;max-height:85vh;background:#fff;border:2px solid #1565c0;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,.18);z-index:2147483647;font:13px/1.45 "Segoe UI",Tahoma,sans-serif;color:#333;display:flex;flex-direction:column}
    #em-hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;border-radius:8px 8px 0 0;cursor:move;user-select:none}
    #em-hdr span{font-weight:700;font-size:13px}
    #em-hdr button{background:rgba(255,255,255,.2);border:none;color:#fff;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:700;margin-left:4px}
    #em-hdr button:hover{background:rgba(255,255,255,.35)}
    #em-body{padding:10px 12px;overflow-y:auto;flex:1}
    .em-tabs{display:flex;gap:3px;margin-bottom:10px}
    .em-tab{flex:1;padding:6px 4px;border:1px solid #ccc;border-radius:5px 5px 0 0;background:#f5f5f5;cursor:pointer;font-size:11px;font-weight:600;color:#666;text-align:center}
    .em-tab.on{background:#1565c0;color:#fff;border-color:#1565c0}
    .em-pane{display:none}.em-pane.on{display:block}
    .em-lbl{display:block;font-weight:600;margin:8px 0 4px;font-size:11px;color:#555}
    .em-inp{width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:12px;box-sizing:border-box;margin-bottom:4px}
    .em-inp:focus{border-color:#1565c0;outline:none;box-shadow:0 0 0 2px rgba(21,101,192,.15)}
    .em-row{display:flex;gap:6px}
    .em-row .em-inp{width:100%}
    .em-btn{padding:7px 12px;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:#fff;transition:opacity .2s}
    .em-btn:hover{opacity:.85}
    .em-pri{background:#1565c0}.em-suc{background:#2e7d32}.em-dan{background:#c62828}.em-warn{background:#e65100}
    .em-btngrp{display:flex;gap:6px;margin-top:8px}
    .em-card{border:1px solid #e0e0e0;border-radius:6px;padding:8px;margin-bottom:6px;background:#fafafa;cursor:pointer;transition:background .15s}
    .em-card:hover{background:#e3f2fd}
    .em-card.on{background:#e3f2fd;border-color:#1565c0}
    .em-card-t{font-weight:600;font-size:12px;color:#333}
    .em-card-d{font-size:10px;color:#888;margin-top:2px}
    .em-badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:#e3f2fd;color:#1565c0;margin-top:3px;margin-right:3px}
    
    .em-msg{margin-top:8px;padding:7px;border-radius:5px;font-size:11px;line-height:1.35;white-space:pre-line;display:none}
    .em-msg.i{display:block;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9}
    .em-msg.s{display:block;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
    .em-msg.e{display:block;background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
    .em-msg.w{display:block;background:#fff3e0;color:#e65100;border:1px solid #ffcc80}
    .em-det{padding:3px 6px;margin-bottom:3px;border-radius:3px;font-size:11px;font-family:monospace}
    .em-det.ok{background:#e8f5e9;color:#2e7d32}.em-det.no{background:#ffebee;color:#c62828}
    .em-del{background:none;border:none;color:#c62828;cursor:pointer;font-size:16px;padding:0 4px}
    .em-mini{padding:0}
    .em-mini button{width:100%;padding:8px 12px;background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700}
  `);

  // ============================================================
  //  GUI — BUILD
  // ============================================================
  function buildPanel() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="em-panel">
      <div id="em-hdr">
        <span>E-MASTER AutoFill</span>
        <div><button id="em-min" title="Minimize">_</button><button id="em-cls" title="Tutup">X</button></div>
      </div>
      <div id="em-body">
        <div class="em-tabs">
          <div class="em-tab on" data-t="fill">Isi Form</div>
          <div class="em-tab" data-t="excel">Excel</div>
          <div class="em-tab" data-t="cfg">Konfigurasi</div>
          <div class="em-tab" data-t="det">Deteksi</div>
        </div>

        <!-- FILL -->
        <div class="em-pane on" id="em-p-fill">
          <label class="em-lbl">Pilih template aktivitas:</label>
          <div id="em-tpl-list"></div>
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:8px 0">
          <label class="em-lbl">Atau isi manual (1 kata kunci per baris):</label>
          <textarea id="em-kata-manual" class="em-inp" rows="4" placeholder="Kata kunci 1&#10;Kata kunci 2&#10;Kata kunci 3&#10;(satu per baris)"></textarea>
          <div class="em-row">
            <input id="em-tanggal" class="em-inp" placeholder="Tanggal (dd/mm/yyyy)" />
            <input id="em-vol-manual" class="em-inp" type="number" placeholder="Volume" value="1" min="1" />
          </div>
          <textarea id="em-objek-manual" class="em-inp" rows="2" placeholder="Objek Kerja / Topik (sama untuk semua kata kunci)"></textarea>
          <small style="font-size:10px;color:#888;display:block;margin-bottom:6px">Setiap klik "Isi Form" = isi 1 kata kunci berikutnya. Tanggal & Objek Kerja tetap sama.</small>
          <div id="em-kata-progress" style="font-size:11px;color:#1565c0;font-weight:600;margin-bottom:4px;display:none"></div>
          <div class="em-btngrp">
            <button class="em-btn em-pri" id="em-go">Isi Form</button>
            <button class="em-btn em-suc" id="em-go-save">Isi & Save</button>
            <button class="em-btn em-warn" id="em-kata-reset" style="display:none;font-size:10px">Reset Urutan</button>
          </div>
          <div id="em-status" class="em-msg"></div>
        </div>

        <!-- CONFIG -->
        <div class="em-pane" id="em-p-cfg">
          <label class="em-lbl">Tambah Template:</label>
          <input id="em-c-label" class="em-inp" placeholder="Nama / Label template" />
          <input id="em-c-kata" class="em-inp" placeholder="Kata kunci pencarian di popup Kamus Aktifitas" />
          <div class="em-row">
            <input id="em-c-vol" class="em-inp" type="number" placeholder="Volume" value="1" min="1" />
            <input id="em-c-delay" class="em-inp" type="number" placeholder="Delay (ms)" value="${config.delayMs}" min="100" />
          </div>
          <textarea id="em-c-objek" class="em-inp" rows="2" placeholder="Objek Kerja / Topik"></textarea>
          <small style="font-size:10px;color:#888;display:block;margin-bottom:6px">Detail Aktifitas, Satuan, dan WPT otomatis terisi dari popup Kamus Aktifitas</small>
          <button class="em-btn em-pri" id="em-c-add">Tambah</button>

          <label class="em-lbl" style="margin-top:12px">Template Tersimpan:</label>
          <div id="em-c-list"></div>

          <hr style="border:none;border-top:1px solid #e0e0e0;margin:12px 0 8px">
          <label class="em-lbl">Mapping Kata Kunci (Excel → Popup):</label>
          <small style="font-size:10px;color:#888;display:block;margin-bottom:6px">
            Setiap aktivitas di Excel bisa punya beberapa kata kunci pencarian di popup.<br>
            Tiap kata kunci = 1x isi form.
          </small>
          <input id="em-m-aktivitas" class="em-inp" placeholder="Nama aktivitas dari Excel (kolom Kegiatan)" />
          <textarea id="em-m-katakunci" class="em-inp" rows="3" placeholder="Kata kunci popup (1 per baris)&#10;contoh:&#10;Sampling Darah Vena Instalasi&#10;Terapi Injeksi Parenteral"></textarea>
          <button class="em-btn em-pri" id="em-m-add">Tambah / Update Mapping</button>
          <div id="em-m-list" style="margin-top:8px"></div>

          <div class="em-btngrp" style="margin-top:12px">
            <button class="em-btn em-pri" id="em-c-save">Simpan Konfigurasi</button>
            <button class="em-btn em-dan" id="em-c-reset">Reset Default</button>
          </div>
        </div>

        <!-- EXCEL IMPORT -->
        <div class="em-pane" id="em-p-excel">
          <label class="em-lbl">Import data dari Excel (.xlsx / .csv):</label>
          <input type="file" id="em-excel-file" accept=".xlsx,.xls,.csv" class="em-inp" style="padding:4px" />
          <small style="font-size:10px;color:#888;display:block;margin-bottom:4px">
            Kolom: No | Tanggal | Kegiatan Tugas Jabatan | Obyek Kerja | Volume
          </small>
          <div class="em-row" style="margin-bottom:6px">
            <label style="font-size:10px;color:#555;white-space:nowrap;margin-right:4px">Filter No:</label>
            <input id="em-excel-no-dari" class="em-inp" type="number" placeholder="Dari" value="3" min="1" style="width:50px" />
            <span style="font-size:10px;color:#888;margin:0 2px">s/d</span>
            <input id="em-excel-no-sampai" class="em-inp" type="number" placeholder="Sampai" value="7" min="1" style="width:50px" />
            <button class="em-btn em-pri" id="em-excel-reload" style="font-size:10px;padding:3px 8px;margin-left:4px">Reload</button>
          </div>
          <div id="em-excel-preview" style="max-height:200px;overflow-y:auto;margin-bottom:8px"></div>
          <div id="em-excel-info" style="font-size:11px;color:#555;margin-bottom:6px"></div>
          <div class="em-btngrp">
            <button class="em-btn em-pri" id="em-excel-fill" disabled>Isi Baris Saat Ini</button>
            <button class="em-btn em-suc" id="em-excel-fill-save" disabled>Isi & Save Baris Ini</button>
          </div>
          <div style="margin-top:6px">
            <button class="em-btn em-warn" id="em-excel-prev" disabled style="font-size:10px;padding:4px 8px">&laquo; Prev</button>
            <span id="em-excel-pos" style="font-size:11px;margin:0 8px"></span>
            <button class="em-btn em-warn" id="em-excel-next" disabled style="font-size:10px;padding:4px 8px">Next &raquo;</button>
          </div>
          <div id="em-excel-status" class="em-msg"></div>
        </div>

        <!-- DETECT -->
        <div class="em-pane" id="em-p-det">
          <label class="em-lbl">Field form yang terdeteksi di halaman ini:</label>
          <div id="em-det-list"></div>
          <button class="em-btn em-pri" id="em-det-btn" style="margin-top:6px">Deteksi Ulang</button>
        </div>
      </div>
      <div id="em-panel-mini" class="em-mini" style="display:none">
        <button id="em-restore">E-MASTER AutoFill</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    bindEvents();
    renderTemplates();
    renderSavedList();
    renderMappingList();
    makeDraggable();
  }

  // ============================================================
  //  EVENTS
  // ============================================================
  function bindEvents() {
    $$('.em-tab').forEach((t) =>
      t.addEventListener('click', () => {
        $$('.em-tab').forEach((x) => x.classList.remove('on'));
        $$('.em-pane').forEach((x) => x.classList.remove('on'));
        t.classList.add('on');
        $(`#em-p-${t.dataset.t}`).classList.add('on');
      })
    );

    $('#em-min').onclick = () => {
      $('#em-body').style.display = 'none';
      $('#em-hdr').style.display = 'none';
      $('#em-panel-mini').style.display = 'block';
    };
    $('#em-restore').onclick = () => {
      $('#em-body').style.display = '';
      $('#em-hdr').style.display = 'flex';
      $('#em-panel-mini').style.display = 'none';
    };
    $('#em-cls').onclick = () => ($('#em-panel').style.display = 'none');

    $('#em-go').onclick = () => doFill(false);
    $('#em-go-save').onclick = () => doFill(true);

    $('#em-c-add').onclick = addTemplate;
    $('#em-m-add').onclick = addMapping;
    $('#em-c-save').onclick = () => {
      config.delayMs = parseInt($('#em-c-delay').value) || 500;
      saveConfig(config);
      msg('Konfigurasi disimpan!', 's');
    };
    $('#em-c-reset').onclick = () => {
      if (!confirm('Reset semua template dan mapping ke default?')) return;
      config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      saveConfig(config);
      renderTemplates();
      renderSavedList();
      renderMappingList();
      msg('Reset ke default.', 'i');
    };

    $('#em-det-btn').onclick = renderDetected;

    // Manual kata kunci multi-baris
    $('#em-kata-manual').addEventListener('input', updateKataProgress);
    $('#em-kata-reset').onclick = () => {
      manualKataIdx = 0;
      updateKataProgress();
      msg('Urutan kata kunci direset ke awal.', 'i');
    };

    // Excel import
    $('#em-excel-file').onchange = handleExcelFile;
    $('#em-excel-fill').onclick = () => doFillExcelRow(false);
    $('#em-excel-fill-save').onclick = () => doFillExcelRow(true);
    $('#em-excel-prev').onclick = () => navigateExcelRow(-1);
    $('#em-excel-next').onclick = () => navigateExcelRow(1);
    $('#em-excel-reload').onclick = reloadExcelWithFilter;
  }

  // ============================================================
  //  EXCEL IMPORT
  //  Format Excel: header row berisi kolom:
  //    Tanggal, Kegiatan Tugas Jabatan, Obyek Kerja, Volume
  //  Tanggal hanya di baris pertama per hari (baris berikutnya inherit)
  // ============================================================
  let excelData = [];
  let excelRowIdx = 0;
  let excelRawJson = null;

  function handleExcelFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        excelRawJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        loadExcelData();
      } catch (err) {
        excelMsg(`Error membaca file: ${err.message}`, 'e');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function loadExcelData() {
    if (!excelRawJson) return;

    const rawRows = parseExcelRows(excelRawJson);

    // Expand rows berdasarkan mapping kata kunci
    excelData = expandWithMapping(rawRows);

    if (excelData.length === 0) {
      excelMsg('Tidak ada data ditemukan (cek filter No / mapping).', 'e');
      $('#em-excel-fill').disabled = true;
      $('#em-excel-fill-save').disabled = true;
      $('#em-excel-preview').innerHTML = '';
      $('#em-excel-pos').textContent = '';
      return;
    }

    excelRowIdx = 0;
    renderExcelPreview();
    updateExcelNav();

    const noDari = parseInt($('#em-excel-no-dari')?.value) || 1;
    const noSampai = parseInt($('#em-excel-no-sampai')?.value) || 999;
    excelMsg(`${excelData.length} item (No ${noDari}-${noSampai}, sudah di-expand dari mapping). Siap isi form.`, 's');

    $('#em-excel-fill').disabled = false;
    $('#em-excel-fill-save').disabled = false;
  }

  function expandWithMapping(rows) {
    const map = config.kataKunciMap || {};
    const result = [];

    for (const row of rows) {
      // Cari mapping berdasarkan nama kegiatan dari Excel
      const kegiatan = row.kataKunci;
      let matched = false;

      for (const [aktivitas, kataList] of Object.entries(map)) {
        if (kegiatan.toLowerCase().includes(aktivitas.toLowerCase()) ||
            aktivitas.toLowerCase().includes(kegiatan.toLowerCase())) {
          // Expand: 1 Excel row → N items (1 per kata kunci)
          for (const kata of kataList) {
            result.push({
              ...row,
              kataKunciPopup: kata,
              aktivitasExcel: kegiatan,
            });
          }
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Tidak ada mapping → pakai nama kegiatan Excel langsung sebagai kata kunci
        result.push({
          ...row,
          kataKunciPopup: kegiatan,
          aktivitasExcel: kegiatan,
        });
      }
    }

    return result;
  }

  function reloadExcelWithFilter() {
    if (!excelRawJson) {
      excelMsg('Upload file Excel dulu.', 'w');
      return;
    }
    loadExcelData();
  }

  function parseExcelRows(json) {
    // Cari header row: baris yang mengandung "Tanggal" dan "Kegiatan" atau "Volume"
    let headerIdx = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(json.length, 30); i++) {
      const row = json[i].map((c) => String(c || '').toLowerCase().trim());
      const hasKegiatan = row.some((c) => c.includes('kegiatan'));
      const hasTanggal = row.some((c) => c.includes('tanggal'));
      const hasVolume = row.some((c) => c.includes('volume'));

      if (hasKegiatan && (hasTanggal || hasVolume)) {
        headerIdx = i;
        for (let j = 0; j < row.length; j++) {
          if (row[j] === 'no' || row[j] === 'no.') colMap.no = j;
          if (row[j].includes('tanggal')) colMap.tanggal = j;
          if (row[j].includes('kegiatan')) colMap.kegiatan = j;
          if (row[j].includes('obyek') || row[j].includes('objek') || row[j].includes('topik'))
            colMap.objekKerja = j;
          if (row[j].includes('volume')) colMap.volume = j;
        }
        break;
      }
    }

    if (headerIdx === -1) {
      // Fallback: assume first row is header
      headerIdx = 0;
      const row = json[0].map((c) => String(c || '').toLowerCase().trim());
      for (let j = 0; j < row.length; j++) {
        if (row[j] === 'no' || row[j] === 'no.') colMap.no = j;
        if (row[j].includes('tanggal')) colMap.tanggal = j;
        if (row[j].includes('kegiatan') || row[j].includes('kata kunci') || row[j].includes('aktifitas'))
          colMap.kegiatan = j;
        if (row[j].includes('obyek') || row[j].includes('objek') || row[j].includes('topik'))
          colMap.objekKerja = j;
        if (row[j].includes('volume')) colMap.volume = j;
      }
    }

    // Kolom kegiatan wajib ada
    if (colMap.kegiatan === undefined) return [];

    // Filter No: ambil dari input GUI atau default 3-7
    const noDari = parseInt($('#em-excel-no-dari')?.value) || 1;
    const noSampai = parseInt($('#em-excel-no-sampai')?.value) || 999;

    const result = [];
    let lastTanggal = '';

    for (let i = headerIdx + 1; i < json.length; i++) {
      const row = json[i];
      const kegiatan = String(row[colMap.kegiatan] || '').trim();
      if (!kegiatan) continue;

      // Filter berdasarkan kolom No
      if (colMap.no !== undefined) {
        const noVal = parseInt(row[colMap.no]);
        if (!isNaN(noVal) && (noVal < noDari || noVal > noSampai)) {
          // Tetap update tanggal walau baris diskip
          if (colMap.tanggal !== undefined) {
            const rawTgl = row[colMap.tanggal];
            if (rawTgl) {
              const tgl = formatTanggal(rawTgl);
              if (tgl) lastTanggal = tgl;
            }
          }
          continue;
        }
      }

      // Parse tanggal
      let tgl = '';
      if (colMap.tanggal !== undefined) {
        const rawTgl = row[colMap.tanggal];
        if (rawTgl) {
          tgl = formatTanggal(rawTgl);
          if (tgl) lastTanggal = tgl;
        }
      }
      if (!tgl) tgl = lastTanggal;

      const noVal = colMap.no !== undefined ? parseInt(row[colMap.no]) || '' : '';
      const volume = colMap.volume !== undefined ? parseInt(row[colMap.volume]) || 1 : 1;
      const objekKerja =
        colMap.objekKerja !== undefined ? String(row[colMap.objekKerja] || '').trim() : '';

      result.push({ no: noVal, tanggal: tgl, kataKunci: kegiatan, volume, objekKerja });
    }

    return result;
  }

  function formatTanggal(val) {
    if (!val) return '';
    // Jika Date object
    if (val instanceof Date) {
      const dd = String(val.getDate()).padStart(2, '0');
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const yyyy = val.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    const s = String(val).trim();
    // Sudah format dd/mm/yyyy?
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    // Format yyyy-mm-dd?
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    // Format dd-mm-yyyy?
    const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;
    return '';
  }

  function renderExcelPreview() {
    const box = $('#em-excel-preview');
    if (!box || excelData.length === 0) return;

    const start = Math.max(0, excelRowIdx - 2);
    const end = Math.min(excelData.length, excelRowIdx + 5);

    let html =
      '<table style="width:100%;border-collapse:collapse;font-size:10px">' +
      '<tr style="background:#1565c0;color:#fff"><th style="padding:3px">#</th><th style="padding:3px">Tgl</th><th style="padding:3px">Kata Kunci Popup</th><th style="padding:3px">Vol</th></tr>';

    for (let i = start; i < end; i++) {
      const d = excelData[i];
      const isCurrent = i === excelRowIdx;
      const bg = isCurrent ? '#e3f2fd;font-weight:700' : i % 2 === 0 ? '#fafafa' : '#fff';
      const arrow = isCurrent ? '&#9654; ' : '';
      const popup = d.kataKunciPopup || d.kataKunci;
      html += `<tr style="background:${bg}">
        <td style="padding:2px 4px;border:1px solid #e0e0e0">${arrow}${i + 1}</td>
        <td style="padding:2px 4px;border:1px solid #e0e0e0">${esc(d.tanggal)}</td>
        <td style="padding:2px 4px;border:1px solid #e0e0e0">${esc(popup.substring(0, 35))}${popup.length > 35 ? '...' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #e0e0e0">${d.volume}</td>
      </tr>`;
    }
    html += '</table>';
    box.innerHTML = html;
  }

  function updateExcelNav() {
    const total = excelData.length;
    const pos = $('#em-excel-pos');
    const prevBtn = $('#em-excel-prev');
    const nextBtn = $('#em-excel-next');

    if (pos) pos.textContent = `Baris ${excelRowIdx + 1} / ${total}`;
    if (prevBtn) prevBtn.disabled = excelRowIdx <= 0;
    if (nextBtn) nextBtn.disabled = excelRowIdx >= total - 1;

    renderExcelPreview();
  }

  function navigateExcelRow(dir) {
    excelRowIdx = Math.max(0, Math.min(excelData.length - 1, excelRowIdx + dir));
    updateExcelNav();
  }

  async function doFillExcelRow(autoSave) {
    if (excelData.length === 0 || excelRowIdx >= excelData.length) {
      excelMsg('Tidak ada data untuk diisi.', 'w');
      return;
    }

    const row = excelData[excelRowIdx];
    excelMsg(`Mengisi baris ${excelRowIdx + 1}...`, 'i');

    const f = detectFields();
    const log = [];

    // 1. Tanggal
    if (f.tanggal && row.tanggal) {
      const cur = f.tanggal.value.replace(/[^0-9]/g, '');
      if (!cur || cur === '00000000') {
        setVal(f.tanggal, row.tanggal);
        log.push(`Tanggal: ${row.tanggal}`);
      } else {
        log.push(`Tanggal: sudah terisi (${f.tanggal.value})`);
      }
      await waitMs(config.delayMs);
    }

    // 2. Detail Aktifitas via popup (kata kunci dari mapping atau Excel)
    const kataPopup = row.kataKunciPopup || row.kataKunci;
    if (kataPopup) {
      excelMsg(`Item ${excelRowIdx + 1}: Popup → "${kataPopup}"...`, 'i');
      const popupResult = await fillDetailViaPopup(kataPopup);
      log.push(popupResult.msg);
      if (popupResult.ok) {
        log.push('Detail, Satuan, WPT \u2192 terisi dari Kamus Aktifitas');
      } else {
        log.push('Tip: Klik ikon titik 3 manual, lalu isi dari popup');
      }
      await waitMs(config.delayMs);
    }

    // 3. Volume
    if (f.volume) {
      setVal(f.volume, String(row.volume));
      log.push(`Volume: ${row.volume}`);
      await waitMs(config.delayMs);
    }

    // 4. Objek Kerja
    if (f.objekKerja && row.objekKerja) {
      setVal(f.objekKerja, row.objekKerja);
      log.push(`Objek Kerja: ${row.objekKerja.substring(0, 60)}${row.objekKerja.length > 60 ? '...' : ''}`);
      await waitMs(config.delayMs);
    }

    // 5. Save
    if (autoSave && f.saveBtn) {
      f.saveBtn.click();
      log.push('Tombol Save diklik!');
    } else if (autoSave) {
      log.push('Tombol Save tidak ditemukan \u2014 klik manual.');
    }

    excelMsg(`Baris ${excelRowIdx + 1} selesai:\n${log.join('\n')}`, 's');

    // Auto advance ke baris berikutnya
    if (excelRowIdx < excelData.length - 1) {
      excelRowIdx++;
      updateExcelNav();
    }
  }

  function excelMsg(text, type) {
    const el = $('#em-excel-status');
    if (!el) return;
    el.className = `em-msg ${type || 'i'}`;
    el.textContent = text;
  }

  // ============================================================
  //  FILL LOGIC
  // ============================================================
  let manualKataIdx = 0;
  let lastManualKataList = [];

  function getManualKataList() {
    const raw = $('#em-kata-manual').value.trim();
    if (!raw) return [];
    return raw.split('\n').map((s) => s.trim()).filter(Boolean);
  }

  function updateKataProgress() {
    const list = getManualKataList();
    const prog = $('#em-kata-progress');
    const resetBtn = $('#em-kata-reset');
    if (!prog) return;

    if (list.length <= 1) {
      prog.style.display = 'none';
      if (resetBtn) resetBtn.style.display = 'none';
      return;
    }

    // Reset index if kata list changed
    const key = list.join('|');
    const lastKey = lastManualKataList.join('|');
    if (key !== lastKey) {
      manualKataIdx = 0;
      lastManualKataList = list;
    }

    const idx = Math.min(manualKataIdx, list.length - 1);
    prog.style.display = 'block';
    prog.textContent = `Kata kunci ${idx + 1} / ${list.length}: "${list[idx]}"'`;
    if (resetBtn) resetBtn.style.display = 'inline-block';
  }

  async function doFill(autoSave) {
    const kataList = getManualKataList();
    const manualVol = $('#em-vol-manual').value.trim();
    const manualObjek = $('#em-objek-manual').value.trim();
    const tglInput = $('#em-tanggal').value.trim();

    let tpl;
    if (kataList.length > 0) {
      // Input manual — abaikan template
      const idx = Math.min(manualKataIdx, kataList.length - 1);
      tpl = {
        kataKunci: kataList[idx],
        volume: parseInt(manualVol) || 1,
        objekKerja: manualObjek,
      };
    } else {
      const sel = getSelected();
      if (!sel) {
        msg('Pilih template atau isi kata kunci manual!', 'w');
        return;
      }
      tpl = { ...sel };
    }

    msg('Mengisi form...', 'i');
    const f = detectFields();
    const log = [];

    // 1. Tanggal Aktivitas
    if (f.tanggal) {
      let tgl = tglInput;
      if (!tgl) {
        const now = new Date();
        tgl = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      }
      const cur = f.tanggal.value.replace(/[^0-9]/g, '');
      if (!cur || cur === '00000000') {
        setVal(f.tanggal, tgl);
        log.push(`Tanggal: ${tgl}`);
      } else {
        log.push(`Tanggal: sudah terisi (${f.tanggal.value})`);
      }
      await waitMs(config.delayMs);
    }

    // 2. Detail Aktifitas — via popup (juga mengisi Satuan dan WPT otomatis)
    if (tpl.kataKunci) {
      msg('Mengisi form...\nMembuka popup Kamus Aktifitas...', 'i');
      const popupResult = await fillDetailViaPopup(tpl.kataKunci);
      log.push(popupResult.msg);
      if (popupResult.ok) {
        log.push('Detail Aktifitas, Satuan, WPT → terisi dari Kamus Aktifitas');
      } else {
        log.push('Tip: Klik ikon titik 3 manual → cari & klik hasil → lalu klik "Isi Form" lagi untuk Volume & Objek Kerja');
      }
      await waitMs(config.delayMs);
    }

    // 3. Volume (isi manual)
    if (f.volume) {
      setVal(f.volume, String(tpl.volume));
      log.push(`Volume: ${tpl.volume}`);
      await waitMs(config.delayMs);
    }

    // 4. Objek Kerja / Topik
    if (f.objekKerja) {
      setVal(f.objekKerja, tpl.objekKerja);
      log.push(`Objek Kerja: ${tpl.objekKerja}`);
      await waitMs(config.delayMs);
    }

    if (log.length === 0) {
      msg('Tidak ada field yang terdeteksi!\nPastikan Anda di halaman form Aktivitas Harian.', 'e');
      return;
    }

    // 5. Save
    if (autoSave && f.saveBtn) {
      f.saveBtn.click();
      log.push('Tombol Save diklik!');
    } else if (autoSave) {
      log.push('Tombol Save tidak ditemukan — klik manual.');
    }

    msg(log.join('\n'), 's');

    // Auto advance ke kata kunci berikutnya jika pakai input manual multi-baris
    if (kataList.length > 1 && manualKataIdx < kataList.length - 1) {
      manualKataIdx++;
      updateKataProgress();
      msg(log.join('\n') + `\n\nKata kunci berikutnya: "${kataList[manualKataIdx]}" (${manualKataIdx + 1}/${kataList.length})`, 's');
    } else if (kataList.length > 1 && manualKataIdx >= kataList.length - 1) {
      msg(log.join('\n') + '\n\nSemua kata kunci sudah diisi!', 's');
    }
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function renderTemplates() {
    const box = $('#em-tpl-list');
    if (!box) return;
    box.innerHTML = config.templates
      .map(
        (t, i) => `
      <div class="em-card" data-i="${i}">
        <div class="em-card-t">${esc(t.label)}</div>
        <div class="em-card-d">Cari: "${esc(t.kataKunci)}"</div>
        <span class="em-badge">Vol ${t.volume}</span>
        <span class="em-badge">${esc(t.objekKerja)}</span>
      </div>`
      )
      .join('');

    $$('.em-card', box).forEach((c) =>
      c.addEventListener('click', () => {
        $$('.em-card', box).forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        updateBar();
      })
    );
  }

  function renderSavedList() {
    const box = $('#em-c-list');
    if (!box) return;
    box.innerHTML = config.templates
      .map(
        (t, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:3px;font-size:11px">
        <span>${esc(t.label)} (vol ${t.volume})</span>
        <button class="em-del" data-i="${i}" title="Hapus">&times;</button>
      </div>`
      )
      .join('');

    $$('.em-del', box).forEach((b) =>
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i);
        if (confirm(`Hapus "${config.templates[i].label}"?`)) {
          config.templates.splice(i, 1);
          saveConfig(config);
          renderTemplates();
          renderSavedList();
        }
      })
    );
  }

  function renderDetected() {
    const f = detectFields();
    const map = {
      kegiatan: 'Kegiatan Tugas Jabatan',
      tanggal: 'Tanggal Aktivitas',
      detail: 'Detail Aktifitas (dari popup)',
      popupTrigger: 'Ikon Popup Detail (titik 3)',
      satuan: 'Satuan (dari popup)',
      wpt: 'WPT (dari popup)',
      volume: 'Volume',
      objekKerja: 'Objek Kerja / Topik',
      saveBtn: 'Tombol Save',
      cancelBtn: 'Tombol Cancel',
    };
    const box = $('#em-det-list');
    box.innerHTML = Object.entries(map)
      .map(([k, label]) => {
        const el = f[k];
        const ok = !!el;
        const tag = el
          ? `<${el.tagName.toLowerCase()}${el.name ? ' name="' + el.name + '"' : ''}${el.id ? ' id="' + el.id + '"' : ''}>`
          : 'Tidak ditemukan';
        return `<div class="em-det ${ok ? 'ok' : 'no'}">${label}: ${esc(tag)}</div>`;
      })
      .join('');
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function getSelected() {
    const card = $('.em-card.on');
    if (!card) return null;
    return config.templates[parseInt(card.dataset.i)] || null;
  }

  function updateBar() {
    // WPT bar dihapus karena WPT otomatis dari popup
  }

  function addTemplate() {
    const label = $('#em-c-label').value.trim();
    const kataKunci = $('#em-c-kata').value.trim();
    const vol = parseInt($('#em-c-vol').value) || 1;
    const objek = $('#em-c-objek').value.trim();

    if (!label) {
      msg('Nama template harus diisi!', 'w');
      return;
    }
    if (!kataKunci) {
      msg('Kata kunci pencarian harus diisi!', 'w');
      return;
    }

    config.templates.push({
      label,
      kataKunci,
      volume: vol,
      objekKerja: objek || label,
    });
    saveConfig(config);

    $('#em-c-label').value = '';
    $('#em-c-kata').value = '';
    $('#em-c-vol').value = '1';
    $('#em-c-objek').value = '';

    renderTemplates();
    renderSavedList();
    msg(`Template "${label}" ditambahkan!`, 's');
  }

  function addMapping() {
    const aktivitas = $('#em-m-aktivitas').value.trim();
    const kataRaw = $('#em-m-katakunci').value.trim();

    if (!aktivitas) {
      msg('Nama aktivitas harus diisi!', 'w');
      return;
    }
    if (!kataRaw) {
      msg('Kata kunci harus diisi (minimal 1 baris)!', 'w');
      return;
    }

    const kataList = kataRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (kataList.length === 0) {
      msg('Kata kunci tidak boleh kosong!', 'w');
      return;
    }

    if (!config.kataKunciMap) config.kataKunciMap = {};
    config.kataKunciMap[aktivitas] = kataList;
    saveConfig(config);

    $('#em-m-aktivitas').value = '';
    $('#em-m-katakunci').value = '';

    renderMappingList();
    msg(`Mapping "${aktivitas}" → ${kataList.length} kata kunci disimpan!`, 's');
  }

  function renderMappingList() {
    const box = $('#em-m-list');
    if (!box) return;
    const map = config.kataKunciMap || {};
    const entries = Object.entries(map);

    if (entries.length === 0) {
      box.innerHTML = '<div style="font-size:10px;color:#888;padding:4px">Belum ada mapping.</div>';
      return;
    }

    box.innerHTML = entries
      .map(
        ([aktivitas, kataList], i) => `
      <div style="border:1px solid #e0e0e0;border-radius:4px;padding:6px;margin-bottom:4px;font-size:10px">
        <div style="font-weight:600;color:#333;margin-bottom:2px">${esc(aktivitas)}</div>
        <div style="color:#1565c0">${kataList.map((k) => '• ' + esc(k)).join('<br>')}</div>
        <div style="margin-top:3px">
          <button class="em-m-edit" data-key="${esc(aktivitas)}" style="font-size:9px;cursor:pointer;color:#1565c0;background:none;border:none;padding:0;text-decoration:underline">Edit</button>
          <button class="em-m-del" data-key="${esc(aktivitas)}" style="font-size:9px;cursor:pointer;color:#c62828;background:none;border:none;padding:0;text-decoration:underline;margin-left:8px">Hapus</button>
        </div>
      </div>`
      )
      .join('');

    $$('.em-m-del', box).forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        if (confirm(`Hapus mapping "${key}"?`)) {
          delete config.kataKunciMap[key];
          saveConfig(config);
          renderMappingList();
        }
      })
    );

    $$('.em-m-edit', box).forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        const kataList = config.kataKunciMap[key] || [];
        $('#em-m-aktivitas').value = key;
        $('#em-m-katakunci').value = kataList.join('\n');
      })
    );
  }

  function msg(text, type) {
    const el = $('#em-status');
    if (!el) return;
    el.className = `em-msg ${type || 'i'}`;
    el.textContent = text;
  }

  // ============================================================
  //  DRAGGABLE
  // ============================================================
  function makeDraggable() {
    const panel = $('#em-panel');
    const hdr = $('#em-hdr');
    let dragging = false,
      ox,
      oy;
    hdr.addEventListener('mousedown', (e) => {
      dragging = true;
      ox = e.clientX - panel.getBoundingClientRect().left;
      oy = e.clientY - panel.getBoundingClientRect().top;
      panel.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = Math.max(0, e.clientX - ox) + 'px';
      panel.style.top = Math.max(0, e.clientY - oy) + 'px';
      panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
      panel.style.transition = '';
    });
  }

  // ============================================================
  //  INIT — hanya tampilkan panel di halaman setelah login
  // ============================================================
  function isLoginPage() {
    const url = window.location.href.toLowerCase();
    const body = document.body?.textContent?.toLowerCase() || '';
    return (
      url.includes('login') ||
      url.includes('index.php') ||
      (body.includes('nomer induk pegawai') && body.includes('password'))
    );
  }

  function init() {
    if (isLoginPage()) return;
    buildPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
